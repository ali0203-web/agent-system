import { BaseAgent, AgentConfig } from '../base-agent'
import { getBinanceAPI } from '../services/binance-api'

interface PatternSignal {
  symbol: string
  pattern: string
  confidence: number
  message: string
  timestamp: Date
}

export class PatternRecognitionBot extends BaseAgent {
  config: AgentConfig = {
    name: 'pattern-recognition-bot',
    category: 'trading',
    description: 'Chart pattern recognition for trading signals',
    version: '1.0.0',
    schedule: '*/10 * * * *',
    timeout: 15000,
  }

  private symbols = ['BTCUSDT', 'ETHUSDT', 'ADAUSDT', 'SOLUSDT', 'XRPUSDT']
  private priceHistory: Map<string, number[]> = new Map()

  async execute(): Promise<any> {
    this.logger.info(`Scanning for chart patterns in ${this.symbols.length} pairs...`)
    try {
      const prices = await this.fetchPrices()
      const signals = await this.analyzePatterns(prices)

      if (signals.length > 0) {
        for (const signal of signals) {
          this.logger.warn(`📊 Pattern ${signal.pattern}: ${signal.message}`)
          await this.publishEvent('pattern-signal', signal)
        }
      }

      this.logger.info(`✅ Pattern analysis complete: ${signals.length} patterns`)
      return { success: true, signalCount: signals.length, signals, timestamp: new Date() }
    } catch (error) {
      this.logger.error('Failed to analyze patterns', error)
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

  private async analyzePatterns(prices: Record<string, number>): Promise<PatternSignal[]> {
    const signals: PatternSignal[] = []

    for (const symbol of this.symbols) {
      const price = prices[symbol]
      if (!price) continue

      if (!this.priceHistory.has(symbol)) {
        this.priceHistory.set(symbol, [])
      }

      const history = this.priceHistory.get(symbol)!
      history.push(price)
      if (history.length > 30) history.shift()

      if (history.length >= 10) {
        const patterns = this.detectPatterns(history)

        for (const pattern of patterns) {
          const signal: PatternSignal = {
            symbol,
            pattern: pattern.name,
            confidence: pattern.confidence,
            message: `${symbol}: ${pattern.name} detected with ${(pattern.confidence * 100).toFixed(0)}% confidence`,
            timestamp: new Date(),
          }
          signals.push(signal)
        }
      }
    }

    return signals
  }

  private detectPatterns(history: number[]): { name: string; confidence: number }[] {
    const patterns: { name: string; confidence: number }[] = []
    const recent = history.slice(-5)

    // Head and shoulders pattern
    if (recent[0] < recent[1] && recent[1] > recent[2] && recent[2] < recent[3] && recent[3] > recent[4]) {
      patterns.push({ name: 'Head & Shoulders', confidence: 0.7 })
    }

    // Double bottom
    if (Math.abs(recent[0] - recent[2]) < recent[0] * 0.01 && recent[1] > recent[0] && recent[1] > recent[2]) {
      patterns.push({ name: 'Double Bottom', confidence: 0.75 })
    }

    // Triangle
    const trend = Math.abs(recent[4] - recent[0]) < recent[0] * 0.02
    if (trend) {
      patterns.push({ name: 'Triangle', confidence: 0.6 })
    }

    return patterns
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
