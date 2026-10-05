/**
 * Binance API Service
 * Real order execution on testnet and mainnet
 */

import axios from 'axios'
import crypto from 'crypto'
import { Logger } from '../logger'
import { orderBlockReason, parseDryRun, mainnetOrdersAllowed } from '../dry-run'

interface BinanceOrder {
  symbol: string
  side: 'BUY' | 'SELL'
  quantity: number
  price?: number
  orderType?: 'LIMIT' | 'MARKET'
}

interface BinanceOrderResult {
  orderId: number
  symbol: string
  side: string
  quantity: number
  price: number
  status: string
  timestamp: number
  /** True when DRY_RUN is on: nothing was sent to the exchange. */
  simulated?: boolean
}

interface BinanceBalance {
  asset: string
  free: string
  locked: string
}

export class BinanceAPI {
  private apiKey: string
  private apiSecret: string
  private baseUrl: string
  private logger = new Logger('BinanceAPI')
  private useTestnet: boolean
  private dryRunOrders: BinanceOrderResult[] = []
  private nextSimulatedOrderId = -1

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

  /** Orders simulated while DRY_RUN was on (newest last), for inspection and tests. */
  getDryRunOrders(): BinanceOrderResult[] {
    return [...this.dryRunOrders]
  }

  /**
   * Generate HMAC SHA256 signature for requests
   */
  private getSignature(queryString: string): string {
    return crypto.createHmac('sha256', this.apiSecret).update(queryString).digest('hex')
  }

  /**
   * Place a real order on Binance
   */
  async placeOrder(order: BinanceOrder): Promise<BinanceOrderResult | null> {
    // Dry run, or mainnet without ALLOW_MAINNET_ORDERS: never sign or send. Return
    // a clearly fake order (negative id, status DRY_RUN, simulated: true) so callers
    // can run their logic end to end.
    const blocked = orderBlockReason(this.useTestnet)
    if (blocked) {
      const simulated: BinanceOrderResult = {
        orderId: this.nextSimulatedOrderId--,
        symbol: order.symbol,
        side: order.side,
        quantity: order.quantity,
        price: order.price || 0,
        status: 'DRY_RUN',
        timestamp: Date.now(),
        simulated: true,
      }
      this.dryRunOrders.push(simulated)
      if (this.dryRunOrders.length > 500) this.dryRunOrders.shift()
      const why =
        blocked === 'dry-run' ? '🧪 DRY RUN' : '🛑 MAINNET ORDERS NOT ALLOWED (ALLOW_MAINNET_ORDERS != true)'
      this.logger.info(
        `${why}: would place ${order.side} ${order.quantity} ${order.symbol} @ ${order.price} (not sent)`
      )
      return simulated
    }

    try {
      const timestamp = Date.now()
      const params = {
        symbol: order.symbol,
        side: order.side,
        type: order.orderType || 'LIMIT',
        quantity: order.quantity,
        price: order.price || 0,
        timeInForce: 'GTC',
        timestamp,
      }

      // Build query string
      const queryString = Object.entries(params)
        .map(([key, value]) => `${key}=${value}`)
        .join('&')

      const signature = this.getSignature(queryString)
      const url = `${this.baseUrl}/v3/order?${queryString}&signature=${signature}`

      this.logger.info(
        `📤 Placing ${order.side} order: ${order.quantity} ${order.symbol} @ ${order.price}`
      )

      const response = await axios.post(url, {}, {
        headers: {
          'X-MBX-APIKEY': this.apiKey,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      })

      const result: BinanceOrderResult = {
        orderId: response.data.orderId,
        symbol: response.data.symbol,
        side: response.data.side,
        quantity: parseFloat(response.data.origQty),
        price: parseFloat(response.data.price),
        status: response.data.status,
        timestamp: response.data.transactTime,
      }

      this.logger.info(`✅ Order placed: ID ${result.orderId} | Status: ${result.status}`)
      return result
    } catch (error: any) {
      this.logger.error(`❌ Order placement failed: ${error?.response?.data?.msg || error?.message}`)
      return null
    }
  }

  /**
   * Get account balance
   */
  async getBalance(): Promise<BinanceBalance[] | null> {
    try {
      const timestamp = Date.now()
      const queryString = `timestamp=${timestamp}`
      const signature = this.getSignature(queryString)
      const url = `${this.baseUrl}/v3/account?${queryString}&signature=${signature}`

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
    // Blocked (dry run / mainnet gate): simulated orders (negative ids) were never sent, so "cancelling"
    // them succeeds locally. A real order id is NOT cancelled: dry run makes no
    // state-changing calls, and reporting success would be a lie.
    const blocked = orderBlockReason(this.useTestnet)
    if (blocked) {
      const why = blocked === 'dry-run' ? '🧪 DRY RUN' : '🛑 MAINNET ORDERS NOT ALLOWED'
      if (orderId < 0) {
        this.logger.info(`${why}: simulated order ${orderId} cancelled locally`)
        return true
      }
      this.logger.warn(
        `${why}: real order ${orderId} on ${symbol} was NOT cancelled (no exchange changes while orders are blocked)`
      )
      return false
    }

    try {
      const timestamp = Date.now()
      const params = {
        symbol,
        orderId,
        timestamp,
      }

      const queryString = Object.entries(params)
        .map(([key, value]) => `${key}=${value}`)
        .join('&')

      const signature = this.getSignature(queryString)
      const url = `${this.baseUrl}/v3/order?${queryString}&signature=${signature}`

      await axios.delete(url, {
        headers: {
          'X-MBX-APIKEY': this.apiKey,
        },
      })

      this.logger.info(`✅ Order ${orderId} cancelled`)
      return true
    } catch (error: any) {
      this.logger.error(`❌ Order cancellation failed: ${error?.message}`)
      return false
    }
  }

  /**
   * Get order status
   */
  async getOrderStatus(symbol: string, orderId: number): Promise<any | null> {
    // Simulated orders don't exist on the exchange; answer locally
    if (orderId < 0) {
      const sim = this.dryRunOrders.find((o) => o.orderId === orderId)
      return sim
        ? { orderId, status: 'DRY_RUN', executedQty: 0, origQty: sim.quantity, simulated: true }
        : null
    }

    try {
      const timestamp = Date.now()
      const params = {
        symbol,
        orderId,
        timestamp,
      }

      const queryString = Object.entries(params)
        .map(([key, value]) => `${key}=${value}`)
        .join('&')

      const signature = this.getSignature(queryString)
      const url = `${this.baseUrl}/v3/order?${queryString}&signature=${signature}`

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
      }
    } catch (error: any) {
      this.logger.error(`❌ Order status fetch failed: ${error?.message}`)
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
        }
      })

      return Object.keys(prices).length > 0 ? prices : null
    } catch (error: any) {
      this.logger.error(`❌ Price fetch failed: ${error?.message}`)
      return null
    }
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
