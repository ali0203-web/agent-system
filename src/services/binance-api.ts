/**
 * Binance API Service
 * Real order execution on testnet and mainnet
 */

import axios from 'axios'
import crypto from 'crypto'
import { Logger } from '../logger'

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

  constructor(apiKey: string, apiSecret: string, useTestnet: boolean = true) {
    this.apiKey = apiKey
    this.apiSecret = apiSecret
    this.useTestnet = useTestnet
    this.baseUrl = useTestnet
      ? 'https://testnet.binance.vision/api'
      : 'https://api.binance.com/api'
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
