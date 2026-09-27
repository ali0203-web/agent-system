import { BaseAgent, AgentConfig } from '../base-agent'
import { getBinanceAPI } from '../services/binance-api'

interface TrendSignal {
  symbol: string
  strength: 'strong' | 'weak' | 'neutral'
  adx: number
  direction: 'uptrend' | 'downtrend' | 'ranging'
  confidence: number
  message: string
  timestamp: Date
}

export class TrendStrengthBot extends BaseAgent {
  config: AgentConfig = {
    name: 'trend-strength-bot',
    category: 'trading',
    description: 'ADX-based trend strength measurement',
    version: '1.0.0',
    schedule: '*/15 * * * *',
    timeout: 15000,
  }

  private symbols = ['BTCUSDT', 'ETHUSDT', 'ADAUSDT', 'SOLUSDT', 'XRPUSDT']
  private priceHistory: Map<string, number[]> = new Map()

  async execute(): Promise<any> {
    this.logger.info(`Measuring trend strength in ${this.symbols.length} pairs...`)
    try {
      const prices = await this.fetchPrices()
      const signals = await this.measureTrend(prices)

      if (signals.length > 0) {
        for (const signal of signals) {
          const icon = signal.strength === 'strong' ? '💪' : signal.strength === 'weak' ? '🙌' : '⚪'
          this.logger.info(`${icon} TREND ${signal.strength.toUpperCase()}: ${signal.message}`)
          await this.publishEvent('trend-signal', signal)
        }
      }

      this.logger.info(`✅ Trend analysis complete: ${signals.length} signals`)
      return { success: true, signalCount: signals.length, signals, timestamp: new Date() }
    } catch (error) {
      this.logger.error('Failed to measure trend', error)
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

  private async measureTrend(prices: Record<string, number>): Promise<TrendSignal[]> {
    const signals: TrendSignal[] = []

    for (const symbol of this.symbols) {
      const price = prices[symbol]
      if (!price) continue

      if (!this.priceHistory.has(symbol)) {
        this.priceHistory.set(symbol, [])
      }

      const history = this.priceHistory.get(symbol)!
      history.push(price)

      if (history.length > 28) {
        history.shift()
      }

      if (history.length === 28) {
        const adx = this.calculateADX(history)
        const direction = this.getDirection(history)

        let strength: 'strong' | 'weak' | 'neutral' = 'neutral'
        if (adx > 25) {
          strength = 'strong'
        } else if (adx < 20) {
          strength = 'weak'
        }

        const trendSignal: TrendSignal = {
          symbol,
          strength,
          adx: Math.round(adx * 100) / 100,
          direction,
          confidence: Math.min(1, adx / 40),
          message: `${symbol}: ${strength} ${direction} trend (ADX=${adx.toFixed(2)})`,
          timestamp: new Date(),
        }

        signals.push(trendSignal)
      }
    }

    return signals
  }

  private calculateADX(prices: number[]): number {
    let sumTR = 0
    let sumDMPlus = 0
    let sumDMMinus = 0

    for (let i = 1; i < prices.length; i++) {
      const tr = Math.abs(prices[i] - prices[i - 1])
      const dm = prices[i] > prices[i - 1] ? Math.abs(prices[i] - prices[i - 1]) : 0
      const dmMinus = prices[i] < prices[i - 1] ? Math.abs(prices[i] - prices[i - 1]) : 0

      sumTR += tr
      sumDMPlus += dm
      sumDMMinus += dmMinus
    }

    const avgTR = sumTR / (prices.length - 1)
    const diPlus = (sumDMPlus / avgTR) * 100
    const diMinus = (sumDMMinus / avgTR) * 100
    const dx = Math.abs(diPlus - diMinus) / (diPlus + diMinus) * 100

    return Math.max(0, Math.min(100, dx))
  }

  private getDirection(history: number[]): 'uptrend' | 'downtrend' | 'ranging' {
    const recent = history.slice(-10).reduce((a, b) => a + b) / 10
    const older = history.slice(-20, -10).reduce((a, b) => a + b) / 10

    if (recent > older * 1.02) return 'uptrend'
    if (recent < older * 0.98) return 'downtrend'
    return 'ranging'
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
