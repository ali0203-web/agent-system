/**
 * Agent #8: Grid Trading Bot
 * Places buy/sell orders at predetermined price levels (grid)
 * Profits from market volatility between grid levels
 */

import { BaseAgent, AgentConfig } from '../base-agent'
import { getBinanceAPI, OrderFill, OrderStatusInfo, TradeInfo } from '../services/binance-api'
import { roundQuantity } from '../services/order-rounding'
import { orderBlockReason } from '../dry-run'
import {
  CorruptStateError,
  GridStateStore,
  createGridStateStore,
  parseStateJson,
} from '../services/grid-state-store'

/**
 * Level lifecycle (driven by what the exchange reports, never assumed):
 *   pending   -> price enters the buy band, BUY placed          -> buy_open
 *   buy_open  -> BUY filled (or part-filled and cancelled)      -> filled  (holding heldQty)
 *             -> BUY cancelled/expired with nothing filled      -> pending
 *   filled    -> price reaches the sell target, SELL placed      -> sell_open
 *   sell_open -> SELL filled: profit booked from actual fills    -> pending
 *             -> SELL cancelled/expired                          -> filled
 */
type LevelStatus = 'pending' | 'buy_open' | 'filled' | 'sell_open' | 'cancelled'

interface GridLevel {
  level: number
  price: number
  buyOrderId?: string
  sellOrderId?: string
  status: LevelStatus
  buyOrderPlacedAt?: Date
  buyFilledAt?: Date
  /** Base asset actually held after the buy, net of fees and rounded to the step size. */
  heldQty?: number
  /** Base asset received after fees, before rounding to the step (heldQty plus unsellable dust). */
  buyNetQty?: number
  /** Quote asset actually spent on the buy. */
  buyCost?: number
  buyAvgPrice?: number
  soldAt?: Date
  profit?: number
  profitPercent?: number
  /**
   * Write-ahead marker: set and saved BEFORE an order is sent, cleared once the result is
   * known. If the process dies in between, the marker lets the next start find the order
   * by its client order id instead of orphaning it.
   */
  placing?: { side: 'BUY' | 'SELL'; clientOrderId: string; at: Date }
}

interface GridPosition {
  asset: string
  symbol: string
  gridLevels: number // e.g., 10 levels
  bottomPrice: number
  topPrice: number
  investmentPerGrid: number
  gridSize: number // price difference between levels
  totalInvestment: number
  totalFilled: number // levels currently holding inventory or with a sell resting
  totalProfit: number
  tradesCompleted: number // completed buy+sell round trips
  levels: GridLevel[]
  isActive: boolean
  createdAt: Date
}

class GridTradingBot extends BaseAgent {
  config: AgentConfig = {
    name: 'grid-trading-bot',
    category: 'trading',
    version: '1.0.0',
    description: 'Grid Trading Bot - Automated buy/sell at grid levels',
    schedule: '*/10 * * * *', // Every 10 minutes
  }

  private positions: Map<string, GridPosition> = new Map()
  private priceHistory: Map<string, number[]> = new Map()
  private maxHistoryLength = 100

  /**
   * Default grids, created once around the LIVE price (never a hardcoded range).
   * Half-width of each grid is GRID_RANGE_PCT (default 4%) either side of the price.
   */
  private defaultGrids = [
    { asset: 'bitcoin', symbol: 'BTCUSDT', levels: 10, investmentPerGrid: 50 },
    { asset: 'ethereum', symbol: 'ETHUSDT', levels: 8, investmentPerGrid: 30 },
  ]
  private defaultsCreated = new Set<string>()
  private strayChecked = new Set<string>()
  private rangeState = new Map<string, 'in' | 'above' | 'below'>()

  // Persistence (see services/grid-state-store.ts)
  private store: GridStateStore | null = null
  private stateLoaded = false
  private lastSavedBody = ''
  private saveChain: Promise<unknown> = Promise.resolve()
  private lastSaveWarnAt = 0

