import { BaseAgent, AgentConfig } from '../base-agent'
import { getBinanceAPI } from '../services/binance-api'

interface FibonacciSignal {
  symbol: string
  retracement: string
  level: number
  distance: number
  signal: 'support' | 'resistance'
  message: string
  timestamp: Date
}

export class FibonacciBot extends BaseAgent {
  config: AgentConfig = {
    name: 'fibonacci-bot',
    category: 'trading',
    description: 'Fibonacci retracement levels for support and resistance',
    version: '1.0.0',
    schedule: '*/10 * * * *',
    timeout: 15000,
  }

  private symbols = ['BTCUSDT', 'ETHUSDT', 'ADAUSDT', 'SOLUSDT', 'XRPUSDT']
  private priceHistory: Map<string, number[]> = new Map()

  async execute(): Promise<any> {
    this.logger.info(`Analyzing Fibonacci levels for ${this.symbols.length} pairs...`)
    try {
      const prices = await this.fetchPrices()
      const signals = await this.analyzeFibonacci(prices)

      if (signals.length > 0) {
        for (const signal of signals) {
          this.logger.info(`📐 Fibonacci ${signal.signal}: ${signal.message}`)
          await this.publishEvent('fibonacci-signal', signal)
        }
      }

      this.logger.info(`✅ Fibonacci analysis complete: ${signals.length} signals`)
      return { success: true, signalCount: signals.length, signals, timestamp: new Date() }
    } catch (error) {
      this.logger.error('Failed to analyze Fibonacci', error)
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

  private async analyzeFibonacci(prices: Record<string, number>): Promise<FibonacciSignal[]> {
    const signals: FibonacciSignal[] = []
    const fibLevels = [0.236, 0.382, 0.5, 0.618, 0.786]

    for (const symbol of this.symbols) {
      const price = prices[symbol]
      if (!price) continue

      if (!this.priceHistory.has(symbol)) {
        this.priceHistory.set(symbol, [])
      }

      const history = this.priceHistory.get(symbol)!
      history.push(price)
      if (history.length > 50) history.shift()

      if (history.length >= 20) {
        const high = Math.max(...history)
        const low = Math.min(...history)
        const range = high - low

        for (const level of fibLevels) {
          const fibLevel = high - range * level
          const distance = Math.abs(price - fibLevel)

          if (distance < range * 0.02) {
            const signal: FibonacciSignal = {
              symbol,
              retracement: `${(level * 100).toFixed(1)}%`,
              level: Math.round(fibLevel * 100) / 100,
              distance: Math.round(distance * 100) / 100,
              signal: price < fibLevel ? 'support' : 'resistance',
              message: `${symbol}: ${(level * 100).toFixed(1)}% level at ${fibLevel.toFixed(2)}`,
              timestamp: new Date(),
            }
            signals.push(signal)
          }
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
