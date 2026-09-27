import { BaseAgent, AgentConfig } from '../base-agent'
import { getBinanceAPI } from '../services/binance-api'

interface KeltnerSignal {
  symbol: string
  signal: 'breakout' | 'ranging' | 'neutral'
  upperChannel: number
  lowerChannel: number
  confidence: number
  message: string
  timestamp: Date
}

export class KeltnerChannelBot extends BaseAgent {
  config: AgentConfig = {
    name: 'keltner-channel-bot',
    category: 'trading',
    description: 'Keltner Channel analysis for trend confirmation',
    version: '1.0.0',
    schedule: '*/5 * * * *',
    timeout: 15000,
  }

  private symbols = ['BTCUSDT', 'ETHUSDT', 'ADAUSDT', 'SOLUSDT', 'XRPUSDT']
  private priceHistory: Map<string, number[]> = new Map()

  async execute(): Promise<any> {
    this.logger.info(`Analyzing Keltner Channels in ${this.symbols.length} pairs...`)
    try {
      const prices = await this.fetchPrices()
      const signals = await this.analyzeChannels(prices)

      if (signals.length > 0) {
        for (const signal of signals) {
          this.logger.info(`🔀 KC ${signal.signal.toUpperCase()}: ${signal.message}`)
          await this.publishEvent('keltner-signal', signal)
        }
      }

      this.logger.info(`✅ Channel analysis complete: ${signals.length} signals`)
      return { success: true, signalCount: signals.length, signals, timestamp: new Date() }
    } catch (error) {
      this.logger.error('Failed to analyze channels', error)
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

  private async analyzeChannels(prices: Record<string, number>): Promise<KeltnerSignal[]> {
    const signals: KeltnerSignal[] = []

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
        const ema = this.calculateEMA(history, 10)
        const atr = this.calculateATR(history, 10)

        const upperChannel = ema + 2 * atr
        const lowerChannel = ema - 2 * atr

        let signal: 'breakout' | 'ranging' | 'neutral' = 'neutral'
        let confidence = 0

        if (price > upperChannel) {
          signal = 'breakout'
          confidence = Math.min(1, (price - upperChannel) / (upperChannel * 0.02))
        } else if (price < lowerChannel) {
          signal = 'ranging'
          confidence = Math.min(1, (lowerChannel - price) / (lowerChannel * 0.02))
        }

        const keltnerSignal: KeltnerSignal = {
          symbol,
          signal,
          upperChannel: Math.round(upperChannel * 100) / 100,
          lowerChannel: Math.round(lowerChannel * 100) / 100,
          confidence,
          message: `${symbol}: ${signal} - Upper=${upperChannel.toFixed(2)}, Lower=${lowerChannel.toFixed(2)}`,
          timestamp: new Date(),
        }

        signals.push(keltnerSignal)
      }
    }

    return signals
  }

  private calculateEMA(prices: number[], period: number): number {
    const multiplier = 2 / (period + 1)
    let ema = prices[0]
    for (let i = 1; i < prices.length; i++) {
      ema = prices[i] * multiplier + ema * (1 - multiplier)
    }
    return ema
  }

  private calculateATR(prices: number[], period: number): number {
    let tr = 0
    for (let i = 1; i < prices.length; i++) {
      tr += Math.abs(prices[i] - prices[i - 1])
    }
    return tr / (prices.length - 1)
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