  async execute(): Promise<void> {
    this.logger.info('📊 Grid Trading Bot: Checking grid positions...')

    try {
      // Restore saved grids first. If the saved state can't be read we must not trade:
      // starting from scratch could duplicate orders or orphan the ones already resting.
      if (!this.stateLoaded && !(await this.loadState())) return

      // Live prices only. If they can't be fetched we skip the run: the bot must
      // never trade on mock, stale or guessed prices.
      const wanted = [
        ...this.defaultGrids.filter((g) => !this.defaultsCreated.has(g.symbol)).map((g) => g.symbol),
        ...this.positions.keys(),
      ]
      const prices = await this.fetchCurrentPrices(wanted)
      if (!prices) {
        this.logger.warn('⚠️ No live prices available, skipping this run (no orders placed)')
        return
      }

      // Create default grids around the real price the first time we have one
      this.initializeDefaultPositions(prices)
      await this.persist()

      // Update all grid positions
      for (const [symbol, position] of this.positions) {
        const currentPrice = prices.get(this.toPair(symbol))

        if (!currentPrice) {
          this.logger.warn(`⚠️ No live price for ${symbol}, skipping it this run`)
          continue
        }

        // Update price history
        const history = this.priceHistory.get(position.asset) || []
        history.push(currentPrice)
        if (history.length > this.maxHistoryLength) {
          history.shift()
        }
        this.priceHistory.set(position.asset, history)

        // The grid is static: tell the operator when the market has left it
        this.warnIfOutOfRange(position, currentPrice)

        await this.warnAboutUntrackedOrders(position)

        // Check and execute grid orders
        await this.checkGridLevels(position, currentPrice)
      }

      await this.persist()
      this.logger.info('✅ Grid Trading Bot: Check completed')
    } catch (error: any) {
      const errorMsg = error?.message || 'Unknown error'
      this.logger.error(`❌ Grid Trading Bot failed: ${errorMsg}`)
      throw error
    }
  }

  /** Cancel a resting buy that has not filled after this long (default 60 min). */
  private get buyTtlMs(): number {
    const minutes = parseFloat(process.env.GRID_BUY_TTL_MIN || '60')
    return Math.min(1440, Math.max(1, Number.isFinite(minutes) ? minutes : 60)) * 60_000
  }

  /** Fee assumed on a buy only when the exchange can't tell us the real one. */
  private get feeFallback(): number {
    const f = parseFloat(process.env.GRID_FEE_FALLBACK || '0.001')
    return Math.min(0.01, Math.max(0, Number.isFinite(f) ? f : 0.001))
  }

  private async checkGridLevels(position: GridPosition, currentPrice: number): Promise<void> {
    const binance = getBinanceAPI()
    const pair = this.toPair(position.symbol)
    binance.noteLastPrice(pair, currentPrice)

    // 0. Orders whose placement was interrupted (crash, lost response): find them
    await this.resolvePlacingMarkers(position)

    // 1. Find out what happened to the orders we already have resting
    const tradesBefore = position.tradesCompleted
    await this.reconcileLevels(position, currentPrice)

    // 2. Place new orders
    for (const level of position.levels) {
      // Buy: price is inside the band just under this level
      if (
        level.status === 'pending' &&
        !level.placing &&
        currentPrice <= level.price &&
        currentPrice >= level.price * 0.98 // Within 2% of grid level
      ) {
        // Write-ahead: record the intent durably BEFORE the order exists. If we can't,
        // we don't place it, because an order we can't remember is an orphan waiting to happen.
        const clientOrderId = this.newClientOrderId(level, 'B')
        level.placing = { side: 'BUY', clientOrderId, at: new Date() }
        if (!(await this.persist())) {
          level.placing = undefined
          this.logger.error(`❌ ${pair} level ${level.level}: grid state could not be saved, not placing the buy`)
          continue
        }

        const result = await binance.placeOrder({
          symbol: pair,
          side: 'BUY',
          quantity: position.investmentPerGrid / currentPrice,
          price: currentPrice,
          orderType: 'LIMIT',
          clientOrderId,
        })
        level.placing = undefined

        if (!result) {
          await this.persist()
          this.logger.error(
            `❌ Failed to place buy order for ${pair}: ${binance.getLastOrderError()?.message ?? 'unknown reason'}`
          )
          continue
        }

        // The order is resting, not filled: it only counts once the exchange says so
        level.status = 'buy_open'
        level.buyOrderId = result.orderId.toString()
        level.buyOrderPlacedAt = new Date()
        await this.persist()

        this.logger.info(
          `${result.simulated ? '🧪 [DRY RUN] ' : ''}🛒 GRID BUY placed, level ${level.level}: ${result.quantity} ${pair} @ $${result.price} | Order ID: ${result.orderId}`
        )
        this.emit('grid-buy-order', {
          symbol: position.symbol,
          level: level.level,
          price: result.price,
          quantity: result.quantity,
          amount: position.investmentPerGrid,
          orderId: result.orderId,
          simulated: result.simulated === true,
          timestamp: new Date(),
        })

        // A limit order that crosses the book can fill immediately
        if (result.executedQty > 0 && result.executedQty >= result.quantity) {
          await this.onBuyFilled(
            position,
            level,
            { executedQty: result.executedQty, cummulativeQuoteQty: result.cummulativeQuoteQty },
            result.fills
          )
        }
      }

      // Sell: we hold coins from this level and price reached the 2% target
      if (level.status === 'filled' && !level.placing && level.heldQty && currentPrice >= level.price * 1.02) {
        const clientOrderId = this.newClientOrderId(level, 'S')
        level.placing = { side: 'SELL', clientOrderId, at: new Date() }
        if (!(await this.persist())) {
          level.placing = undefined
          this.logger.error(`❌ ${pair} level ${level.level}: grid state could not be saved, not placing the sell`)
          continue
        }

        const result = await binance.placeOrder({
          symbol: pair,
          side: 'SELL',
          quantity: level.heldQty, // exactly what we hold (net of fees), not what we meant to buy
          price: currentPrice,
          orderType: 'LIMIT',
          clientOrderId,
        })
        level.placing = undefined

        if (!result) {
          await this.persist()
          this.logger.error(
            `❌ Failed to place sell order for ${pair}: ${binance.getLastOrderError()?.message ?? 'unknown reason'}`
          )
          continue
        }

        level.status = 'sell_open'
        level.sellOrderId = result.orderId.toString()
        await this.persist()

        this.logger.info(
          `${result.simulated ? '🧪 [DRY RUN] ' : ''}💱 GRID SELL placed, level ${level.level}: ${result.quantity} ${pair} @ $${result.price} | Order ID: ${result.orderId}`
        )
        this.emit('grid-sell-placed', {
          symbol: position.symbol,
          level: level.level,
          price: result.price,
          quantity: result.quantity,
          orderId: result.orderId,
          simulated: result.simulated === true,
          timestamp: new Date(),
        })

        if (result.executedQty > 0 && result.executedQty >= result.quantity) {
          await this.onSellFilled(
            position,
            level,
            { executedQty: result.executedQty, cummulativeQuoteQty: result.cummulativeQuoteQty },
            result.fills,
            result.simulated === true
          )
        }
      }
    }

    await this.persist()

    position.totalFilled = position.levels.filter((l) => l.status === 'filled' || l.status === 'sell_open').length

    const executedTrades = position.tradesCompleted - tradesBefore
    if (executedTrades > 0) {
      this.logger.info(
        `📈 Grid Summary ${position.symbol}: ${executedTrades} trades completed | Total profit: $${position.totalProfit.toFixed(4)}`
      )

      this.emit('grid-summary', {
        symbol: position.symbol,
        tradesExecuted: executedTrades,
        totalProfit: position.totalProfit,
        filledLevels: position.totalFilled,
        gridRange: `$${position.bottomPrice.toFixed(2)} - $${position.topPrice.toFixed(2)}`,
        timestamp: new Date(),
      })
    }
  }

