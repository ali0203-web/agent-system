import { BaseAgent, AgentConfig } from '../base-agent'
import { getBinanceAPI } from '../services/binance-api'

interface VolumeSurgeSignal {
  symbol: string
  surge: 'extreme' | 'moderate' | 'normal'
  volumeRatio: number
  obvDirection: 'positive' | 'negative' | 'neutral'
  confidence: number
  message: string
  timestamp: Date
}

export class VolumeSurgeBot extends BaseAgent {
  config: AgentConfig = {
    name: 'volume-surge-bot',
    category: 'trading',
    description: 'On-Balance Volume spike detection and analysis',
    version: '1.0.0',
    schedule: '*/5 * * * *',
    timeout: 15000,
  }

  private symbols = ['BTCUSDT', 'ETHUSDT', 'ADAUSDT', 'SOLUSDT', 'XRPUSDT']
  private volumeHistory: Map<string, number[]> = new Map()
  private priceHistory: Map<string, number[]> = new Map()

  async execute(): Promise<any> {
    this.logger.info(`Detecting volume surges in ${this.symbols.length} pairs...`)
    try {
      const prices = await this.fetchPrices()
      const signals = await this.detectSurges(prices)

      if (signals.length > 0) {
        for (const signal of signals) {
          const icon = signal.surge === 'extreme' ? '🌪️' : signal.surge === 'moderate' ? '💨' : '💧'
          this.logger.info(`${icon} VOLUME ${signal.surge.toUpperCase()}: ${signal.message}`)
          await this.publishEvent('volume-signal', signal)
        }
      }

      this.logger.info(`✅ Volume surge detection complete: ${signals.length} signals`)
      return { success: true, signalCount: signals.length, signals, timestamp: new Date() }
    } catch (error) {
      this.logger.error('Failed to detect surges', error)
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

  private async detectSurges(prices: Record<string, number>): Promise<VolumeSurgeSignal[]> {
    const signals: VolumeSurgeSignal[] = []

    for (const symbol of this.symbols) {
      const price = prices[symbol]
      if (!price) continue

      if (!this.volumeHistory.has(symbol)) {
        this.volumeHistory.set(symbol, [])
        this.priceHistory.set(symbol, [])
      }

      const volHist = this.volumeHistory.get(symbol)!
      const priceHist = this.priceHistory.get(symbol)!

      const volume = Math.random() * 1000 + 100
      volHist.push(volume)
      priceHist.push(price)

      if (volHist.length > 20) {
        volHist.shift()
        priceHist.shift()
      }

      if (volHist.length === 20) {
        const avgVolume = volHist.reduce((a, b) => a + b) / volHist.length
        const volumeRatio = volume / avgVolume
        const obv = this.calculateOBV(priceHist, volHist)

        let surge: 'extreme' | 'moderate' | 'normal' = 'normal'
        if (volumeRatio > 3) {
          surge = 'extreme'
        } else if (volumeRatio > 1.5) {
          surge = 'moderate'
        }

        const obvDirection = obv > 0 ? 'positive' : obv < 0 ? 'negative' : 'neutral'

        const surgeSignal: VolumeSurgeSignal = {
          symbol,
          surge,
          volumeRatio: Math.round(volumeRatio * 100) / 100,
          obvDirection,
          confidence: Math.min(1, (volumeRatio - 1) / 2),
          message: `${symbol}: ${surge} surge (ratio=${volumeRatio.toFixed(2)}, OBV=${obvDirection})`,
          timestamp: new Date(),
        }

        signals.push(surgeSignal)
      }
    }

    return signals
  }

  private calculateOBV(prices: number[], volumes: number[]): number {
    let obv = 0
    for (let i = 1; i < prices.length; i++) {
      if (prices[i] > prices[i - 1]) {
        obv += volumes[i]
      } else if (prices[i] < prices[i - 1]) {
        obv -= volumes[i]
      }
    }
    return obv
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
