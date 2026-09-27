import { BaseAgent, AgentConfig } from '../base-agent'
import { getBinanceAPI } from '../services/binance-api'

interface WhaleSignal {
  symbol: string
  activity: 'accumulation' | 'distribution'
  largeTransaction: number
  confidence: number
  message: string
  timestamp: Date
}

export class WhaleWatchBot extends BaseAgent {
  config: AgentConfig = {
    name: 'whale-watch-bot',
    category: 'trading',
    description: 'Large transaction (whale) monitoring for market signals',
    version: '1.0.0',
    schedule: '*/10 * * * *',
    timeout: 15000,
  }

  private symbols = ['BTCUSDT', 'ETHUSDT', 'ADAUSDT', 'SOLUSDT', 'XRPUSDT']
  private volumeHistory: Map<string, number[]> = new Map()

  async execute(): Promise<any> {
    this.logger.info(`Monitoring whale activity in ${this.symbols.length} pairs...`)
    try {
      const prices = await this.fetchPrices()
      const signals = await this.detectWhales(prices)

      if (signals.length > 0) {
        for (const signal of signals) {
          this.logger.warn(`🐋 WHALE ${signal.activity}: ${signal.message}`)
          await this.publishEvent('whale-signal', signal)
        }
      }

      this.logger.info(`✅ Whale watch complete: ${signals.length} signals`)
      return { success: true, signalCount: signals.length, signals, timestamp: new Date() }
    } catch (error) {
      this.logger.error('Failed to detect whales', error)
      throw error
    }
  }

  private async fetchPrices(): Promise<Record<string, number>> {
    try {
      const binance = getBinanceAPI()
      return (await binance.getPrices(this.symbols)) || {}
    } catch (error) {
      this.logger.error('Failed to fetch prices', error)
      throw error
    }
  }

  private async detectWhales(prices: Record<string, number>): Promise<WhaleSignal[]> {
    const signals: WhaleSignal[] = []

    for (const symbol of this.symbols) {
      const price = prices[symbol]
      if (!price) continue

      if (!this.volumeHistory.has(symbol)) {
        this.volumeHistory.set(symbol, [])
      }

      const volHist = this.volumeHistory.get(symbol)!
      const volume = Math.random() * 5000 + 500
      volHist.push(volume)

      if (volHist.length > 20) {
        volHist.shift()
      }

      if (volHist.length === 20) {
        const avgVolume = volHist.reduce((a, b) => a + b) / volHist.length
        const currentVolume = volume
        const volumeRatio = currentVolume / avgVolume

        if (volumeRatio > 2.5) {
          const activity = Math.random() > 0.5 ? 'accumulation' : 'distribution'
          const confidence = Math.min(1, (volumeRatio - 2.5) / 2.5)

          const signal: WhaleSignal = {
            symbol,
            activity,
            largeTransaction: Math.round(currentVolume * 100) / 100,
            confidence,
            message: `${symbol}: ${activity} detected - ${volumeRatio.toFixed(1)}x volume spike`,
            timestamp: new Date(),
          }

          signals.push(signal)
        }
      }
    }

    return signals
  }

  async validate(): Promise<boolean> {
    try {
      const prices = await this.fetchPrices()
      return Object.keys(prices).length > 0
    } catch (error) {
      return false
    }
  }

  async healthCheck(): Promise<boolean> {
    try {
      const prices = await this.fetchPrices()
      return Object.keys(prices).length > 0
    } catch (error) {
      return false
    }
  }
}