  // ---------------------------------------------------------------------------
  // Persistence: grids, resting order ids, holdings and profit survive a restart
  // ---------------------------------------------------------------------------

  private newClientOrderId(level: GridLevel, side: 'B' | 'S'): string {
    return `g${level.level}${side}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`
  }

  private stateKey(): string {
    return `grid:${getBinanceAPI().isTestnet() ? 'testnet' : 'mainnet'}`
  }

  private getStore(): GridStateStore {
    if (!this.store) this.store = createGridStateStore(this.db)
    return this.store
  }

  /** Orders in the saved state that were simulated (negative id) are not real: drop them. */
  private sanitizeLevel(level: GridLevel, fresh: () => GridLevel): GridLevel {
    const simulated = Number(level.buyOrderId) < 0 || Number(level.sellOrderId) < 0
    return simulated ? fresh() : level
  }

  private snapshotBody() {
    return {
      version: 1,
      network: getBinanceAPI().isTestnet() ? 'testnet' : 'mainnet',
      defaultsCreated: [...this.defaultsCreated],
      positions: [...this.positions.values()].map((p) => ({
        ...p,
        // Levels that were only ever simulated (dry run) must never be saved as if they were real
        levels: p.levels.map((l) =>
          this.sanitizeLevel(l, () => ({ level: l.level, price: l.price, status: 'pending' as LevelStatus }))
        ),
      })),
    }
  }

  /**
   * Save the grid state. Returns false only if it could not be written (callers placing
   * an order treat that as "do not place"). Nothing is saved before the previous state
   * has been loaded, and nothing is saved while orders are blocked (dry run / mainnet gate):
   * simulated orders are not real and there is nothing to protect.
   */
  private async persist(): Promise<boolean> {
    if (!this.stateLoaded) return true
    const store = this.getStore()
    if (store.kind === 'off') return true
    if (orderBlockReason(getBinanceAPI().isTestnet()) !== null) return true

    const body = JSON.stringify(this.snapshotBody())
    if (body === this.lastSavedBody) return true

    const key = this.stateKey()
    const write = this.saveChain.then(async () => {
      await store.save(key, JSON.stringify({ savedAt: new Date().toISOString(), ...JSON.parse(body) }))
    })
    this.saveChain = write.catch(() => undefined) // one failed write must not block later ones

    try {
      await write
      this.lastSavedBody = body
      return true
    } catch (error: any) {
      if (Date.now() - this.lastSaveWarnAt > 60_000) {
        this.lastSaveWarnAt = Date.now()
        this.logger.error(`❌ Could not save grid state (${store.kind}): ${error?.message ?? error}`)
      }
      return false
    }
  }

