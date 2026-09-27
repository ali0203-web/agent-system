import { BaseAgent, AgentConfig } from '../base-agent'
import { getBinanceAPI } from '../services/binance-api'

interface IchimokuSignal {
  symbol: string
  signal: 'bullish' | 'bearish' | 'neutral'
  cloudColor: 'green' | 'red'
  conversionLineValue: number
  baseLineValue: number
  leadingSpanA: number
  leadingSpanB: number
  message: string
  timestamp: Date
}

export class IchimokuBot extends BaseAgent {
  config: AgentConfig = {
    name: 'ichimoku-bot',
    category: 'trading',
    description: 'Ichimoku Cloud based trading strategy for Japanese candlestick analysis',
    version: '1.0.0',
    schedule: '*/5 * * * *', // Every 5 minutes
    timeout: 15000,
  }

  private symbols = ['BTCUSDT', 'ETHUSDT', 'ADAUSDT', 'SOLUSDT', 'XRPUSDT']
  private priceHistory: Map<string, number[]> = new Map()

  async execute(): Promise<any> {
    this.logger.info(`Analyzing ${this.symbols.length} pairs with Ichimoku Cloud...`)

    try {
      const prices = await this.fetchPrices()
      const signals = await this.analyzeIchimoku(prices)

      if (signals.length > 0) {
        for (const signal of signals) {
          this.logger.warn(`☁️ ${signal.signal.toUpperCase()}: ${signal.message}`)
          await this.publishEvent('ichimoku-signal', signal)
        }
      }

      this.logger.info(`✅ Ichimoku analysis complete: ${signals.length} signals`)

      return {
        success: true,
        signalCount: signals.length,
        signals,
        timestamp: new Date(),
      }
    } catch (error) {
      this.logger.error('Failed to analyze Ichimoku', error)
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

  private async analyzeIchimoku(prices: Record<string, number>): Promise<IchimokuSignal[]> {
    const signals: IchimokuSignal[] = []

    for (const symbol of this.symbols) {
      const price = prices[symbol]
      if (!price) continue

      // Initialize history
      if (!this.priceHistory.has(symbol)) {
        this.priceHistory.set(symbol, [])
      }
      const history = this.priceHistory.get(symbol)!
      history.push(price)

      // Keep last 52 prices (26 * 2 for accurate Ichimoku calculation)
      if (history.length > 52) {
        history.shift()
      }

      if (history.length >= 26) {
        // Calculate Ichimoku components
        const conversion = this.calculateConversionLine(history)
        const baseLine = this.calculateBaseLine(history)
        const spanA = (conversion + baseLine) / 2
        const spanB = this.calculateLeadingSpanB(history)

        // Determine signal
        const signal = this.getSignal(price, conversion, baseLine, spanA, spanB)
        const cloudColor = spanA > spanB ? 'green' : 'red'

        const ichimokuSignal: IchimokuSignal = {
          symbol,
          signal,
          cloudColor,
          conversionLineValue: conversion,
          baseLineValue: baseLine,
          leadingSpanA: spanA,
          leadingSpanB: spanB,
          message: `${symbol}: Cloud is ${cloudColor}, Price vs Conversion: ${price > conversion ? 'above' : 'below'}`,
          timestamp: new Date(),
        }

        if (signal !== 'neutral') {
          signals.push(ichimokuSignal)
        }
      }
    }

    return signals
  }

  private calculateConversionLine(prices: number[]): number {
    const last9 = prices.slice(-9)
    const high9 = Math.max(...last9)
    const low9 = Math.min(...last9)
    return (high9 + low9) / 2
  }

  private calculateBaseLine(prices: number[]): number {
    const last26 = prices.slice(-26)
    const high26 = Math.max(...last26)
    const low26 = Math.min(...last26)
    return (high26 + low26) / 2
  }

  private calculateLeadingSpanB(prices: number[]): number {
    const last52 = prices.slice(-52)
    const high52 = Math.max(...last52)
    const low52 = Math.min(...last52)
    return (high52 + low52) / 2
  }

  private getSignal(
    price: number,
    conversion: number,
    baseLine: number,
    spanA: number,
    spanB: number
  ): 'bullish' | 'bearish' | 'neutral' {
    // Bullish: Price above cloud, conversion > base line
    if (price > Math.max(spanA, spanB) && conversion > baseLine) {
      return 'bullish'
    }
    // Bearish: Price below cloud, conversion < base line
    if (price < Math.min(spanA, spanB) && conversion < baseLine) {
      return 'bearish'
    }
    return 'neutral'
  }

  async validate(): Promise<boolean> {
    this.logger.info('Validating IchimokuBot...')
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
