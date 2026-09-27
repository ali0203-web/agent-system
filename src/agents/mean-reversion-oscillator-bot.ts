import { BaseAgent, AgentConfig } from '../base-agent'
import { getBinanceAPI } from '../services/binance-api'

interface ReversionSignal {
  symbol: string
  signal: 'overbought' | 'oversold' | 'neutral'
  oscillator: number
  confidence: number
  message: string
  timestamp: Date
}

export class MeanReversionOscillatorBot extends BaseAgent {
  config: AgentConfig = {
    name: 'mean-reversion-oscillator-bot',
    category: 'trading',
    description: 'Custom mean reversion oscillator for overbought/oversold detection',
    version: '1.0.0',
    schedule: '*/5 * * * *',
    timeout: 15000,
  }

  private symbols = ['BTCUSDT', 'ETHUSDT', 'ADAUSDT', 'SOLUSDT', 'XRPUSDT']
  private priceHistory: Map<string, number[]> = new Map()

  async execute(): Promise<any> {
    this.logger.info(`Calculating reversion oscillator for ${this.symbols.length} pairs...`)
    try {
      const prices = await this.fetchPrices()
      const signals = await this.calculateOscillator(prices)

      if (signals.length > 0) {
        for (const signal of signals) {
          const icon = signal.signal === 'overbought' ? '📈' : signal.signal === 'oversold' ? '📉' : '⚖️'
          this.logger.info(`${icon} ${signal.signal.toUpperCase()}: ${signal.message}`)
          await this.publishEvent('reversion-signal', signal)
        }
      }

      this.logger.info(`✅ Oscillator calculation complete: ${signals.length} signals`)
      return { success: true, signalCount: signals.length, signals, timestamp: new Date() }
    } catch (error) {
      this.logger.error('Failed to calculate oscillator', error)
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

  private async calculateOscillator(prices: Record<string, number>): Promise<ReversionSignal[]> {
    const signals: ReversionSignal[] = []

    for (const symbol of this.symbols) {
      const price = prices[symbol]
      if (!price) continue

      if (!this.priceHistory.has(symbol)) {
        this.priceHistory.set(symbol, [])
      }

      const history = this.priceHistory.get(symbol)!
      history.push(price)

      if (history.length > 30) {
        history.shift()
      }

      if (history.length === 30) {
        const sma = history.reduce((a, b) => a + b) / history.length
        const deviation = history.reduce((sum, p) => sum + Math.pow(p - sma, 2), 0) / history.length
        const stdDev = Math.sqrt(deviation)

        const oscillator = (price - sma) / stdDev

        let signal: 'overbought' | 'oversold' | 'neutral' = 'neutral'
        let confidence = 0

        if (oscillator > 2) {
          signal = 'overbought'
          confidence = Math.min(1, (oscillator - 2) / 2)
        } else if (oscillator < -2) {
          signal = 'oversold'
          confidence = Math.min(1, (-oscillator - 2) / 2)
        }

        const reversionSignal: ReversionSignal = {
          symbol,
          signal,
          oscillator: Math.round(oscillator * 1000) / 1000,
          confidence,
          message: `${symbol}: ${signal} (oscillator=${oscillator.toFixed(3)}, threshold=±2.0)`,
          timestamp: new Date(),
        }

        signals.push(reversionSignal)
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