  /**
   * Restore saved grids. Returns true when it is safe to carry on (state restored, or
   * clean first run) and false when the saved state could not be read or is unusable,
   * in which case this run does nothing and the next run tries again.
   */
  private async loadState(): Promise<boolean> {
    const store = this.getStore()
    if (store.kind === 'off') {
      this.stateLoaded = true
      return true
    }

    let saved: any
    try {
      const raw = await store.load(this.stateKey())
      saved = raw === null ? null : parseStateJson(raw)
      if (saved !== null) this.validateSaved(saved)
    } catch (error: any) {
      if (error instanceof CorruptStateError) {
        this.logger.error(
          `🛑 Saved grid state (${store.kind}, ${this.stateKey()}) is unusable: ${error.message}. ` +
            `Not trading, so resting orders are not orphaned. Fix or delete the saved state ` +
            `(file: data/${this.stateKey().replace(/[^A-Za-z0-9_.-]+/g, '-')}.json, or DELETE FROM grid_state WHERE key='${this.stateKey()}') ` +
            `and cancel any stale orders on the exchange.`
        )
      } else {
        this.logger.error(
          `🛑 Could not read saved grid state (${store.kind}): ${error?.message ?? error}. Not trading this run; will retry.`
        )
      }
      return false
    }

    if (saved === null) {
      this.stateLoaded = true
      this.logger.info(`🆕 No saved grid state (${store.kind}), starting fresh`)
      return true
    }

    let restored = 0
    for (const position of saved.positions as GridPosition[]) {
      const inMemory = this.positions.get(position.symbol)
      const hasOrders = position.levels.some((l) => l.status !== 'pending' || l.placing)
      if (inMemory && !hasOrders) continue // a grid added explicitly before start wins when nothing is at stake
      if (inMemory && hasOrders) {
        this.logger.warn(
          `⚠️ ${position.symbol}: ignoring the grid just added in code, because the saved grid has resting orders or holdings`
        )
      }
      this.positions.set(position.symbol, position)
      restored++
    }
    for (const symbol of saved.defaultsCreated ?? []) this.defaultsCreated.add(symbol)

    this.stateLoaded = true
    this.lastSavedBody = '' // force the first save to re-write the (possibly merged) state

    const levels = [...this.positions.values()].flatMap((p) => p.levels)
    this.logger.info(
      `♻️ Restored ${restored} grid(s) from ${store.kind}: ${levels.filter((l) => l.status === 'buy_open' || l.status === 'sell_open').length} resting order(s), ` +
        `${levels.filter((l) => l.status === 'filled').length} holding coins, ` +
        `profit $${[...this.positions.values()].reduce((a, p) => a + p.totalProfit, 0).toFixed(4)}`
    )
    return true
  }

  private validateSaved(saved: any): void {
    if (!saved || typeof saved !== 'object' || saved.version !== 1 || !Array.isArray(saved.positions)) {
      throw new CorruptStateError('unexpected format or version')
    }
    for (const p of saved.positions) {
      if (typeof p?.symbol !== 'string' || !Array.isArray(p.levels) || typeof p.investmentPerGrid !== 'number') {
        throw new CorruptStateError(`malformed position ${JSON.stringify(p?.symbol)}`)
      }
      for (const l of p.levels) {
        if (typeof l?.level !== 'number' || typeof l.price !== 'number' || typeof l.status !== 'string') {
          throw new CorruptStateError(`malformed level in ${p.symbol}`)
        }
      }
    }
    const network = getBinanceAPI().isTestnet() ? 'testnet' : 'mainnet'
    if (saved.network && saved.network !== network) {
      throw new CorruptStateError(`state belongs to ${saved.network}, but this process trades on ${network}`)
    }
  }

