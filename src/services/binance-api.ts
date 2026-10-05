/**
 * Binance API Service
 * Real order execution on testnet and mainnet
 *
 * Orders are rounded and validated against the symbol's exchange filters
 * (tick size, step size, min quantity, min notional) before anything is sent, and
 * results carry fill and fee information so callers can track what actually
 * executed. See ./order-rounding.ts.
 */

import axios from 'axios'
import crypto from 'crypto'
import { Logger } from '../logger'
import { orderBlockReason, parseDryRun, mainnetOrdersAllowed } from '../dry-run'
import { parseSymbolRules, prepareOrder, SymbolRules } from './order-rounding'

export interface BinanceOrder {
  symbol: string
  side: 'BUY' | 'SELL'
  quantity: number
  price?: number
  orderType?: 'LIMIT' | 'MARKET'
  /**
   * Caller-chosen id (1-36 chars of A-Z a-z 0-9 - _). Lets a caller record its intent
   * before the order exists and look the order up again after a crash.
   */
  clientOrderId?: string
}

export interface OrderFill {
  price: number
  qty: number
  commission: number
  commissionAsset: string
}

export interface BinanceOrderResult {
  orderId: number
  symbol: string
  side: string
  /** Quantity actually ordered, after rounding to the exchange's step size. */
  quantity: number
  /** Price actually ordered, after rounding to the exchange's tick size. */
  price: number
  status: string
  timestamp: number
  /** Filled so far (a LIMIT order that crosses the book can fill immediately). */
  executedQty: number
  cummulativeQuoteQty: number
  fills?: OrderFill[]
  /** True when orders are blocked (dry run / mainnet gate): nothing was sent. */
  simulated?: boolean
  /** True when exchange rules were unavailable, so the order was not rounded/validated (simulated orders only). */
  unvalidated?: boolean
}

export interface OrderStatusInfo {
  orderId: number
  status: string
  executedQty: number
  origQty: number
  price: number
  side: string
  cummulativeQuoteQty: number
  updateTime: number
  simulated?: boolean
}

export interface TradeInfo {
  orderId: number
  price: number
  qty: number
  quoteQty: number
  commission: number
  commissionAsset: string
}

export interface OrderError {
  code: number | string | undefined
  message: string
}

interface BinanceBalance {
  asset: string
  free: string
  locked: string
}

interface SimOrder {
  result: BinanceOrderResult
  state: 'NEW' | 'FILLED' | 'CANCELED'
  executedQty: number
  quoteQty: number
  trades: TradeInfo[]
}

const RULES_TTL_MS = 60 * 60 * 1000
/** Fee charged by the dry-run fill model (Binance spot default is 0.1%). */
const SIM_FEE_RATE = 0.001

export class BinanceAPI {
  private apiKey: string
  private apiSecret: string
  private baseUrl: string
  private logger = new Logger('BinanceAPI')
  private useTestnet: boolean
  private dryRunOrders: BinanceOrderResult[] = []
  private simOrders = new Map<number, SimOrder>()
  private nextSimulatedOrderId = -1
  private rulesCache = new Map<string, { rules: SymbolRules; fetchedAt: number }>()
  private lastPrices = new Map<string, number>()
  private lastOrderError: OrderError | null = null

  constructor(apiKey: string, apiSecret: string, useTestnet: boolean = true) {
    this.apiKey = apiKey
    this.apiSecret = apiSecret
    this.useTestnet = useTestnet
    this.baseUrl = useTestnet
      ? 'https://testnet.binance.vision/api'
      : 'https://api.binance.com/api'

    const { dryRun, recognized } = parseDryRun(process.env.DRY_RUN)
    if (!recognized) {
      this.logger.warn(`⚠️ Unrecognised DRY_RUN value "${process.env.DRY_RUN}", treating as dry run`)
    }
    if (dryRun) {
      this.logger.info('🧪 DRY RUN is ON: orders will be simulated, none sent to Binance')
    } else if (!useTestnet && !mainnetOrdersAllowed()) {
      this.logger.warn(
        '🛑 MAINNET selected but ALLOW_MAINNET_ORDERS is not "true": orders will be simulated, none sent. ' +
          'Set ALLOW_MAINNET_ORDERS=true to trade real money.'
      )
    } else {
      this.logger.info(
        `⚠️ LIVE ORDERS enabled on ${useTestnet ? 'TESTNET' : 'MAINNET (REAL MONEY)'}. Set DRY_RUN=true to block orders`
      )
    }
  }

