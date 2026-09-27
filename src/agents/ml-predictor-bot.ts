import { BaseAgent, AgentConfig } from '../base-agent'
import { getBinanceAPI } from '../services/binance-api'

interface MLSignal {
  symbol: string
  prediction: 'bullish' | 'bearish' | 'neutral'
  confidence: number
  predictedPrice: number
  features: Record<string, number>
  message: string
  timestamp: Date
}

export class MLPredictorBot extends BaseAgent {
  config: AgentConfig = {
    name: 'ml-predictor-bot',
    category: 'trading',
    description: 'Machine learning based price prediction signals',
    version: '1.0.0',
    schedule: '*/15 * * * *',
    timeout: 20000,
  }

  private symbols = ['BTCUSDT', 'ETHUSDT', 'ADAUSDT', 'SOLUSDT', 'XRPUSDT']
  private priceHistory: Map<string, number[]> = new Map()
  private volatilityHistory: Map<string, number[]> = new Map()
  private momentumHistory: Map<string, number[]> = new Map()

  async execute(): Promise<any> {
    this.logger.info(`Running ML predictions for ${this.symbols.length} pairs...`)
    try {
      const prices = await this.fetchPrices()
      const signals = await this.predictPrices(prices)

      if (signals.length > 0) {
        for (const signal of signals) {
          this.logger.info(`🤖 ML Prediction ${signal.prediction}: ${signal.message}`)
          await this.publishEvent('ml-signal', signal)
        }
      }

      this.logger.info(`✅ ML predictions complete: ${signals.length} signals`)
      return { success: true, signalCount: signals.length, signals, timestamp: new Date() }
    } catch (error) {
      this.logger.error('Failed to run ML predictions', error)
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

  private async predictPrices(prices: Record<string, number>): Promise<MLSignal[]> {
    const signals: MLSignal[] = []

    for (const symbol of this.symbols) {
      const price = prices[symbol]
      if (!price) continue

      if (!this.priceHistory.has(symbol)) {
        this.priceHistory.set(symbol, [])
        this.volatilityHistory.set(symbol, [])
        this.momentumHistory.set(symbol, [])
      }

      const priceHist = this.priceHistory.get(symbol)!
      const volHist = this.volatilityHistory.get(symbol)!
      const momHist = this.momentumHistory.get(symbol)!

      priceHist.push(price)
      if (priceHist.length > 50) priceHist.shift()

      // Calculate features
      const volatility = this.calculateVolatility(priceHist)
      volHist.push(volatility)
      if (volHist.length > 10) volHist.shift()

      const momentum = this.calculateMomentum(priceHist)
      momHist.push(momentum)
      if (momHist.length > 10) momHist.shift()

      if (priceHist.length >= 20) {
        const features = {
          volatility,
          momentum,
          rsi: this.calculateRSI(priceHist),
          trend: this.calculateTrend(priceHist),
          meanReversion: this.calculateMeanReversion(priceHist),
        }

        const { prediction, confidence, predictedPrice } = this.predictDirection(
          price,
          features
        )

        const signal: MLSignal = {
          symbol,
          prediction,
          confidence,
          predictedPrice,
          features: Object.fromEntries(
            Object.entries(features).map(([k, v]) => [k, Math.round(v * 1000) / 1000])
          ),
          message: `${symbol}: Predicted ${prediction} with ${(confidence * 100).toFixed(0)}% confidence. Target: ${predictedPrice.toFixed(2)}`,
          timestamp: new Date(),
        }

        if (confidence > 0.6) {
          signals.push(signal)
        }
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

  private calculateMomentum(prices: number[]): number {
    if (prices.length < 2) return 0
    return (prices[prices.length - 1] - prices[0]) / prices[0]
  }

  private calculateRSI(prices: number[]): number {
    if (prices.length < 14) return 50
    const gains = prices.slice(-14).reduce((sum, p, i, arr) => {
      if (i === 0) return sum
      const change = p - arr[i - 1]
      return sum + (change > 0 ? change : 0)
    }, 0)
    const losses = prices.slice(-14).reduce((sum, p, i, arr) => {
      if (i === 0) return sum
      const change = p - arr[i - 1]
      return sum + (change < 0 ? -change : 0)
    }, 0)
    const rs = gains / (losses || 1)
    return 100 - 100 / (1 + rs)
  }

  private calculateTrend(prices: number[]): number {
    const recent = prices.slice(-5).reduce((a, b) => a + b) / 5
    const older = prices.slice(-10, -5).reduce((a, b) => a + b) / 5
    return (recent - older) / older
  }

  private calculateMeanReversion(prices: number[]): number {
    const avg = prices.reduce((a, b) => a + b) / prices.length
    return (avg - prices[prices.length - 1]) / prices[prices.length - 1]
  }

  private predictDirection(
    currentPrice: number,
    features: Record<string, number>
  ): { prediction: 'bullish' | 'bearish' | 'neutral'; confidence: number; predictedPrice: number } {
    // Simple ML model: weighted sum of features
    const score =
      features.momentum * 0.3 +
      (100 - features.rsi) / 100 * 0.2 +
      features.trend * 0.3 +
      features.meanReversion * 0.2

    let prediction: 'bullish' | 'bearish' | 'neutral' = 'neutral'
    let confidence = 0

    if (score > 0.1) {
      prediction = 'bullish'
      confidence = Math.min(1, Math.abs(score) * 1.5)
    } else if (score < -0.1) {
      prediction = 'bearish'
      confidence = Math.min(1, Math.abs(score) * 1.5)
    }

    const predictedPrice = currentPrice * (1 + score * 0.05)

    return { prediction, confidence, predictedPrice }
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