  /**
   * A level with a write-ahead marker had an order placement in flight when we last stopped
   * or lost the response. Look the order up by its client order id: adopt it if it exists,
   * clear the marker if it definitely does not, and keep waiting if we can't tell.
   */
  private async resolvePlacingMarkers(position: GridPosition): Promise<void> {
    const pair = this.toPair(position.symbol)
    let changed = false

    for (const level of position.levels) {
      if (!level.placing) continue
      const { side, clientOrderId } = level.placing
      const { order, missing } = await getBinanceAPI().getOrderByClientId(pair, clientOrderId)

      if (order) {
        if (side === 'BUY') {
          level.status = 'buy_open'
          level.buyOrderId = String(order.orderId)
          level.buyOrderPlacedAt = new Date(order.timestamp)
        } else {
          level.status = 'sell_open'
          level.sellOrderId = String(order.orderId)
        }
        this.logger.warn(
          `♻️ ${pair} level ${level.level}: found the ${side} order that was in flight (#${order.orderId}, ${order.status}), tracking it again`
        )
        level.placing = undefined
        changed = true
      } else if (missing) {
        this.logger.info(`↩️ ${pair} level ${level.level}: the ${side} order in flight never reached the exchange, level reset`)
        level.placing = undefined
        changed = true
      } else {
        this.logger.warn(`⚠️ ${pair} level ${level.level}: cannot tell if the ${side} order in flight exists, waiting`)
      }
    }

    if (changed) await this.persist()
  }

