import { BaseAgent, AgentConfig } from '../base-agent'
import { getBinanceAPI } from '../services/binance-api'

interface ATRSignal {
  symbol: string
  atrValue: number
  volatilityLevel: 'low' | 'medium' | 'high'
  recommendedStopLoss: number
  message: string
  timestamp: Date
}

export class ATRBot extends BaseAgent {
  config: AgentConfig = {
    name: 'atr-bot',
    category: 'trading',
    description: 'Average True Range based volatility and position sizing strategy',
    version: '1.0.0',
    schedule: '*/5 * * * *',
    timeout: 15000,
  }

  private symbols = ['BTCUSDT', 'ETHUSDT', 'ADAUSDT', 'SOLUSDT', 'XRPUSDT']
  private priceHistory: Map<string, { high: number; low: number; close: number }[]> = new Map()

  async execute(): Promise<any> {
    this.logger.info(`Analyzing volatility with ATR for ${this.symbols.length} pairs...`)

    try {
      const prices = await this.fetchPrices()
      const signals = await this.analyzeATR(prices)

      if (signals.length > 0) {
        for (const signal of signals) {
          this.logger.info(`📈 ATR Signal: ${signal.message}`)
          await this.publishEvent('atr-signal', signal)
        }
      }

      this.logger.info(`✅ ATR analysis complete: ${signals.length} signals`)

      return {
        success: true,
        signalCount: signals.length,
        signals,
        timestamp: new Date(),
      }
    } catch (error) {
      this.logger.error('Failed to analyze ATR', error)
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

  private async analyzeATR(prices: Record<string, number>): Promise<ATRSignal[]> {
    const signals: ATRSignal[] = []

    for (const symbol of this.symbols) {
      const price = prices[symbol]
      if (!price) continue

      if (!this.priceHistory.has(symbol)) {
        this.priceHistory.set(symbol, [])
      }

      const history = this.priceHistory.get(symbol)!
      // Simulate high/low with price variations
      const high = price * (1 + Math.random() * 0.01)
      const low = price * (1 - Math.random() * 0.01)
      history.push({ high, low, close: price })

      if (history.length > 14) {
        history.shift()
      }

      if (history.length === 14) {
        const atr = this.calculateATR(history)
        const volatilityLevel = this.getVolatilityLevel(atr, price)
        const stopLoss = price - atr * 2

        const signal: ATRSignal = {
          symbol,
          atrValue: Math.round(atr * 100) / 100,
          volatilityLevel,
          recommendedStopLoss: Math.round(stopLoss * 100) / 100,
          message: `${symbol}: ATR=${atr.toFixed(2)}, Volatility=${volatilityLevel}, SL=${stopLoss.toFixed(2)}`,
          timestamp: new Date(),
        }

        signals.push(signal)
      }
    }

    return signals
  }

  private calculateATR(history: { high: number; low: number; close: number }[]): number {
    let sumTR = 0
    for (const bar of history) {
      const tr = bar.high - bar.low
      sumTR += tr
    }
    return sumTR / history.length
  }

  private getVolatilityLevel(atr: number, price: number): 'low' | 'medium' | 'high' {
    const atrPercent = (atr / price) * 100
    if (atrPercent < 1) return 'low'
    if (atrPercent < 2) return 'medium'
    return 'high'
  }

  async validate(): Promise<boolean> {
    try {
      const prices = await this.fetchPrices()
      return Object.keys(prices).length > 0
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
      return false
    }
  }
}
