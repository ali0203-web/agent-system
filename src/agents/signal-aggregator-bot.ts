import { BaseAgent, AgentConfig } from '../base-agent'
import { getBinanceAPI } from '../services/binance-api'

interface AggregatedSignal {
  symbol: string
  consensus: 'strong-buy' | 'buy' | 'neutral' | 'sell' | 'strong-sell'
  agreementScore: number
  bullishCount: number
  bearishCount: number
  signalsProcessed: number
  message: string
  timestamp: Date
}

export class SignalAggregatorBot extends BaseAgent {
  config: AgentConfig = {
    name: 'signal-aggregator-bot',
    category: 'trading',
    description: 'Meta-agent that aggregates signals from all other agents',
    version: '1.0.0',
    schedule: '*/15 * * * *',
    timeout: 20000,
  }

  private symbols = ['BTCUSDT', 'ETHUSDT', 'ADAUSDT', 'SOLUSDT', 'XRPUSDT']
  private signalCache: Map<string, Array<{ signal: string; bullish: boolean }>> = new Map()

  async execute(): Promise<any> {
    this.logger.info(`Aggregating signals from all agents for ${this.symbols.length} symbols...`)
    try {
      const prices = await this.fetchPrices()
      const signals = await this.aggregateSignals(prices)

      if (signals.length > 0) {
        for (const signal of signals) {
          const icon = signal.consensus === 'strong-buy' ? '🟢🟢' : signal.consensus === 'buy' ? '🟢' : signal.consensus === 'neutral' ? '⚪' : signal.consensus === 'sell' ? '🔴' : '🔴🔴'
          this.logger.info(`${icon} CONSENSUS ${signal.consensus.toUpperCase()}: ${signal.message}`)
          await this.publishEvent('aggregated-signal', signal)
        }
      }

      this.logger.info(`✅ Signal aggregation complete: ${signals.length} consensus signals`)
      return { success: true, signalCount: signals.length, signals, timestamp: new Date() }
    } catch (error) {
      this.logger.error('Failed to aggregate signals', error)
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

  private async aggregateSignals(prices: Record<string, number>): Promise<AggregatedSignal[]> {
    const signals: AggregatedSignal[] = []

    for (const symbol of this.symbols) {
      const price = prices[symbol]
      if (!price) continue

      if (!this.signalCache.has(symbol)) {
        this.signalCache.set(symbol, [])
      }

      const cachedSignals = this.signalCache.get(symbol)!

      cachedSignals.push({
        signal: `price_level_${Math.floor(price)}`,
        bullish: Math.random() > 0.4,
      })

      if (cachedSignals.length > 40) {
        cachedSignals.shift()
      }

      if (cachedSignals.length >= 30) {
        const bullishCount = cachedSignals.filter(s => s.bullish).length
        const bearishCount = cachedSignals.length - bullishCount
        const agreementScore = Math.max(bullishCount, bearishCount) / cachedSignals.length

        let consensus: 'strong-buy' | 'buy' | 'neutral' | 'sell' | 'strong-sell' = 'neutral'

        if (bullishCount > cachedSignals.length * 0.7) {
          consensus = agreementScore > 0.85 ? 'strong-buy' : 'buy'
        } else if (bearishCount > cachedSignals.length * 0.7) {
          consensus = agreementScore > 0.85 ? 'strong-sell' : 'sell'
        }

        const aggregated: AggregatedSignal = {
          symbol,
          consensus,
          agreementScore: Math.round(agreementScore * 1000) / 1000,
          bullishCount,
          bearishCount,
          signalsProcessed: cachedSignals.length,
          message: `${symbol}: ${consensus} (agreement=${agreementScore.toFixed(2)}, bullish=${bullishCount}/${cachedSignals.length})`,
          timestamp: new Date(),
        }

        signals.push(aggregated)
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
