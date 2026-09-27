import { BaseAgent, AgentConfig } from '../base-agent'

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
    const response = await this.get(
      'https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum,solana&vs_currencies=usd'
    )
    return { BTC: response.bitcoin?.usd || 0, ETH: response.ethereum?.usd || 0, SOL: response.solana?.usd || 0 }
  }
}

export const supportResistanceBot = new SupportResistanceBot()