  /** Orders simulated while orders were blocked (newest last), for inspection and tests. */
  getDryRunOrders(): BinanceOrderResult[] {
    return [...this.dryRunOrders]
  }

  /** Why the most recent placeOrder returned null (rejected locally or by Binance). */
  getLastOrderError(): OrderError | null {
    return this.lastOrderError
  }

  /** Which network this client is pointed at. */
  isTestnet(): boolean {
    return this.useTestnet
  }

  /**
   * Look an order up by the client order id it was placed with. `missing` is true only
   * when Binance says the order does not exist (-2013); on any other failure (network,
   * rate limit) the answer is unknown: order null and missing false.
   */
  async getOrderByClientId(
    symbol: string,
    clientOrderId: string
  ): Promise<{ order: BinanceOrderResult | null; missing: boolean }> {
    try {
      const url = this.signedUrl('/v3/order', { symbol, origClientOrderId: clientOrderId })
      const response = await axios.get(url, { headers: { 'X-MBX-APIKEY': this.apiKey } })
      return { order: this.toOrderResult({ ...response.data, transactTime: response.data.time }), missing: false }
    } catch (error: any) {
      const code = error?.response?.data?.code
      return { order: null, missing: code === -2013 }
    }
  }

  /**
   * Generate HMAC SHA256 signature for requests
   */
  private getSignature(queryString: string): string {
    return crypto.createHmac('sha256', this.apiSecret).update(queryString).digest('hex')
  }

  /** Build a signed URL for a private endpoint. */
  private signedUrl(path: string, params: Record<string, string | number | undefined>): string {
    const queryString = Object.entries({ ...params, timestamp: Date.now() })
      .filter(([, v]) => v !== undefined)
      .map(([k, v]) => `${k}=${v}`)
      .join('&')
    return `${this.baseUrl}${path}?${queryString}&signature=${this.getSignature(queryString)}`
  }

  private toOrderError(error: any): OrderError {
    return {
      code: error?.response?.data?.code ?? error?.code,
      message: error?.response?.data?.msg || error?.message || 'unknown error',
    }
  }

  /**
   * Exchange rules (tick/step size, min qty, min notional) for a symbol, cached for
   * an hour. A stale copy is served if a refresh fails. Returns null if none is known.
   */
  async getSymbolRules(symbol: string): Promise<SymbolRules | null> {
    const cached = this.rulesCache.get(symbol)
    if (cached && Date.now() - cached.fetchedAt < RULES_TTL_MS) return cached.rules

    try {
      const response = await axios.get(`${this.baseUrl}/v3/exchangeInfo?symbol=${symbol}`)
      const rules = parseSymbolRules(response.data?.symbols?.[0])
      if (!rules) throw new Error('exchangeInfo had no usable PRICE_FILTER/LOT_SIZE')
      this.rulesCache.set(symbol, { rules, fetchedAt: Date.now() })
      return rules
    } catch (error: any) {
      this.logger.warn(`⚠️ Could not load exchange rules for ${symbol}: ${error?.message}`)
      return cached?.rules ?? null
    }
  }

