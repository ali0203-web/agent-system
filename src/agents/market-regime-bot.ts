import { BaseAgent, AgentConfig } from '../base-agent'
import { getBinanceAPI } from '../services/binance-api'

interface RegimeSignal {
  symbol: string
  regime: 'bull' | 'bear' | 'sideways'
  confidence: number
  trend: 'uptrend' | 'downtrend' | 'ranging'
  message: string
  timestamp: Date
}

export class MarketRegimeBot extends BaseAgent {
  config: AgentConfig = {
    name: 'market-regime-bot',
    category: 'trading',
    description: 'Market regime detection for bull/bear/sideways movements',
    version: '1.0.0',
    schedule: '*/15 * * * *',
    timeout: 15000,
  }

  private symbols = ['BTCUSDT', 'ETHUSDT', 'ADAUSDT', 'SOLUSDT', 'XRPUSDT']
  private priceHistory: Map<string, number[]> = new Map()

  async execute(): Promise<any> {
    this.logger.info(`Detecting market regimes for ${this.symbols.length} pairs...`)
    try {
      const prices = await this.fetchPrices()
      const signals = await this.analyzeRegimes(prices)

      if (signals.length > 0) {
        for (const signal of signals) {
          this.logger.warn(`🎯 Market ${signal.regime.toUpperCase()}: ${signal.message}`)
          await this.publishEvent('regime-signal', signal)
        }
      }

      this.logger.info(`✅ Regime analysis complete: ${signals.length} signals`)
      return { success: true, signalCount: signals.length, signals, timestamp: new Date() }
    } catch (error) {
      this.logger.error('Failed to analyze regimes', error)
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

  private async analyzeRegimes(prices: Record<string, number>): Promise<RegimeSignal[]> {
    const signals: RegimeSignal[] = []

    for (const symbol of this.symbols) {
      const price = prices[symbol]
      if (!price) continue

      if (!this.priceHistory.has(symbol)) {
        this.priceHistory.set(symbol, [])
      }

      const history = this.priceHistory.get(symbol)!
      history.push(price)

      if (history.length > 50) {
        history.shift()
      }

      if (history.length === 50) {
        const regime = this.detectRegime(history)
        const trend = this.detectTrend(history)
        const confidence = this.calculateConfidence(history)

        const signal: RegimeSignal = {
          symbol,
          regime: regime as 'bull' | 'bear' | 'sideways',
          confidence,
          trend: trend as 'uptrend' | 'downtrend' | 'ranging',
          message: `${symbol}: ${regime} market, ${trend}, confidence=${(confidence * 100).toFixed(0)}%`,
          timestamp: new Date(),
        }

        signals.push(signal)
      }
    }

    return signals
  }

  private detectRegime(history: number[]): string {
    const first = history[0]
    const last = history[history.length - 1]
    const change = (last - first) / first

    if (change > 0.05) return 'bull'
    if (change < -0.05) return 'bear'
    return 'sideways'
  }

  private detectTrend(history: number[]): string {
    const recent = history.slice(-10)
    const older = history.slice(-20, -10)
    const recentAvg = recent.reduce((a, b) => a + b) / recent.length
    const olderAvg = older.reduce((a, b) => a + b) / older.length

    if (recentAvg > olderAvg * 1.02) return 'uptrend'
    if (recentAvg < olderAvg * 0.98) return 'downtrend'
    return 'ranging'
  }

  private calculateConfidence(history: number[]): number {
    const volatility = Math.sqrt(history.reduce((sum, val, i) => {
      if (i === 0) return sum
      return sum + Math.pow(val - history[i - 1], 2)
    }, 0) / history.length) / history[0]

    return Math.max(0, Math.min(1, 1 - volatility))
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
