/**
 * Agent #8: Grid Trading Bot
 * Places buy/sell orders at predetermined price levels (grid)
 * Profits from market volatility between grid levels
 */

import { BaseAgent, AgentConfig } from '../base-agent'
import { getBinanceAPI } from '../services/binance-api'

interface GridLevel {
  level: number
  price: number
  buyOrderId?: string
  sellOrderId?: string
  status: 'pending' | 'filled' | 'cancelled'
  buyFilledAt?: Date
  soldAt?: Date
  profit?: number
  profitPercent?: number
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
  totalFilled: number
  totalProfit: number
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
  private rangeState = new Map<string, 'in' | 'above' | 'below'>()

  async execute(): Promise<void> {
    this.logger.info('📊 Grid Trading Bot: Checking grid positions...')

    try {
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

        // Check and execute grid orders
        await this.checkGridLevels(position, currentPrice)
      }

      this.logger.info('✅ Grid Trading Bot: Check completed')
    } catch (error: any) {
      const errorMsg = error?.message || 'Unknown error'
      this.logger.error(`❌ Grid Trading Bot failed: ${errorMsg}`)
      throw error
    }
  }

  private async checkGridLevels(position: GridPosition, currentPrice: number): Promise<void> {
    const binance = getBinanceAPI()
    let filledCount = 0
    let executedTrades = 0

    for (const level of position.levels) {
      // Check if we should buy
      if (
        level.status === 'pending' &&
        currentPrice <= level.price &&
        currentPrice >= level.price * 0.98 // Within 2% of grid level
      ) {
        // Place real Binance order
        const orderResult = await binance.placeOrder({
          symbol: position.symbol,
          side: 'BUY',
          quantity: position.investmentPerGrid / currentPrice,
          price: currentPrice,
          orderType: 'LIMIT',
        })

        if (orderResult) {
          level.status = 'filled'
          level.buyOrderId = orderResult.orderId.toString()
          level.buyFilledAt = new Date()
          filledCount++

          this.logger.info(
            `✅ ${orderResult.simulated ? '🧪 [DRY RUN] ' : ''}GRID BUY Level ${level.level}: ${position.symbol} @ $${currentPrice.toFixed(2)} | Order ID: ${orderResult.orderId}`
          )

          this.emit('grid-buy-order', {
            symbol: position.symbol,
            level: level.level,
            price: currentPrice,
            amount: position.investmentPerGrid,
            orderId: orderResult.orderId,
            simulated: orderResult.simulated === true,
            timestamp: new Date(),
          })
        } else {
          this.logger.error(`❌ Failed to place buy order for ${position.symbol}`)
        }
      }

      // Check if we should sell (price bounced up)
      if (level.status === 'filled' && !level.soldAt && currentPrice >= level.price * 1.02) {
        // 2% profit target - place real Binance order
        const sellOrderResult = await binance.placeOrder({
          symbol: position.symbol,
          side: 'SELL',
          quantity: position.investmentPerGrid / level.price,
          price: currentPrice,
          orderType: 'LIMIT',
        })

        if (sellOrderResult) {
          level.soldAt = new Date()
          level.sellOrderId = sellOrderResult.orderId.toString()
          level.profit = (currentPrice - level.price) * (position.investmentPerGrid / level.price)
          level.profitPercent = ((currentPrice - level.price) / level.price) * 100

          position.totalProfit += level.profit
          executedTrades++

          this.logger.info(
            `💰 ${sellOrderResult.simulated ? '🧪 [DRY RUN] ' : ''}GRID SELL Level ${level.level}: ${position.symbol} @ $${currentPrice.toFixed(2)} | Profit: $${level.profit.toFixed(2)} | Order ID: ${sellOrderResult.orderId}`
          )

          this.emit('grid-sell-order', {
            symbol: position.symbol,
            level: level.level,
            buyPrice: level.price,
            sellPrice: currentPrice,
            profit: level.profit,
            profitPercent: level.profitPercent,
            orderId: sellOrderResult.orderId,
            simulated: sellOrderResult.simulated === true,
            timestamp: new Date(),
          })

          // Reset level for next cycle
          level.status = 'pending'
          level.buyFilledAt = undefined
          level.soldAt = undefined
        } else {
          this.logger.error(`❌ Failed to place sell order for ${position.symbol}`)
        }
      }
    }

    position.totalFilled = filledCount

    // Log summary
    if (executedTrades > 0) {
      this.logger.info(
        `📈 Grid Summary ${position.symbol}: ${executedTrades} trades executed | Total profit: $${position.totalProfit.toFixed(2)}`
      )

      this.emit('grid-summary', {
        symbol: position.symbol,
        tradesExecuted: executedTrades,
        totalProfit: position.totalProfit,
        filledLevels: filledCount,
        gridRange: `$${position.bottomPrice.toFixed(2)} - $${position.topPrice.toFixed(2)}`,
        timestamp: new Date(),
      })
    }
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
    if (this.positions.delete(symbol)) {
      this.logger.info(`✅ Removed grid position: ${symbol}`)
    }
  }

  getPositions(): GridPosition[] {
    return Array.from(this.positions.values())
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

    const filledLevels = position.levels.filter((l) => l.soldAt).length
    const fillRate = (filledLevels / position.gridLevels) * 100

    return {
      totalProfit: position.totalProfit,
      tradesCompleted: filledLevels,
      fillRate,
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
   * investment; profit history kept). Refuses while any level holds a buy,
   * because re-centering would orphan that inventory. Returns whether it ran.
   */
  async recenterGridPosition(symbol: string): Promise<boolean> {
    const position = this.positions.get(symbol)
    if (!position) return false

    if (position.levels.some((l) => l.status === 'filled')) {
      this.logger.warn(`⚠️ ${symbol}: not re-centering, some levels still hold open buys`)
      return false
    }

    const prices = await this.fetchCurrentPrices([symbol])
    const price = prices?.get(this.toPair(symbol))
    if (!price) {
      this.logger.warn(`⚠️ ${symbol}: no live price, grid not re-centered`)
      return false
    }

    const halfWidth = (position.topPrice - position.bottomPrice) / 2
    const { totalProfit, createdAt } = position
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
    rebuilt.createdAt = createdAt
    this.rangeState.delete(symbol)
    this.logger.info(`🔁 ${symbol} grid re-centered on live price $${price.toFixed(2)}`)
    return true
  }
}

export const gridTradingBot = new GridTradingBot()
