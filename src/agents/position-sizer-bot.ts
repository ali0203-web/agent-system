import { BaseAgent, AgentConfig } from '../base-agent'
import { getBinanceAPI } from '../services/binance-api'

interface PositionSignal {
  symbol: string
  recommendedSize: number
  riskLevel: 'low' | 'medium' | 'high'
  volatility: number
  maxLoss: number
  message: string
  timestamp: Date
}

export class PositionSizerBot extends BaseAgent {
  config: AgentConfig = {
    name: 'position-sizer-bot',
    category: 'trading',
    description: 'Risk-adjusted position sizing based on volatility',
    version: '1.0.0',
    schedule: '*/10 * * * *',
    timeout: 15000,
  }

  private symbols = ['BTCUSDT', 'ETHUSDT', 'ADAUSDT', 'SOLUSDT', 'XRPUSDT']
  private priceHistory: Map<string, number[]> = new Map()
  private accountBalance = 10000

  async execute(): Promise<any> {
    this.logger.info(`Calculating position sizes for ${this.symbols.length} symbols...`)
    try {
      const prices = await this.fetchPrices()
      const signals = await this.calculatePositions(prices)

      if (signals.length > 0) {
        for (const signal of signals) {
          const riskIcon = signal.riskLevel === 'low' ? '🟢' : signal.riskLevel === 'medium' ? '🟡' : '🔴'
          this.logger.info(`${riskIcon} SIZE: ${signal.message}`)
          await this.publishEvent('position-signal', signal)
        }
      }

      this.logger.info(`✅ Position sizing complete: ${signals.length} signals`)
      return { success: true, signalCount: signals.length, signals, timestamp: new Date() }
    } catch (error) {
      this.logger.error('Failed to calculate positions', error)
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

  private async calculatePositions(prices: Record<string, number>): Promise<PositionSignal[]> {
    const signals: PositionSignal[] = []

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
        const volatility = this.calculateVolatility(history)
        let riskLevel: 'low' | 'medium' | 'high' = 'medium'
        let positionPercent = 2

        if (volatility < 0.01) {
          riskLevel = 'low'
          positionPercent = 3
        } else if (volatility > 0.03) {
          riskLevel = 'high'
          positionPercent = 1
        }

        const recommendedSize = (this.accountBalance * positionPercent) / 100 / price
        const stopLoss = price * (1 - 2 * volatility)
        const maxLoss = recommendedSize * Math.abs(price - stopLoss)

        const positionSignal: PositionSignal = {
          symbol,
          recommendedSize: Math.round(recommendedSize * 1000) / 1000,
          riskLevel,
          volatility: Math.round(volatility * 10000) / 10000,
          maxLoss: Math.round(maxLoss * 100) / 100,
          message: `${symbol}: Size=${recommendedSize.toFixed(3)} (volatility=${volatility.toFixed(4)}, risk=${riskLevel}, maxLoss=${maxLoss.toFixed(2)})`,
          timestamp: new Date(),
        }

        signals.push(positionSignal)
      }
    }

    return signals
  }

  private calculateVolatility(prices: number[]): number {
    if (prices.length < 2) return 0
    const returns = prices.slice(1).map((p, i) => (p - prices[i]) / prices[i])
    const mean = returns.reduce((a, b) => a + b, 0) / returns.length
    const variance = returns.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) / returns.length
    return Math.sqrt(variance)
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
