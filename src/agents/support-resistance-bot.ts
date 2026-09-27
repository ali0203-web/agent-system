import { BaseAgent, AgentConfig } from '../base-agent'
import { getBinanceAPI } from '../services/binance-api'

class SupportResistanceBot extends BaseAgent {
  config: AgentConfig = {
    name: 'support-resistance-bot',
    category: 'trading',
    version: '1.0.0',
    description: 'Support/Resistance Bot - Trades key technical levels',
    schedule: '*/15 * * * *',
  }

  private levels = new Map<string, { support: number; resistance: number }>()

  async execute(): Promise<void> {
    this.logger.info('📊 Support/Resistance Bot: Analyzing technical levels...')
    try {
      const prices = await this.fetchPrices()
      for (const [symbol, price] of Object.entries(prices)) {
        const level = this.calculateLevels(symbol, price)
        this.levels.set(symbol, level)
        if (price <= level.support) {
          this.logger.info(`📍 SUPPORT BOUNCE ${symbol}: Buy @ $${price.toFixed(2)}`)
          this.emit('support-level', { symbol, price, level: level.support, timestamp: new Date() })
        }
        if (price >= level.resistance) {
          this.logger.info(`📍 RESISTANCE BREAK ${symbol}: Sell @ $${price.toFixed(2)}`)
          this.emit('resistance-level', { symbol, price, level: level.resistance, timestamp: new Date() })
        }
      }
    } catch (error: any) {
      this.logger.error(`❌ Support/Resistance failed: ${error?.message}`)
    }
  }

  calculateLevels(symbol: string, price: number) {
    return { support: price * 0.95, resistance: price * 1.05 }
  }

  async fetchPrices(): Promise<Record<string, number>> {
    const binance = getBinanceAPI()
    const prices = await binance.getPrices(['BTCUSDT', 'ETHUSDT', 'SOLUSDT'])
    return {
      BTC: prices?.BTCUSDT || 0,
      ETH: prices?.ETHUSDT || 0,
      SOL: prices?.SOLUSDT || 0,
    }
  }
}

export const supportResistanceBot = new SupportResistanceBot()
