import { BaseAgent, AgentConfig } from '../base-agent'
import { getBinanceAPI } from '../services/binance-api'

interface VolumeLevel {
  priceLevel: number
  volume: number
  timestamp: Date
}

interface VolumeSignal {
  symbol: string
  type: 'poc-support' | 'poc-resistance' | 'volume-spike'
  price: number
  volumeProfilePrice: number
  volumeRatio: number
  message: string
  timestamp: Date
}

export class VolumeProfileBot extends BaseAgent {
  config: AgentConfig = {
    name: 'volume-profile-bot',
    category: 'trading',
    description: 'Trade using volume profile analysis for support/resistance',
    version: '1.0.0',
    schedule: '*/5 * * * *', // Every 5 minutes
    timeout: 15000,
  }

  private symbols = ['BTCUSDT', 'ETHUSDT', 'ADAUSDT', 'SOLUSDT', 'XRPUSDT']
  private priceHistory: Map<string, number[]> = new Map()
  private volumeHistory: Map<string, number[]> = new Map()
  private volumeProfile: Map<string, Map<number, number>> = new Map()

  async execute(): Promise<any> {
    this.logger.info(
      `Scanning ${this.symbols.length} pairs for volume profile signals...`
    )

    try {
      // Fetch current prices
      const prices = await this.fetchPrices()

      // Analyze volume profile
      const signals = await this.analyzeVolumeProfile(prices)

      // Publish signals
      if (signals.length > 0) {
        for (const signal of signals) {
          this.logger.warn(`📊 ${signal.type.toUpperCase()}: ${signal.message}`)
          await this.publishEvent('volume-signal', signal)
        }
      }

      this.logger.info(`✅ Volume analysis complete: Found ${signals.length} signals`)

      return {
        success: true,
        signalCount: signals.length,
        signals,
        timestamp: new Date(),
      }
    } catch (error) {
      this.logger.error('Failed to analyze volume profile', error)
      throw error
    }
  }

  private async fetchPrices(): Promise<Record<string, number>> {
    try {
      const binance = getBinanceAPI()
      const prices = await binance.getPrices(this.symbols)
      return prices || {}
    } catch (error) {
      this.logger.error('Failed to fetch prices', error)
      throw error
    }
  }

  private async analyzeVolumeProfile(
    prices: Record<string, number>
  ): Promise<VolumeSignal[]> {
    const signals: VolumeSignal[] = []

    for (const symbol of this.symbols) {
      const price = prices[symbol]
      if (!price) continue

      // Update price history
      if (!this.priceHistory.has(symbol)) {
        this.priceHistory.set(symbol, [])
      }
      const priceHist = this.priceHistory.get(symbol)!
      priceHist.push(price)

      // Simulate volume (in production would come from exchange)
      if (!this.volumeHistory.has(symbol)) {
        this.volumeHistory.set(symbol, [])
      }
      const volHist = this.volumeHistory.get(symbol)!
      const volume = Math.random() * 1000 + 100 // Random volume
      volHist.push(volume)

      // Keep last 50 data points
      if (priceHist.length > 50) {
        priceHist.shift()
        volHist.shift()
      }

      // Build volume profile
      this.buildVolumeProfile(symbol, priceHist, volHist)

      // Detect signals
      const signal = this.detectSignal(symbol, price, volHist)
      if (signal) {
        signals.push(signal)
      }
    }

    return signals
  }

  private buildVolumeProfile(
    symbol: string,
    prices: number[],
    volumes: number[]
  ): void {
    if (!this.volumeProfile.has(symbol)) {
      this.volumeProfile.set(symbol, new Map())
    }

    const profile = this.volumeProfile.get(symbol)!

    // Bucket prices by 0.5% increments
    const bucketSize = prices[prices.length - 1] * 0.005

    for (let i = 0; i < prices.length; i++) {
      const bucket = Math.floor(prices[i] / bucketSize) * bucketSize
      const current = profile.get(bucket) || 0
      profile.set(bucket, current + volumes[i])
    }

    // Keep only top 20 buckets
    const sorted = Array.from(profile.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 20)

    this.volumeProfile.set(symbol, new Map(sorted))
  }

  private detectSignal(
    symbol: string,
    price: number,
    volumes: number[]
  ): VolumeSignal | null {
    const profile = this.volumeProfile.get(symbol)
    if (!profile || profile.size === 0) return null

    // Find point of control (POC) - price level with highest volume
    let pocPrice = 0
    let pocVolume = 0

    profile.forEach((vol, priceLevel) => {
      if (vol > pocVolume) {
        pocVolume = vol
        pocPrice = priceLevel
      }
    })

    const avgVolume = volumes.reduce((a, b) => a + b) / volumes.length
    const currentVolume = volumes[volumes.length - 1]
    const volumeRatio = currentVolume / avgVolume

    // Volume spike signal
    if (volumeRatio > 1.5) {
      return {
        symbol,
        type: 'volume-spike',
        price,
        volumeProfilePrice: pocPrice,
        volumeRatio,
        message: `${symbol} volume spike (${volumeRatio.toFixed(1)}x) at $${price.toFixed(
          2
        )}`,
        timestamp: new Date(),
      }
    }

    // POC support signal: price near POC from below
    if (price < pocPrice && price > pocPrice * 0.98) {
      return {
        symbol,
        type: 'poc-support',
        price,
        volumeProfilePrice: pocPrice,
        volumeRatio: (pocPrice - price) / (pocPrice * 0.02),
        message: `${symbol} trading near point of control at $${pocPrice.toFixed(2)}`,
        timestamp: new Date(),
      }
    }

    // POC resistance signal: price near POC from above
    if (price > pocPrice && price < pocPrice * 1.02) {
      return {
        symbol,
        type: 'poc-resistance',
        price,
        volumeProfilePrice: pocPrice,
        volumeRatio: (price - pocPrice) / (pocPrice * 0.02),
        message: `${symbol} approaching resistance at POC $${pocPrice.toFixed(2)}`,
        timestamp: new Date(),
      }
    }

    return null
  }

  async validate(): Promise<boolean> {
    this.logger.info('Validating VolumeProfileBot...')

    try {
      if (this.symbols.length === 0) {
        throw new Error('No symbols configured')
      }

      const prices = await this.fetchPrices()
      if (!prices || Object.keys(prices).length === 0) {
        throw new Error('Failed to fetch prices')
      }

      this.logger.info(`✅ Validation successful. Monitoring ${this.symbols.length} pairs`)
      return true
    } catch (error) {
      this.logger.error('Validation failed', error)
      return false
    }
  }

  async healthCheck(): Promise<boolean> {
    try {
      const prices = await this.fetchPrices()
      return Object.keys(prices).length > 0
    } catch (error) {
      this.logger.error('Health check failed', error)
      return false
    }
  }
}
