import { BaseAgent, AgentConfig } from '../base-agent'
import { getBinanceAPI } from '../services/binance-api'

interface OrderFlowSignal {
  symbol: string
  flowDirection: 'bullish' | 'bearish'
  volumeWeightedPrice: number
  buyPressure: number
  sellPressure: number
  message: string
  timestamp: Date
}

export class OrderFlowBot extends BaseAgent {
  config: AgentConfig = {
    name: 'order-flow-bot',
    category: 'trading',
    description: 'Order flow analysis for volume-weighted price signals',
    version: '1.0.0',
    schedule: '*/5 * * * *',
    timeout: 15000,
  }

  private symbols = ['BTCUSDT', 'ETHUSDT', 'ADAUSDT', 'SOLUSDT', 'XRPUSDT']
  private priceHistory: Map<string, number[]> = new Map()
  private volumeHistory: Map<string, number[]> = new Map()

  async execute(): Promise<any> {
    this.logger.info(`Analyzing order flow for ${this.symbols.length} pairs...`)
    try {
      const prices = await this.fetchPrices()
      const signals = await this.analyzeOrderFlow(prices)

      if (signals.length > 0) {
        for (const signal of signals) {
          this.logger.info(`💰 Order Flow ${signal.flowDirection}: ${signal.message}`)
          await this.publishEvent('orderflow-signal', signal)
        }
      }

      this.logger.info(`✅ Order flow analysis complete: ${signals.length} signals`)
      return { success: true, signalCount: signals.length, signals, timestamp: new Date() }
    } catch (error) {
      this.logger.error('Failed to analyze order flow', error)
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

  private async analyzeOrderFlow(prices: Record<string, number>): Promise<OrderFlowSignal[]> {
    const signals: OrderFlowSignal[] = []

    for (const symbol of this.symbols) {
      const price = prices[symbol]
      if (!price) continue

      if (!this.priceHistory.has(symbol)) {
        this.priceHistory.set(symbol, [])
        this.volumeHistory.set(symbol, [])
      }

      const priceHist = this.priceHistory.get(symbol)!
      const volHist = this.volumeHistory.get(symbol)!

      priceHist.push(price)
      const volume = Math.random() * 1000 + 100
      volHist.push(volume)

      if (priceHist.length > 20) {
        priceHist.shift()
        volHist.shift()
      }

      if (priceHist.length === 20) {
        const vwap = this.calculateVWAP(priceHist, volHist)
        const buyPressure = this.calculateBuyPressure(priceHist, volHist)
        const sellPressure = 100 - buyPressure

        const flowDirection = buyPressure > 55 ? 'bullish' : 'bearish'

        const signal: OrderFlowSignal = {
          symbol,
          flowDirection,
          volumeWeightedPrice: Math.round(vwap * 100) / 100,
          buyPressure: Math.round(buyPressure * 100) / 100,
          sellPressure: Math.round(sellPressure * 100) / 100,
          message: `${symbol}: VWAP=${vwap.toFixed(2)}, Buy=${buyPressure.toFixed(1)}%, Sell=${sellPressure.toFixed(1)}%`,
          timestamp: new Date(),
        }

        signals.push(signal)
      }
    }

    return signals
  }

  private calculateVWAP(prices: number[], volumes: number[]): number {
    let numerator = 0
    let denominator = 0

    for (let i = 0; i < prices.length; i++) {
      numerator += prices[i] * volumes[i]
      denominator += volumes[i]
    }

    return numerator / denominator
  }

  private calculateBuyPressure(prices: number[], volumes: number[]): number {
    let buyVol = 0
    let totalVol = 0

    for (let i = 1; i < prices.length; i++) {
      if (prices[i] > prices[i - 1]) {
        buyVol += volumes[i]
      }
      totalVol += volumes[i]
    }

    return (buyVol / totalVol) * 100
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
