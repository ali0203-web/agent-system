/**
 * Agent #4: DCA Bot (Dollar-Cost Averaging)
 * Automates periodic cryptocurrency purchases at regular intervals
 * to reduce market volatility impact through dollar-cost averaging
 */

import { BaseAgent, AgentConfig } from '../base-agent'

interface DCAPosition {
  asset: string
  symbol: string
  investmentPerPeriod: number
  totalInvested: number
  totalUnits: number
  averageCostPerUnit: number
  currentPrice: number
  currentValue: number
  gainLoss: number
  gainLossPercent: number
  lastPurchaseDate: Date
  nextScheduledPurchase: Date
}

interface DCAConfig extends AgentConfig {
  positions: DCAPosition[]
}

class DCABot extends BaseAgent {
  config: AgentConfig = {
    name: 'dca-bot',
    category: 'investment',
    version: '1.0.0',
    description: 'Dollar-Cost Averaging Investment Bot',
    schedule: '0 9 */7 * *',
  }

  private positions: DCAPosition[] = [
      {
        asset: 'bitcoin',
        symbol: 'BTC',
        investmentPerPeriod: 100, // $100 per purchase
        totalInvested: 0,
        totalUnits: 0,
        averageCostPerUnit: 0,
        currentPrice: 0,
        currentValue: 0,
        gainLoss: 0,
        gainLossPercent: 0,
        lastPurchaseDate: new Date(),
        nextScheduledPurchase: new Date(),
      },
      {
        asset: 'ethereum',
        symbol: 'ETH',
        investmentPerPeriod: 75, // $75 per purchase
        totalInvested: 0,
        totalUnits: 0,
        averageCostPerUnit: 0,
        currentPrice: 0,
        currentValue: 0,
        gainLoss: 0,
        gainLossPercent: 0,
        lastPurchaseDate: new Date(),
        nextScheduledPurchase: new Date(),
      },
      {
        asset: 'cardano',
        symbol: 'ADA',
        investmentPerPeriod: 50, // $50 per purchase
        totalInvested: 0,
        totalUnits: 0,
        averageCostPerUnit: 0,
        currentPrice: 0,
        currentValue: 0,
        gainLoss: 0,
        gainLossPercent: 0,
        lastPurchaseDate: new Date(),
        nextScheduledPurchase: new Date(),
      },
    ]

  async execute(): Promise<void> {
    this.logger.info('🤖 DCA Bot: Starting automated purchases...')

    try {
      // Fetch current prices
      const prices = await this.fetchCurrentPrices()

      // Process each position
      for (const position of this.positions) {
        const currentPrice = prices[position.asset]

        if (!currentPrice) {
          this.logger.warn(`⚠️ Could not fetch price for ${position.asset}`)
          continue
        }

        // Simulate purchase
        const unitsAcquired = position.investmentPerPeriod / currentPrice
        const totalInvested = position.totalInvested + position.investmentPerPeriod
        const totalUnits = position.totalUnits + unitsAcquired
        const averageCostPerUnit = totalInvested / totalUnits

        // Update position
        position.totalInvested = totalInvested
        position.totalUnits = totalUnits
        position.averageCostPerUnit = averageCostPerUnit
        position.currentPrice = currentPrice
        position.currentValue = totalUnits * currentPrice
        position.gainLoss = position.currentValue - position.totalInvested
        position.gainLossPercent = (position.gainLoss / position.totalInvested) * 100
        position.lastPurchaseDate = new Date()
        position.nextScheduledPurchase = new Date(
          Date.now() + 7 * 24 * 60 * 60 * 1000
        ) // Next week

        this.logger.info(
          `✅ DCA Purchase: ${position.symbol} - ${unitsAcquired.toFixed(6)} units @ $${currentPrice}`
        )
        this.logger.info(
          `📊 Position: Total Value: $${position.currentValue.toFixed(2)}, Gain/Loss: $${position.gainLoss.toFixed(2)} (${position.gainLossPercent.toFixed(2)}%)`
        )

        // Emit purchase event
        this.emit('dca-purchase', {
          asset: position.asset,
          symbol: position.symbol,
          unitsAcquired: unitsAcquired.toFixed(6),
          price: currentPrice,
          investment: position.investmentPerPeriod,
          timestamp: new Date(),
        })
      }

      // Emit portfolio summary
      const portfolioSummary = this.getPortfolioSummary()
      this.emit('dca-portfolio-updated', {
        totalInvested: portfolioSummary.totalInvested,
        totalValue: portfolioSummary.totalValue,
        gainLoss: portfolioSummary.gainLoss,
        gainLossPercent: portfolioSummary.gainLossPercent,
        positions: this.positions,
        timestamp: new Date(),
      })

      this.logger.info('📈 DCA Bot: Purchase cycle completed')
    } catch (error) {
      this.logger.error('❌ DCA Bot failed', error)
      throw error
    }
  }

  private async fetchCurrentPrices(): Promise<Record<string, number>> {
    const ids = ['bitcoin', 'ethereum', 'cardano']
    const url = `https://api.coingecko.com/api/v3/simple/price?ids=${ids.join(',')}&vs_currencies=usd`

    try {
      const response = await this.get(url)
      const prices: Record<string, number> = {}

      if (response.bitcoin?.usd) prices.bitcoin = response.bitcoin.usd
      if (response.ethereum?.usd) prices.ethereum = response.ethereum.usd
      if (response.cardano?.usd) prices.cardano = response.cardano.usd

      return prices
    } catch (error) {
      this.logger.error('Failed to fetch prices', error)
      return {}
    }
  }

  private getPortfolioSummary() {
    let totalInvested = 0
    let totalValue = 0

    for (const position of this.positions) {
      totalInvested += position.totalInvested
      totalValue += position.currentValue
    }

    const gainLoss = totalValue - totalInvested
    const gainLossPercent = totalInvested > 0 ? (gainLoss / totalInvested) * 100 : 0

    return {
      totalInvested,
      totalValue,
      gainLoss,
      gainLossPercent,
    }
  }

  getPositions(): DCAPosition[] {
    return this.positions
  }

  addPosition(asset: string, symbol: string, investmentPerPeriod: number): void {
    const position: DCAPosition = {
      asset,
      symbol,
      investmentPerPeriod,
      totalInvested: 0,
      totalUnits: 0,
      averageCostPerUnit: 0,
      currentPrice: 0,
      currentValue: 0,
      gainLoss: 0,
      gainLossPercent: 0,
      lastPurchaseDate: new Date(),
      nextScheduledPurchase: new Date(),
    }

    this.positions.push(position)
    this.logger.info(
      `✅ Added position: ${symbol} - $${investmentPerPeriod}/purchase`
    )
  }

  removePosition(symbol: string): void {
    const index = this.positions.findIndex((p) => p.symbol === symbol)
    if (index >= 0) {
      this.positions.splice(index, 1)
      this.logger.info(`✅ Removed position: ${symbol}`)
    }
  }

  updateInvestmentAmount(symbol: string, newAmount: number): void {
    const position = this.positions.find((p) => p.symbol === symbol)
    if (position) {
      position.investmentPerPeriod = newAmount
      this.logger.info(`✅ Updated ${symbol} investment to $${newAmount}/purchase`)
    }
  }
}

// Export agent instance
export const dcaBot = new DCABot()
