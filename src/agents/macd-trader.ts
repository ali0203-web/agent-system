import { BaseAgent, AgentConfig } from '../base-agent'
import { getBinanceAPI } from '../services/binance-api'

interface MACDLine {
  macd: number
  signal: number
  histogram: number
  timestamp: Date
}

interface MACDSignal {
  symbol: string
  type: 'bullish-crossover' | 'bearish-crossover' | 'divergence'
  macd: number
  signal: number
  histogram: number
  strength: number
  message: string
  timestamp: Date
}

export class MACDTrader extends BaseAgent {
  config: AgentConfig = {
    name: 'macd-trader',
    category: 'trading',
    description: 'Trade using MACD (Moving Average Convergence Divergence) signals',
    version: '1.0.0',
    schedule: '*/5 * * * *', // Every 5 minutes
    timeout: 15000,
  }

  private symbols = ['BTCUSDT', 'ETHUSDT', 'ADAUSDT', 'SOLUSDT', 'XRPUSDT']
  private fast = 12
  private slow = 26
  private signal = 9
  private priceHistory: Map<string, number[]> = new Map()
  private macdHistory: Map<string, MACDLine[]> = new Map()

  async execute(): Promise<any> {
    this.logger.info(`Scanning ${this.symbols.length} pairs for MACD signals...`)

    try {
      // Fetch current prices
      const prices = await this.fetchPrices()

      // Calculate MACD and detect signals
      const signals = await this.analyzeMACD(prices)

      // Publish signals
      if (signals.length > 0) {
        for (const sig of signals) {
          this.logger.warn(`📊 ${sig.type.toUpperCase()}: ${sig.message}`)
          await this.publishEvent('macd-signal', sig)
        }
      }

      this.logger.info(`✅ MACD analysis complete: Found ${signals.length} signals`)

      return {
        success: true,
        signalCount: signals.length,
        signals,
        timestamp: new Date(),
      }
    } catch (error) {
      this.logger.error('Failed to analyze MACD', error)
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

  private async analyzeMACD(prices: Record<string, number>): Promise<MACDSignal[]> {
    const signals: MACDSignal[] = []

    for (const symbol of this.symbols) {
      const price = prices[symbol]
      if (!price) continue

      // Update price history
      if (!this.priceHistory.has(symbol)) {
        this.priceHistory.set(symbol, [])
      }
      const history = this.priceHistory.get(symbol)!
      history.push(price)

      // Keep last 50 prices
      if (history.length > 50) {
        history.shift()
      }

      // Need at least 26 prices for MACD calculation
      if (history.length < this.slow) {
        continue
      }

      // Calculate MACD
      const macdLine = this.calculateMACD(history)

      // Store history
      if (!this.macdHistory.has(symbol)) {
        this.macdHistory.set(symbol, [])
      }
      const macdHist = this.macdHistory.get(symbol)!
      macdHist.push(macdLine)
      if (macdHist.length > 20) {
        macdHist.shift()
      }

      // Detect signals
      if (macdHist.length >= 2) {
        const signal = this.detectSignal(symbol, macdLine, macdHist)
        if (signal) {
          signals.push(signal)
        }
      }
    }

    return signals
  }

  private calculateEMA(prices: number[], period: number): number[] {
    const k = 2 / (period + 1)
    const ema = [prices[0]]

    for (let i = 1; i < prices.length; i++) {
      ema.push(prices[i] * k + ema[i - 1] * (1 - k))
    }

    return ema
  }

  private calculateMACD(prices: number[]): MACDLine {
    const fastEMA = this.calculateEMA(prices, this.fast)
    const slowEMA = this.calculateEMA(prices, this.slow)

    const macdLine = fastEMA[fastEMA.length - 1] - slowEMA[slowEMA.length - 1]

    // Calculate signal line (9-period EMA of MACD)
    const recentMACD: number[] = []
    for (let i = this.slow - 1; i < prices.length; i++) {
      recentMACD.push(fastEMA[i] - slowEMA[i])
    }

    const signalEMA = this.calculateEMA(recentMACD, this.signal)
    const signalLine = signalEMA[signalEMA.length - 1]

    return {
      macd: macdLine,
      signal: signalLine,
      histogram: macdLine - signalLine,
      timestamp: new Date(),
    }
  }

  private detectSignal(
    symbol: string,
    current: MACDLine,
    history: MACDLine[]
  ): MACDSignal | null {
    const prev = history[history.length - 2]

    // Bullish crossover: MACD crosses above signal line
    if (prev.macd <= prev.signal && current.macd > current.signal) {
      return {
        symbol,
        type: 'bullish-crossover',
        macd: current.macd,
        signal: current.signal,
        histogram: current.histogram,
        strength: Math.abs(current.histogram) / Math.abs(current.macd || 1),
        message: `${symbol} MACD bullish crossover - uptrend potential`,
        timestamp: new Date(),
      }
    }

    // Bearish crossover: MACD crosses below signal line
    if (prev.macd >= prev.signal && current.macd < current.signal) {
      return {
        symbol,
        type: 'bearish-crossover',
        macd: current.macd,
        signal: current.signal,
        histogram: current.histogram,
        strength: Math.abs(current.histogram) / Math.abs(current.macd || 1),
        message: `${symbol} MACD bearish crossover - downtrend potential`,
        timestamp: new Date(),
      }
    }

    // Divergence: MACD histogram increasing strongly
    if (
      history.length >= 3 &&
      Math.abs(current.histogram) > Math.abs(prev.histogram) &&
      Math.abs(prev.histogram) > Math.abs(history[history.length - 3].histogram)
    ) {
      const direction = current.histogram > 0 ? 'bullish' : 'bearish'
      return {
        symbol,
        type: 'divergence',
        macd: current.macd,
        signal: current.signal,
        histogram: current.histogram,
        strength: Math.min(Math.abs(current.histogram) / 0.1, 1),
        message: `${symbol} MACD ${direction} divergence - strengthening momentum`,
        timestamp: new Date(),
      }
    }

    return null
  }

  async validate(): Promise<boolean> {
    this.logger.info('Validating MACDTrader...')

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
