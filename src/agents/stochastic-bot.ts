import { BaseAgent, AgentConfig } from '../base-agent'
import { getBinanceAPI } from '../services/binance-api'

interface StochasticSignal {
  symbol: string
  signal: 'overbought' | 'oversold' | 'neutral'
  kValue: number
  dValue: number
  crossover: 'bullish' | 'bearish' | 'none'
  message: string
  timestamp: Date
}

export class StochasticBot extends BaseAgent {
  config: AgentConfig = {
    name: 'stochastic-bot',
    category: 'trading',
    description: 'Stochastic Oscillator trading strategy for momentum analysis',
    version: '1.0.0',
    schedule: '*/5 * * * *', // Every 5 minutes
    timeout: 15000,
  }

  private symbols = ['BTCUSDT', 'ETHUSDT', 'ADAUSDT', 'SOLUSDT', 'XRPUSDT']
  private priceHistory: Map<string, number[]> = new Map()
  private kHistory: Map<string, number[]> = new Map()
  private dHistory: Map<string, number[]> = new Map()

  async execute(): Promise<any> {
    this.logger.info(`Scanning ${this.symbols.length} pairs with Stochastic Oscillator...`)

    try {
      const prices = await this.fetchPrices()
      const signals = await this.analyzeStochastic(prices)

      if (signals.length > 0) {
        for (const signal of signals) {
          this.logger.warn(`📊 ${signal.signal.toUpperCase()}: ${signal.message}`)
          await this.publishEvent('stochastic-signal', signal)
        }
      }

      this.logger.info(`✅ Stochastic analysis complete: ${signals.length} signals`)

      return {
        success: true,
        signalCount: signals.length,
        signals,
        timestamp: new Date(),
      }
    } catch (error) {
      this.logger.error('Failed to analyze stochastic', error)
      throw error
    }
  }

  private async fetchPrices(): Promise<Record<string, number>> {
    try {
      const binance = getBinanceAPI()
      const prices = await binance.getPrices(this.symbols)
      return prices || {}
    } catch (error) {
      this.logger.error('Failed to fetch prices', error)
      throw error
    }
  }

  private async analyzeStochastic(prices: Record<string, number>): Promise<StochasticSignal[]> {
    const signals: StochasticSignal[] = []

    for (const symbol of this.symbols) {
      const price = prices[symbol]
      if (!price) continue

      // Initialize histories
      if (!this.priceHistory.has(symbol)) {
        this.priceHistory.set(symbol, [])
        this.kHistory.set(symbol, [])
        this.dHistory.set(symbol, [])
      }

      const priceHist = this.priceHistory.get(symbol)!
      priceHist.push(price)

      // Keep last 14 prices for %K calculation
      if (priceHist.length > 14) {
        priceHist.shift()
      }

      if (priceHist.length === 14) {
        // Calculate %K (Stochastic)
        const low14 = Math.min(...priceHist)
        const high14 = Math.max(...priceHist)
        const kValue = ((price - low14) / (high14 - low14)) * 100

        const kHist = this.kHistory.get(symbol)!
        kHist.push(kValue)

        // Keep last 3 K values for D calculation (SMA of K)
        if (kHist.length > 3) {
          kHist.shift()
        }

        let dValue = kValue
        if (kHist.length === 3) {
          dValue = (kHist[0] + kHist[1] + kHist[2]) / 3
        }

        const dHist = this.dHistory.get(symbol)!
        dHist.push(dValue)

        // Detect crossover
        const crossover = this.detectCrossover(kHist, dHist)

        // Determine signal
        let signal: 'overbought' | 'oversold' | 'neutral' = 'neutral'
        if (kValue > 80) signal = 'overbought'
        else if (kValue < 20) signal = 'oversold'

        const stochasticSignal: StochasticSignal = {
          symbol,
          signal,
          kValue: Math.round(kValue * 100) / 100,
          dValue: Math.round(dValue * 100) / 100,
          crossover,
          message: `${symbol}: K=${Math.round(kValue)}% D=${Math.round(dValue)}% ${crossover !== 'none' ? `- ${crossover} crossover` : ''}`,
          timestamp: new Date(),
        }

        if (signal !== 'neutral' || crossover !== 'none') {
          signals.push(stochasticSignal)
        }
      }
    }

    return signals
  }

  private detectCrossover(kHist: number[], dHist: number[]): 'bullish' | 'bearish' | 'none' {
    if (kHist.length < 2 || dHist.length < 2) return 'none'

    const prevK = kHist[kHist.length - 2]
    const currK = kHist[kHist.length - 1]
    const prevD = dHist[dHist.length - 2]
    const currD = dHist[dHist.length - 1]

    // Bullish crossover: K crosses above D
    if (prevK <= prevD && currK > currD) {
      return 'bullish'
    }

    // Bearish crossover: K crosses below D
    if (prevK >= prevD && currK < currD) {
      return 'bearish'
    }

    return 'none'
  }

  async validate(): Promise<boolean> {
    this.logger.info('Validating StochasticBot...')
    try {
      if (this.symbols.length === 0) {
        throw new Error('No symbols configured')
      }
      const prices = await this.fetchPrices()
      if (!prices || Object.keys(prices).length === 0) {
        throw new Error('Failed to fetch prices')
      }
      this.logger.info(`✅ Validation successful. Monitoring ${this.symbols.length} pairs`)
      return true
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
      this.logger.error('Health check failed', error)
      return false
    }
  }
}