  /**
   * Place an order on Binance (or simulate it when orders are blocked).
   *
   * The quantity and price are rounded to the symbol's step/tick size and checked
   * against its minimums first; an order Binance would reject is never sent, it
   * returns null and getLastOrderError() says why. If exchange rules cannot be
   * loaded, a live order is refused (fail closed).
   */
  async placeOrder(order: BinanceOrder): Promise<BinanceOrderResult | null> {
    this.lastOrderError = null
    const type = order.orderType || 'LIMIT'

    if (type === 'LIMIT' && !(order.price !== undefined && order.price > 0)) {
      return this.rejectOrder('INVALID_PRICE', `LIMIT order needs a positive price (got ${order.price})`)
    }

    const rules = await this.getSymbolRules(order.symbol)
    const blocked = orderBlockReason(this.useTestnet)

    let quantity = order.quantity
    let price = type === 'MARKET' ? undefined : order.price
    let qtyText = String(order.quantity)
    let priceText = price === undefined ? undefined : String(price)
    let unvalidated = false

    if (rules) {
      const prepared = prepareOrder(rules, order.side, order.quantity, price, this.lastPrices.get(order.symbol))
      if (!prepared.ok) {
        return this.rejectOrder('ORDER_REJECTED_LOCALLY', `${order.side} ${order.symbol}: ${prepared.reason}`)
      }
      quantity = prepared.quantityValue
      price = prepared.priceValue
      qtyText = prepared.quantity
      priceText = prepared.price
    } else if (!blocked) {
      return this.rejectOrder(
        'RULES_UNAVAILABLE',
        `${order.symbol}: exchange rules unavailable, refusing to send an unvalidated live order`
      )
    } else {
      unvalidated = true
      this.logger.warn(`⚠️ ${order.symbol}: exchange rules unavailable, simulating without rounding/validation`)
    }

    // Blocked (dry run / mainnet gate): never sign or send. Return a clearly fake
    // order (negative id, simulated: true) that fills later under a simple model.
    if (blocked) {
      const simulated: BinanceOrderResult = {
        orderId: this.nextSimulatedOrderId--,
        symbol: order.symbol,
        side: order.side,
        quantity,
        price: price ?? 0,
        status: 'DRY_RUN',
        timestamp: Date.now(),
        executedQty: 0,
        cummulativeQuoteQty: 0,
        simulated: true,
        ...(unvalidated ? { unvalidated: true } : {}),
      }
      this.dryRunOrders.push(simulated)
      this.simOrders.set(simulated.orderId, { result: simulated, state: 'NEW', executedQty: 0, quoteQty: 0, trades: [] })
      if (this.dryRunOrders.length > 500) {
        const dropped = this.dryRunOrders.shift()!
        this.simOrders.delete(dropped.orderId)
      }
      const why =
        blocked === 'dry-run' ? '🧪 DRY RUN' : '🛑 MAINNET ORDERS NOT ALLOWED (ALLOW_MAINNET_ORDERS != true)'
      this.logger.info(
        `${why}: would place ${order.side} ${qtyText} ${order.symbol} @ ${priceText ?? 'MARKET'} (not sent)`
      )
      return simulated
    }

    // A client order id lets us find the order again if the response is lost
    const clientOrderId =
      order.clientOrderId && /^[A-Za-z0-9_-]{1,36}$/.test(order.clientOrderId)
        ? order.clientOrderId
        : `grid-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`

    try {
      const url = this.signedUrl('/v3/order', {
        symbol: order.symbol,
        side: order.side,
        type,
        quantity: qtyText,
        // price and timeInForce are not allowed on MARKET orders
        ...(type === 'LIMIT' ? { price: priceText, timeInForce: 'GTC' } : {}),
        newClientOrderId: clientOrderId,
        newOrderRespType: 'FULL',
      })

      this.logger.info(`📤 Placing ${order.side} order: ${qtyText} ${order.symbol} @ ${priceText ?? 'MARKET'}`)

      const response = await axios.post(url, {}, {
        headers: {
          'X-MBX-APIKEY': this.apiKey,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      })

      const result = this.toOrderResult(response.data)
      this.logger.info(
        `✅ Order placed: ID ${result.orderId} | Status: ${result.status} | Filled: ${result.executedQty}/${result.quantity}`
      )
      return result
    } catch (error: any) {
      // No HTTP response (timeout / dropped connection): the order may exist anyway
      if (!error?.response) {
        const found = await this.findOrderByClientId(order.symbol, clientOrderId)
        if (found) {
          this.logger.warn(`⚠️ Order response was lost but the order exists: ID ${found.orderId}`)
          return found
        }
      }
      const err = this.toOrderError(error)
      return this.rejectOrder(err.code, `Order placement failed: ${err.message}`)
    }
  }

  private rejectOrder(code: OrderError['code'], message: string): null {
    this.lastOrderError = { code, message }
    this.logger.error(`❌ ${message}`)
    return null
  }

  private toOrderResult(data: any): BinanceOrderResult {
    return {
      orderId: data.orderId,
      symbol: data.symbol,
      side: data.side,
      quantity: parseFloat(data.origQty),
      price: parseFloat(data.price),
      status: data.status,
      timestamp: data.transactTime ?? data.time ?? Date.now(),
      executedQty: parseFloat(data.executedQty ?? '0') || 0,
      cummulativeQuoteQty: parseFloat(data.cummulativeQuoteQty ?? '0') || 0,
      fills: Array.isArray(data.fills)
        ? data.fills.map((f: any) => ({
            price: parseFloat(f.price),
            qty: parseFloat(f.qty),
            commission: parseFloat(f.commission),
            commissionAsset: f.commissionAsset,
          }))
        : undefined,
    }
  }

  private async findOrderByClientId(symbol: string, clientOrderId: string): Promise<BinanceOrderResult | null> {
    return (await this.getOrderByClientId(symbol, clientOrderId)).order
  }

  /**
   * Get account balance
   */
  async getBalance(): Promise<BinanceBalance[] | null> {
    try {
      const url = this.signedUrl('/v3/account', {})

      const response = await axios.get(url, {
        headers: {
          'X-MBX-APIKEY': this.apiKey,
        },
      })

      const balances: BinanceBalance[] = response.data.balances.map((b: any) => ({
        asset: b.asset,
        free: b.free,
        locked: b.locked,
      }))

      return balances
    } catch (error: any) {
      this.logger.error(`❌ Balance fetch failed: ${error?.message}`)
      return null
    }
  }

  /**
   * Cancel an order
   */
  async cancelOrder(symbol: string, orderId: number): Promise<boolean> {
    // Blocked (dry run / mainnet gate): simulated orders (negative ids) were never sent, so
    // cancelling them is local. A real order id is NOT cancelled: no state-changing calls
    // are made while orders are blocked, and reporting success would be a lie.
    const blocked = orderBlockReason(this.useTestnet)
    if (blocked) {
      const why = blocked === 'dry-run' ? '🧪 DRY RUN' : '🛑 MAINNET ORDERS NOT ALLOWED'
      if (orderId < 0) {
        const sim = this.simOrders.get(orderId)
        if (sim) this.advanceSimOrder(sim)
        if (sim && sim.state !== 'NEW') {
          this.logger.warn(`${why}: simulated order ${orderId} is already ${sim.state}, not cancelled`)
          return false
        }
        if (sim) sim.state = 'CANCELED'
        this.logger.info(`${why}: simulated order ${orderId} cancelled locally`)
        return true
      }
      this.logger.warn(
        `${why}: real order ${orderId} on ${symbol} was NOT cancelled (no exchange changes while orders are blocked)`
      )
      return false
    }

    try {
      const url = this.signedUrl('/v3/order', { symbol, orderId })

      await axios.delete(url, {
        headers: {
          'X-MBX-APIKEY': this.apiKey,
        },
      })

      this.logger.info(`✅ Order ${orderId} cancelled`)
      return true
    } catch (error: any) {
      this.logger.error(`❌ Order cancellation failed: ${this.toOrderError(error).message}`)
      return false
    }
  }

  /**
   * Dry-run fill model: a simulated LIMIT order fills in full once the last known
   * price touches its limit (BUY: price <= limit, SELL: price >= limit), with a 0.1%
   * fee charged in the base asset on buys and the quote asset on sells, as on spot.
   */
  private advanceSimOrder(sim: SimOrder): void {
    if (sim.state !== 'NEW') return
    const { result } = sim
    const last = this.lastPrices.get(result.symbol)
    if (last === undefined) return

    const touched = result.side === 'BUY' ? last <= result.price : last >= result.price
    if (!touched) return

    const rules = this.rulesCache.get(result.symbol)?.rules
    const baseAsset = rules?.baseAsset ?? result.symbol.replace(/(USDT|BUSD|USDC|FDUSD)$/, '')
    const quoteAsset = rules?.quoteAsset ?? (result.symbol.match(/(USDT|BUSD|USDC|FDUSD)$/)?.[1] || 'USDT')
    const quoteQty = result.quantity * result.price

    sim.state = 'FILLED'
    sim.executedQty = result.quantity
    sim.quoteQty = quoteQty
    sim.trades = [
      {
        orderId: result.orderId,
        price: result.price,
        qty: result.quantity,
        quoteQty,
        commission: result.side === 'BUY' ? result.quantity * SIM_FEE_RATE : quoteQty * SIM_FEE_RATE,
        commissionAsset: result.side === 'BUY' ? baseAsset : quoteAsset,
      },
    ]
  }

  /**
   * Get order status (executed quantity, cumulative quote amount, ...).
   * Simulated orders are answered locally from the dry-run fill model.
   */
  async getOrderStatus(symbol: string, orderId: number): Promise<OrderStatusInfo | null> {
    if (orderId < 0) {
      const sim = this.simOrders.get(orderId)
      if (!sim) return null
      this.advanceSimOrder(sim)
      return {
        orderId,
        status: sim.state,
        executedQty: sim.executedQty,
        origQty: sim.result.quantity,
        price: sim.result.price,
        side: sim.result.side,
        cummulativeQuoteQty: sim.quoteQty,
        updateTime: Date.now(),
        simulated: true,
      }
    }

    try {
      const url = this.signedUrl('/v3/order', { symbol, orderId })

      const response = await axios.get(url, {
        headers: {
          'X-MBX-APIKEY': this.apiKey,
        },
      })

      return {
        orderId: response.data.orderId,
        status: response.data.status,
        executedQty: parseFloat(response.data.executedQty),
        origQty: parseFloat(response.data.origQty),
        price: parseFloat(response.data.price),
        side: response.data.side,
        cummulativeQuoteQty: parseFloat(response.data.cummulativeQuoteQty ?? '0') || 0,
        updateTime: response.data.updateTime ?? response.data.time ?? Date.now(),
      }
    } catch (error: any) {
      this.logger.error(`❌ Order status fetch failed: ${this.toOrderError(error).message}`)
      return null
    }
  }

  /**
   * The individual fills of an order, including the fee charged on each
   * (spot buys pay the fee in the base asset, so you receive less than you bought).
   */
  async getOrderTrades(symbol: string, orderId: number): Promise<TradeInfo[] | null> {
    if (orderId < 0) {
      const sim = this.simOrders.get(orderId)
      if (!sim) return null
      this.advanceSimOrder(sim)
      return [...sim.trades]
    }

    try {
      const url = this.signedUrl('/v3/myTrades', { symbol, orderId })
      const response = await axios.get(url, { headers: { 'X-MBX-APIKEY': this.apiKey } })
      return (response.data as any[]).map((t) => ({
        orderId: t.orderId,
        price: parseFloat(t.price),
        qty: parseFloat(t.qty),
        quoteQty: parseFloat(t.quoteQty),
        commission: parseFloat(t.commission),
        commissionAsset: t.commissionAsset,
      }))
    } catch (error: any) {
      this.logger.error(`❌ Trade list fetch failed: ${this.toOrderError(error).message}`)
      return null
    }
  }

  /** Orders currently resting on the exchange for a symbol (read-only). */
  async getOpenOrders(symbol: string): Promise<OrderStatusInfo[] | null> {
    try {
      const url = this.signedUrl('/v3/openOrders', { symbol })
      const response = await axios.get(url, { headers: { 'X-MBX-APIKEY': this.apiKey } })
      return (response.data as any[]).map((o) => ({
        orderId: o.orderId,
        status: o.status,
        executedQty: parseFloat(o.executedQty),
        origQty: parseFloat(o.origQty),
        price: parseFloat(o.price),
        side: o.side,
        cummulativeQuoteQty: parseFloat(o.cummulativeQuoteQty ?? '0') || 0,
        updateTime: o.updateTime ?? o.time ?? Date.now(),
      }))
    } catch (error: any) {
      this.logger.warn(`⚠️ Open orders fetch failed: ${this.toOrderError(error).message}`)
      return null
    }
  }

  /**
   * Get current prices from Binance (no auth needed, no rate limits)
   */
  async getPrices(symbols: string[]): Promise<Record<string, number> | null> {
    try {
      const prices: Record<string, number> = {}

      // Fetch all prices in parallel
      const requests = symbols.map(symbol =>
        axios.get(`${this.baseUrl}/v3/ticker/price?symbol=${symbol}`)
          .then(res => ({ symbol, price: parseFloat(res.data.price) }))
          .catch(() => ({ symbol, price: null }))
      )

      const results = await Promise.all(requests)

      results.forEach(({ symbol, price }) => {
        if (price !== null) {
          prices[symbol] = price
          if (Number.isFinite(price) && price > 0) this.lastPrices.set(symbol, price)
        }
      })

      return Object.keys(prices).length > 0 ? prices : null
    } catch (error: any) {
      this.logger.error(`❌ Price fetch failed: ${error?.message}`)
      return null
    }
  }

  /** Record a price observed elsewhere (used by the dry-run fill model and notional checks). */
  noteLastPrice(symbol: string, price: number): void {
    if (Number.isFinite(price) && price > 0) this.lastPrices.set(symbol, price)
  }
}

// Export singleton instance
let binanceInstance: BinanceAPI | null = null

export function getBinanceAPI(): BinanceAPI {
  if (!binanceInstance) {
    const apiKey = process.env.BINANCE_TESTNET_API_KEY || process.env.BINANCE_API_KEY || ''
    const apiSecret = process.env.BINANCE_TESTNET_API_SECRET || process.env.BINANCE_API_SECRET || ''
    const useTestnet = (process.env.USE_TESTNET || 'true').toLowerCase() === 'true'

    if (!apiKey || !apiSecret) {
      throw new Error('Binance API credentials not set')
    }

    binanceInstance = new BinanceAPI(apiKey, apiSecret, useTestnet)
  }

  return binanceInstance
}
