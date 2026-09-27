import { BaseAgent, AgentConfig } from '../base-agent'
import { getBinanceAPI } from '../services/binance-api'

interface PriceData {
  symbol: string
  price: number
  currency: string
  timestamp: Date
  source: string
  change24h?: number
}

export class BitcoinPriceMonitor extends BaseAgent {
  config: AgentConfig = {
    name: 'bitcoin-price-monitor',
    category: 'trading',
    description: 'Monitor Bitcoin price in real-time from CoinGecko API',
    version: '1.0.0',
    schedule: '*/5 * * * *', // Every 5 minutes
    timeout: 10000,
  }

  private currencies = ['usd']
  private priceThresholds = {
    significantChange: 2, // 2% change = alert
  }
  private lastPrice: { [key: string]: number } = {}

  /**
   * Fetch and process Bitcoin price
   */
  async execute(): Promise<any> {
    this.logger.info('Fetching Bitcoin price...')

    try {
      // Fetch price data
      const priceData = await this.fetchBitcoinPrice()

      // Calculate changes
      const enrichedData = this.enrichPriceData(priceData)

      // Check for significant changes
      const alerts = this.checkForAlerts(enrichedData)

      // Publish alerts if any
      if (alerts.length > 0) {
        await this.publishAlerts(alerts)
      }

      // Update last known prices
      this.updateLastPrices(enrichedData)

      this.logger.info(`✅ Price data collected: ${JSON.stringify(enrichedData)}`)

      return {
        success: true,
        priceData: enrichedData,
        alerts: alerts,
        timestamp: new Date(),
      }
    } catch (error) {
      this.logger.error('Failed to fetch Bitcoin price', error)
      throw error
    }
  }

  /**
   * Fetch Bitcoin price from Binance
   */
  private async fetchBitcoinPrice(): Promise<PriceData[]> {
    try {
      const binance = getBinanceAPI()
      const prices = await binance.getPrices(['BTCUSDT'])

      // Transform response to PriceData array
      const priceData: PriceData[] = []

      if (prices?.BTCUSDT) {
        priceData.push({
          symbol: 'BTC',
          price: prices.BTCUSDT,
          currency: 'USD',
          timestamp: new Date(),
          source: 'binance',
        })
      }

      return priceData
    } catch (error) {
      this.logger.error('API request failed', error)
      throw error
    }
  }

  /**
   * Enrich price data with additional metrics
   */
  private enrichPriceData(priceData: PriceData[]): any[] {
    return priceData.map((item) => {
      const lastPrice = this.lastPrice[item.currency]
      const change = lastPrice ? ((item.price - lastPrice) / lastPrice) * 100 : 0

      return {
        ...item,
        change24h: Math.round(change * 100) / 100, // 2 decimal places
        priceChangeStatus: change > 2 ? 'up' : change < -2 ? 'down' : 'stable',
      }
    })
  }

  /**
   * Check for price changes that should trigger alerts
   */
  private checkForAlerts(enrichedData: any[]): any[] {
    const alerts: any[] = []

    for (const data of enrichedData) {
      if (Math.abs(data.change24h) >= this.priceThresholds.significantChange) {
        alerts.push({
          type: 'PRICE_ALERT',
          severity: Math.abs(data.change24h) > 5 ? 'high' : 'medium',
          symbol: data.symbol,
          currency: data.currency,
          currentPrice: data.price,
          priceChange: data.change24h,
          message: `Bitcoin price changed ${data.change24h > 0 ? '📈' : '📉'} ${Math.abs(data.change24h).toFixed(2)}% in ${data.currency}`,
          timestamp: new Date(),
        })
      }
    }

    return alerts
  }

  /**
   * Publish alerts to event system
   */
  private async publishAlerts(alerts: any[]): Promise<void> {
    for (const alert of alerts) {
      this.logger.warn(`🚨 Alert: ${alert.message}`)
      await this.publishEvent('bitcoin-price-alert', alert)
    }
  }

  /**
   * Update last known prices
   */
  private updateLastPrices(enrichedData: any[]): void {
    for (const data of enrichedData) {
      this.lastPrice[data.currency] = data.price
    }
  }

  /**
   * Validate agent configuration
   */
  async validate(): Promise<boolean> {
    this.logger.info('Validating BitcoinPriceMonitor...')

    try {
      // Test API connectivity
      const testData = await this.fetchBitcoinPrice()

      if (!testData || testData.length === 0) {
        throw new Error('Failed to fetch test data from API')
      }

      this.logger.info(`✅ Validation successful. Current BTC price: $${testData[0].price}`)
      return true
    } catch (error) {
      this.logger.error('Validation failed', error)
      return false
    }
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<boolean> {
    try {
      const priceData = await this.fetchBitcoinPrice()
      return priceData && priceData.length > 0
    } catch (error) {
      this.logger.error('Health check failed', error)
      return false
    }
  }

  /**
   * Get current Bitcoin price
   */
  async getCurrentPrice(currency = 'USD'): Promise<number | null> {
    try {
      const priceData = await this.fetchBitcoinPrice()
      const currencyData = priceData.find((p) => p.currency === currency)
      return currencyData?.price || null
    } catch (error) {
      this.logger.error('Failed to get current price', error)
      return null
    }
  }
}
