/**
 * Agent #11: Arbitrage Bot
 * Detects and exploits price differences across trading pairs
 * Buys undervalued, sells overvalued for risk-free profit
 */

import { BaseAgent, AgentConfig } from '../base-agent'
import { getBinanceAPI } from '../services/binance-api'

interface ArbitrageOpportunity {
  symbol1: string
  symbol2: string
  symbol1Price: number
  symbol2Price: number
  priceDifference: number
  profitPercent: number
  confidence: number
  timestamp: Date
}

class ArbitrageBot extends BaseAgent {
  config: AgentConfig = {
    name: 'arbitrage-bot',
    category: 'trading',
    version: '1.0.0',
    description: 'Arbitrage Bot - Detects cross-pair price discrepancies',
    schedule: '*/7 * * * *',
  }

  private opportunities: ArbitrageOpportunity[] = []
  private executedTrades: any[] = []
  private priceHistory: Map<string, number[]> = new Map()

  async execute(): Promise<void> {
    this.logger.info('🔄 Arbitrage Bot: Scanning for price discrepancies...')

    try {
      const prices = await this.fetchPrices()
      const opportunities = this.findArbitrageOpportunities(prices)

      for (const opp of opportunities) {
        if (opp.profitPercent >= 1.5) {
          await this.executeArbitrage(opp)
        }
      }

      this.logger.info('✅ Arbitrage Bot: Scan completed')
    } catch (error: any) {
      this.logger.error(`❌ Arbitrage Bot failed: ${error?.message}`)
      throw error
    }
  }

  private async fetchPrices(): Promise<Record<string, number>> {
    try {
      const binance = getBinanceAPI()
      const binancePrices = await binance.getPrices(['BTCUSDT', 'ETHUSDT', 'ADAUSDT', 'SOLUSDT', 'XRPUSDT'])

      return {
        BTC: binancePrices?.BTCUSDT || 0,
        ETH: binancePrices?.ETHUSDT || 0,
        ADA: binancePrices?.ADAUSDT || 0,
        SOL: binancePrices?.SOLUSDT || 0,
        XRP: binancePrices?.XRPUSDT || 0,
      }
    } catch (error) {
      this.logger.error('Failed to fetch prices', error)
      return {}
    }
  }

  private findArbitrageOpportunities(
    prices: Record<string, number>
  ): ArbitrageOpportunity[] {
    const opportunities: ArbitrageOpportunity[] = []
    const symbols = Object.keys(prices)

    for (let i = 0; i < symbols.length; i++) {
      for (let j = i + 1; j < symbols.length; j++) {
        const sym1 = symbols[i]
        const sym2 = symbols[j]
        const price1 = prices[sym1]
        const price2 = prices[sym2]

        const priceDiff = Math.abs(price1 - price2)
        const profitPercent = (priceDiff / Math.min(price1, price2)) * 100

        if (profitPercent > 0.5) {
          opportunities.push({
            symbol1: sym1,
            symbol2: sym2,
            symbol1Price: price1,
            symbol2Price: price2,
            priceDifference: priceDiff,
            profitPercent,
            confidence: Math.min(profitPercent / 5, 0.95),
            timestamp: new Date(),
          })
        }
      }
    }

    return opportunities.sort((a, b) => b.profitPercent - a.profitPercent)
  }

  private async executeArbitrage(opp: ArbitrageOpportunity): Promise<void> {
    const trade = {
      buySymbol: opp.symbol1,
      sellSymbol: opp.symbol2,
      buyPrice: opp.symbol1Price,
      sellPrice: opp.symbol2Price,
      profit: opp.profitPercent,
      executedAt: new Date(),
    }

    this.executedTrades.push(trade)

    this.logger.info(
      `💰 ARBITRAGE: Buy ${opp.symbol1} @ $${opp.symbol1Price.toFixed(2)}, Sell ${opp.symbol2} @ $${opp.symbol2Price.toFixed(2)} | Profit: ${opp.profitPercent.toFixed(2)}%`
    )

    this.emit('arbitrage-opportunity', {
      symbol1: opp.symbol1,
      symbol2: opp.symbol2,
      profitPercent: opp.profitPercent,
      confidence: opp.confidence,
      timestamp: new Date(),
    })
  }

  getOpportunities(): ArbitrageOpportunity[] {
    return this.opportunities
  }

  getTradeStats() {
    return {
      totalTrades: this.executedTrades.length,
      totalProfit: this.executedTrades.reduce((sum, t) => sum + t.profit, 0),
      avgProfit:
        this.executedTrades.length > 0
          ? this.executedTrades.reduce((sum, t) => sum + t.profit, 0) / this.executedTrades.length
          : 0,
    }
  }
}

export const arbitrageBot = new ArbitrageBot()