  /**
   * Grid state lives in memory, so after a restart any orders still resting on the
   * exchange are no longer tracked. Once per symbol per process, look for them and
   * warn (read-only; nothing is cancelled).
   */
  private async warnAboutUntrackedOrders(position: GridPosition): Promise<void> {
    const pair = this.toPair(position.symbol)
    if (this.strayChecked.has(pair)) return
    this.strayChecked.add(pair)

    const open = await getBinanceAPI().getOpenOrders(pair)
    if (!open || open.length === 0) return

    const tracked = new Set(
      position.levels.flatMap((l) => [l.buyOrderId, l.sellOrderId]).filter(Boolean) as string[]
    )
    const stray = open.filter((o) => !tracked.has(String(o.orderId)))
    if (stray.length > 0) {
      this.logger.warn(
        `⚠️ ${pair}: ${stray.length} open order(s) on the exchange are not tracked by this grid ` +
          `(e.g. left over from before a restart): ${stray
            .slice(0, 5)
            .map((o) => `${o.side} ${o.origQty}@${o.price} #${o.orderId}`)
            .join(', ')}. Cancel them manually if they are stale.`
      )
    }
  }

  /** Update every level with an open order from what the exchange reports. */
  private async reconcileLevels(position: GridPosition, currentPrice: number): Promise<void> {
    const binance = getBinanceAPI()
    const pair = this.toPair(position.symbol)

    for (const level of position.levels) {
      if (level.placing) continue // placement not resolved yet; handled by resolvePlacingMarkers
      if (level.status === 'buy_open' && level.buyOrderId) {
        const orderId = Number(level.buyOrderId)
        let status = await binance.getOrderStatus(pair, orderId)
        if (!status) {
          this.logger.warn(`⚠️ ${pair} level ${level.level}: could not read buy order ${orderId}, will retry next run`)
          continue
        }

        // A buy that has been resting too long is cancelled so capital isn't tied up
        // chasing a price that has moved away; whatever filled so far is kept.
        const open = !this.isTerminal(status.status)
        const age = Date.now() - (level.buyOrderPlacedAt?.getTime() ?? Date.now())
        if (open && status.status !== 'FILLED' && age > this.buyTtlMs) {
          this.logger.info(`⏱️ ${pair} level ${level.level}: buy ${orderId} unfilled after ${Math.round(age / 60000)} min, cancelling`)
          await binance.cancelOrder(pair, orderId)
          const after = await binance.getOrderStatus(pair, orderId)
          if (after) status = after
        }

        if (status.status === 'FILLED' || status.executedQty > 0) {
          if (status.status !== 'FILLED' && !this.isTerminal(status.status)) continue // part-filled, still resting
          await this.onBuyFilled(position, level, status)
        } else if (this.isTerminal(status.status)) {
          this.logger.info(`↩️ ${pair} level ${level.level}: buy ${orderId} ${status.status} with nothing filled, level reset`)
          this.resetLevel(level)
        }
      } else if (level.status === 'sell_open' && level.sellOrderId) {
        const orderId = Number(level.sellOrderId)
        const status = await binance.getOrderStatus(pair, orderId)
        if (!status) {
          this.logger.warn(`⚠️ ${pair} level ${level.level}: could not read sell order ${orderId}, will retry next run`)
          continue
        }

        if (status.status === 'FILLED') {
          await this.onSellFilled(position, level, status, undefined, status.simulated === true)
        } else if (this.isTerminal(status.status)) {
          // Sell cancelled/expired: we still hold what was not sold and can try again
          const sold = status.executedQty
          if (sold > 0 && level.heldQty !== undefined) level.heldQty = Math.max(0, level.heldQty - sold)
          this.logger.warn(`↩️ ${pair} level ${level.level}: sell ${orderId} ${status.status}, still holding ${level.heldQty}`)
          level.status = level.heldQty && level.heldQty > 0 ? 'filled' : 'pending'
          level.sellOrderId = undefined
        }
        // else: still resting at the target price, which is the point of a grid
      }
    }
  }

  private isTerminal(status: string): boolean {
    return ['FILLED', 'CANCELED', 'EXPIRED', 'EXPIRED_IN_MATCH', 'REJECTED'].includes(status)
  }

  private resetLevel(level: GridLevel): void {
    level.status = 'pending'
    level.buyOrderId = undefined
    level.sellOrderId = undefined
    level.buyOrderPlacedAt = undefined
    level.buyFilledAt = undefined
    level.placing = undefined
    level.heldQty = undefined
    level.buyNetQty = undefined
    level.buyCost = undefined
    level.buyAvgPrice = undefined
  }

  /** Fees, split by asset, from the fills of one order. */
  private sumFills(fills: Array<Pick<TradeInfo, 'qty' | 'commission' | 'commissionAsset'>>, asset: string) {
    return {
      qty: fills.reduce((a, f) => a + f.qty, 0),
      fee: fills.filter((f) => f.commissionAsset === asset).reduce((a, f) => a + f.commission, 0),
    }
  }

  private async assets(pair: string): Promise<{ base: string; quote: string }> {
    const rules = await getBinanceAPI().getSymbolRules(pair)
    const quote = rules?.quoteAsset ?? (pair.match(/(USDT|BUSD|USDC|FDUSD)$/)?.[1] || 'USDT')
    return { base: rules?.baseAsset ?? pair.slice(0, pair.length - quote.length), quote }
  }

  /** A buy filled (fully, or partially then cancelled): record what we actually hold. */
  private async onBuyFilled(
    position: GridPosition,
    level: GridLevel,
    status: Pick<OrderStatusInfo, 'executedQty' | 'cummulativeQuoteQty'>,
    knownFills?: OrderFill[]
  ): Promise<void> {
    const binance = getBinanceAPI()
    const pair = this.toPair(position.symbol)
    const { base } = await this.assets(pair)

    // Spot charges the buy fee in the base asset, so we hold less than we bought
    const fills: Array<Pick<TradeInfo, 'qty' | 'commission' | 'commissionAsset'>> | null =
      knownFills && knownFills.length > 0
        ? knownFills
        : await binance.getOrderTrades(pair, Number(level.buyOrderId))

    let net: number
    let estimated = false
    if (fills && fills.length > 0) {
      const { qty, fee } = this.sumFills(fills, base)
      net = qty - fee
    } else {
      net = status.executedQty * (1 - this.feeFallback)
      estimated = true
    }

    const rules = await binance.getSymbolRules(pair)
    const held = rules ? roundQuantity(net, rules) : net

    level.status = 'filled'
    level.heldQty = held
    level.buyNetQty = net
    level.buyCost = status.cummulativeQuoteQty
    level.buyAvgPrice = status.executedQty > 0 ? status.cummulativeQuoteQty / status.executedQty : level.price
    level.buyFilledAt = new Date()

    this.logger.info(
      `✅ GRID BUY filled, level ${level.level}: ${pair} bought ${status.executedQty} for $${status.cummulativeQuoteQty.toFixed(4)}, ` +
        `holding ${held} ${base}${estimated ? ` (fee ESTIMATED at ${(this.feeFallback * 100).toFixed(2)}%: trade list unavailable)` : ''}`
    )
    this.emit('grid-buy-filled', {
      symbol: position.symbol,
      level: level.level,
      orderId: Number(level.buyOrderId),
      executedQty: status.executedQty,
      heldQty: held,
      cost: status.cummulativeQuoteQty,
      feeEstimated: estimated,
      timestamp: new Date(),
    })
  }

  /** A sell filled: book profit from the real proceeds and cost, then free the level. */
  private async onSellFilled(
    position: GridPosition,
    level: GridLevel,
    status: Pick<OrderStatusInfo, 'executedQty' | 'cummulativeQuoteQty'>,
    knownFills: OrderFill[] | undefined,
    simulated: boolean
  ): Promise<void> {
    const binance = getBinanceAPI()
    const pair = this.toPair(position.symbol)
    const { quote } = await this.assets(pair)

    const fills: Array<Pick<TradeInfo, 'qty' | 'commission' | 'commissionAsset'>> | null =
      knownFills && knownFills.length > 0
        ? knownFills
        : await binance.getOrderTrades(pair, Number(level.sellOrderId))

    // Sell fees come out of the quote asset. Fees paid in another asset (e.g. BNB)
    // can't be netted here, so profit is then slightly overstated.
    const fee = fills ? this.sumFills(fills, quote).fee : 0
    const proceeds = status.cummulativeQuoteQty - fee
    // Rounding down to the step leaves a little unsellable dust. It is still an asset,
    // so only the cost of the coins actually sold is set against the proceeds.
    const boughtNet = level.buyNetQty ?? 0
    const fullCost = level.buyCost ?? 0
    const cost = boughtNet > 0 ? fullCost * Math.min(1, status.executedQty / boughtNet) : fullCost
    const profit = proceeds - cost
    const avgSell = status.executedQty > 0 ? status.cummulativeQuoteQty / status.executedQty : 0

    position.totalProfit += profit
    position.tradesCompleted++

    this.logger.info(
      `💰 ${simulated ? '🧪 [DRY RUN] ' : ''}GRID SELL filled, level ${level.level}: ${pair} @ $${avgSell.toFixed(2)} | ` +
        `Profit: $${profit.toFixed(4)} (proceeds $${proceeds.toFixed(4)} - cost $${cost.toFixed(4)})`
    )
    this.emit('grid-sell-order', {
      symbol: position.symbol,
      level: level.level,
      buyPrice: level.buyAvgPrice ?? level.price,
      sellPrice: avgSell,
      profit,
      profitPercent: cost > 0 ? (profit / cost) * 100 : 0,
      orderId: Number(level.sellOrderId),
      simulated,
      timestamp: new Date(),
    })

    this.resetLevel(level) // ready for the next cycle
  }

  /** "BTC" -> "BTCUSDT"; symbols that already carry a quote asset are unchanged. */
  private toPair(symbol: string): string {
    return /(USDT|BUSD|USDC|FDUSD)$/.test(symbol) ? symbol : `${symbol}USDT`
  }

  /**
   * Live prices from the venue we trade on (BinanceAPI uses the testnet or
   * mainnet ticker matching its order endpoint). Returns null if none could be
   * fetched; invalid values (non-finite, <= 0) are discarded.
   */
  private async fetchCurrentPrices(symbols: string[]): Promise<Map<string, number> | null> {
    const pairs = [...new Set(symbols.map((s) => this.toPair(s)))]
    if (pairs.length === 0) return new Map()

    const raw = await getBinanceAPI().getPrices(pairs)
    if (!raw) return null

    const prices = new Map<string, number>()
    for (const [pair, price] of Object.entries(raw)) {
      if (Number.isFinite(price) && price > 0) prices.set(pair, price)
    }
    return prices.size > 0 ? prices : null
  }

  private warnIfOutOfRange(position: GridPosition, price: number): void {
    const state = price > position.topPrice ? 'above' : price < position.bottomPrice * 0.98 ? 'below' : 'in'
    if (this.rangeState.get(position.symbol) === state) return
    this.rangeState.set(position.symbol, state)

    if (state !== 'in') {
      this.logger.warn(
        `⚠️ ${position.symbol} price $${price.toFixed(2)} is ${state} the grid ` +
          `($${position.bottomPrice.toFixed(2)} - $${position.topPrice.toFixed(2)}): no buys will trigger until it returns` +
          ` or the grid is re-centered (recenterGridPosition)`
      )
    } else {
      this.logger.info(`✅ ${position.symbol} price is back inside the grid range`)
    }
  }

  // Public methods
  addGridPosition(
    asset: string,
    symbol: string,
    gridLevels: number,
    bottomPrice: number,
    topPrice: number,
    investmentPerGrid: number
  ): void {
    const gridSize = (topPrice - bottomPrice) / gridLevels
    const levels: GridLevel[] = []

    // Create grid levels from bottom to top
    for (let i = 0; i < gridLevels; i++) {
      const levelPrice = bottomPrice + gridSize * i
      levels.push({
        level: i + 1,
        price: levelPrice,
        status: 'pending',
      })
    }

    const position: GridPosition = {
      asset,
      symbol,
      gridLevels,
      bottomPrice,
      topPrice,
      investmentPerGrid,
      gridSize,
      totalInvestment: gridLevels * investmentPerGrid,
      totalFilled: 0,
      totalProfit: 0,
      tradesCompleted: 0,
      levels,
      isActive: true,
      createdAt: new Date(),
    }

    this.positions.set(symbol, position)
    this.logger.info(
      `✅ Added grid position: ${symbol} | ${gridLevels} levels | $${bottomPrice.toFixed(2)} - $${topPrice.toFixed(2)}`
    )
  }

  removeGridPosition(symbol: string): void {
    const existing = this.positions.get(symbol)
    const active = existing?.levels.filter((l) => l.status !== 'pending').length ?? 0
    if (active > 0) {
      this.logger.warn(
        `⚠️ Removing ${symbol} while ${active} level(s) have resting orders or hold coins: ` +
          `those orders stay on the exchange and will no longer be tracked`
      )
    }
    if (this.positions.delete(symbol)) {
      this.logger.info(`✅ Removed grid position: ${symbol}`)
    }
  }

  getPositions(): GridPosition[] {
    return Array.from(this.positions.values())
  }

  /** One-line-per-grid snapshot for monitoring (read-only). */
  getStatus(): Array<{
    symbol: string
    price: number | undefined
    bottomPrice: number
    topPrice: number
    openBuys: number
    holding: number
    openSells: number
    heldQty: number
    tradesCompleted: number
    profit: number
  }> {
    return this.getPositions().map((p) => {
      const history = this.priceHistory.get(p.asset)
      const count = (status: LevelStatus) => p.levels.filter((l) => l.status === status).length
      return {
        symbol: p.symbol,
        price: history && history.length > 0 ? history[history.length - 1] : undefined,
        bottomPrice: p.bottomPrice,
        topPrice: p.topPrice,
        openBuys: count('buy_open'),
        holding: count('filled'),
        openSells: count('sell_open'),
        heldQty: p.levels.reduce((a, l) => a + ((l.status === 'filled' || l.status === 'sell_open') ? l.heldQty ?? 0 : 0), 0),
        tradesCompleted: p.tradesCompleted,
        profit: p.totalProfit,
      }
    })
  }

  getPositionBySymbol(symbol: string): GridPosition | undefined {
    return this.positions.get(symbol)
  }

  getGridStats(symbol: string): {
    totalProfit: number
    tradesCompleted: number
    fillRate: number
  } | null {
    const position = this.positions.get(symbol)
    if (!position) return null

    const active = position.levels.filter((l) => l.status !== 'pending').length
    const fillRate = (active / position.gridLevels) * 100

    return {
      totalProfit: position.totalProfit,
      tradesCompleted: position.tradesCompleted,
      fillRate, // share of levels currently holding coins or with an order resting
    }
  }

  private initializeDefaultPositions(prices: Map<string, number>): void {
    const halfRange = Math.min(0.5, Math.max(0.005, parseFloat(process.env.GRID_RANGE_PCT || '0.04') || 0.04))

    for (const grid of this.defaultGrids) {
      if (this.defaultsCreated.has(grid.symbol)) continue
      const price = prices.get(grid.symbol)
      if (!price) continue // no live price yet: try again next run

      this.addGridPosition(
        grid.asset,
        grid.symbol,
        grid.levels,
        price * (1 - halfRange),
        price * (1 + halfRange),
        grid.investmentPerGrid
      )
      this.defaultsCreated.add(grid.symbol)
      this.logger.info(
        `📍 ${grid.symbol} grid centered on live price $${price.toFixed(2)} (±${(halfRange * 100).toFixed(1)}%)`
      )
    }
  }

  /**
   * Rebuild a grid around the current live price (same width, level count and
   * investment; profit history kept). Refuses while any level has a resting order
   * or holds coins, because re-centering would orphan them. Returns whether it ran.
   */
  async recenterGridPosition(symbol: string): Promise<boolean> {
    const position = this.positions.get(symbol)
    if (!position) return false

    if (position.levels.some((l) => l.status !== 'pending')) {
      this.logger.warn(`⚠️ ${symbol}: not re-centering, some levels have resting orders or hold coins`)
      return false
    }

    const prices = await this.fetchCurrentPrices([symbol])
    const price = prices?.get(this.toPair(symbol))
    if (!price) {
      this.logger.warn(`⚠️ ${symbol}: no live price, grid not re-centered`)
      return false
    }

    const halfWidth = (position.topPrice - position.bottomPrice) / 2
    const { totalProfit, tradesCompleted, createdAt } = position
    this.addGridPosition(
      position.asset,
      position.symbol,
      position.gridLevels,
      price - halfWidth,
      price + halfWidth,
      position.investmentPerGrid
    )
    const rebuilt = this.positions.get(symbol)!
    rebuilt.totalProfit = totalProfit
    rebuilt.tradesCompleted = tradesCompleted
    rebuilt.createdAt = createdAt
    this.rangeState.delete(symbol)
    this.logger.info(`🔁 ${symbol} grid re-centered on live price $${price.toFixed(2)}`)
    return true
  }
}

export const gridTradingBot = new GridTradingBot()
