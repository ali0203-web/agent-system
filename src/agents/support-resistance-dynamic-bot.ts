import { BaseAgent, AgentConfig } from '../base-agent'
import { getBinanceAPI } from '../services/binance-api'

interface LevelSignal {
  symbol: string
  levelType: 'support' | 'resistance'
  level: number
  distance: number
  strength: number
  message: string
  timestamp: Date
}

export class SupportResistanceDynamicBot extends BaseAgent {
  config: AgentConfig = {
    name: 'support-resistance-dynamic-bot',
    category: 'trading',
    description: 'Auto-detected support and resistance levels',
    version: '1.0.0',
    schedule: '*/10 * * * *',
    timeout: 15000,
  }

  private symbols = ['BTCUSDT', 'ETHUSDT', 'ADAUSDT', 'SOLUSDT', 'XRPUSDT']
  private priceHistory: Map<string, number[]> = new Map()

  async execute(): Promise<any> {
    this.logger.info(`Detecting S/R levels in ${this.symbols.length} pairs...`)
    try {
      const prices = await this.fetchPrices()
      const signals = await this.detectLevels(prices)

      if (signals.length > 0) {
        for (const signal of signals) {
          const icon = signal.levelType === 'support' ? '🔽' : '🔼'
          this.logger.info(`${icon} ${signal.levelType.toUpperCase()}: ${signal.message}`)
          await this.publishEvent('level-signal', signal)
        }
      }

      this.logger.info(`✅ Level detection complete: ${signals.length} signals`)
      return { success: true, signalCount: signals.length, signals, timestamp: new Date() }
    } catch (error) {
      this.logger.error('Failed to detect levels', error)
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

  private async detectLevels(prices: Record<string, number>): Promise<LevelSignal[]> {
    const signals: LevelSignal[] = []

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
        const high = Math.max(...history)
        const low = Math.min(...history)
        const mid = (high + low) / 2

        const levels = [
          { type: 'resistance' as const, level: high, strength: 0.9 },
          { type: 'resistance' as const, level: high * 0.95 + low * 0.05, strength: 0.7 },
          { type: 'support' as const, level: mid, strength: 0.6 },
          { type: 'support' as const, level: low * 0.95 + high * 0.05, strength: 0.7 },
          { type: 'support' as const, level: low, strength: 0.9 },
        ]

        for (const levelInfo of levels) {
          const distance = ((price - levelInfo.level) / levelInfo.level) * 100
          if (Math.abs(distance) < 1) {
            const signal: LevelSignal = {
              symbol,
              levelType: levelInfo.type,
              level: Math.round(levelInfo.level * 100) / 100,
              distance: Math.round(distance * 100) / 100,
              strength: levelInfo.strength,
              message: `${symbol}: ${levelInfo.type} at ${levelInfo.level.toFixed(2)} (${distance.toFixed(2)}% away, strength=${levelInfo.strength})`,
              timestamp: new Date(),
            }
            signals.push(signal)
          }
        }
      }
    }

    return signals
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
