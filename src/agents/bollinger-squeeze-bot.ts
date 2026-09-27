import { BaseAgent, AgentConfig } from '../base-agent'
import { getBinanceAPI } from '../services/binance-api'

interface SqueezeSignal {
  symbol: string
  squeezed: boolean
  confidence: number
  bandWidth: number
  message: string
  timestamp: Date
}

export class BollingerSqueezeBot extends BaseAgent {
  config: AgentConfig = {
    name: 'bollinger-squeeze-bot',
    category: 'trading',
    description: 'Bollinger Bands squeeze detection for volatility-based entries',
    version: '1.0.0',
    schedule: '*/5 * * * *',
    timeout: 15000,
  }

  private symbols = ['BTCUSDT', 'ETHUSDT', 'ADAUSDT', 'SOLUSDT', 'XRPUSDT']
  private priceHistory: Map<string, number[]> = new Map()

  async execute(): Promise<any> {
    this.logger.info(`Detecting Bollinger Bands squeeze in ${this.symbols.length} pairs...`)
    try {
      const prices = await this.fetchPrices()
      const signals = await this.detectSqueeze(prices)

      if (signals.length > 0) {
        for (const signal of signals) {
          const status = signal.squeezed ? '🔺 SQUEEZE' : '📊 NORMAL'
          this.logger.info(`${status}: ${signal.message}`)
          await this.publishEvent('squeeze-signal', signal)
        }
      }

      this.logger.info(`✅ Squeeze detection complete: ${signals.length} signals`)
      return { success: true, signalCount: signals.length, signals, timestamp: new Date() }
    } catch (error) {
      this.logger.error('Failed to detect squeeze', error)
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

  private async detectSqueeze(prices: Record<string, number>): Promise<SqueezeSignal[]> {
    const signals: SqueezeSignal[] = []

    for (const symbol of this.symbols) {
      const price = prices[symbol]
      if (!price) continue

      if (!this.priceHistory.has(symbol)) {
        this.priceHistory.set(symbol, [])
      }

      const history = this.priceHistory.get(symbol)!
      history.push(price)

      if (history.length > 20) {
        history.shift()
      }

      if (history.length === 20) {
        const bb = this.calculateBollingerBands(history)
        const bandWidth = (bb.upper - bb.lower) / bb.middle
        const squeezeThreshold = 0.02

        const signal: SqueezeSignal = {
          symbol,
          squeezed: bandWidth < squeezeThreshold,
          confidence: Math.max(0, 1 - bandWidth / 0.05),
          bandWidth: Math.round(bandWidth * 10000) / 10000,
          message: `${symbol}: ${bandWidth < squeezeThreshold ? 'SQUEEZE DETECTED' : 'Normal volatility'} (width=${bandWidth.toFixed(4)})`,
          timestamp: new Date(),
        }

        signals.push(signal)
      }
    }

    return signals
  }

  private calculateBollingerBands(prices: number[]): { upper: number; middle: number; lower: number } {
    const sma = prices.reduce((a, b) => a + b) / prices.length
    const variance = prices.reduce((sum, p) => sum + Math.pow(p - sma, 2), 0) / prices.length
    const stdDev = Math.sqrt(variance)
    const k = 2

    return {
      middle: sma,
      upper: sma + k * stdDev,
      lower: sma - k * stdDev,
    }
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
