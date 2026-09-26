/**
 * Agent #7: Risk Management
 * Optimizes portfolio risk through dynamic position sizing and stop-loss levels
 */

import { BaseAgent, AgentConfig } from '../base-agent'

interface Position {
  asset: string
  symbol: string
  quantity: number
  entryPrice: number
  currentPrice: number
  unrealizedGain: number
  percentageOfPortfolio: number
  volatility: number
  riskLevel: 'low' | 'medium' | 'high' | 'critical'
}

interface RiskMetrics {
  totalPortfolioValue: number
  portfolioVolatility: number
  maxDrawdown: number
  sharpeRatio: number
  var95: number // Value at Risk (95% confidence)
  positions: Position[]
  recommendations: RiskRecommendation[]
  timestamp: Date
}

interface RiskRecommendation {
  symbol: string
  action: 'reduce' | 'hold' | 'increase'
  reason: string
  suggestedSize: number
  stopLoss: number
  takeProfit: number
  riskRewardRatio: number
  confidence: number
}

class RiskManagement extends BaseAgent {
  config: AgentConfig = {
    name: 'risk-management',
    category: 'risk',
    version: '1.0.0',
    description: 'Dynamic Position Sizing and Risk Optimization',
    schedule: '*/20 * * * *', // Every 20 minutes
  }

  private positions: Position[] = []
  private priceHistory: Map<string, number[]> = new Map()
  private maxHistoryLength = 100
  private maxPortfolioRisk = 0.02 // 2% max loss per position
  private targetSharpeRatio = 1.0

  async execute(): Promise<void> {
    this.logger.info('🎯 Risk Management: Analyzing portfolio risk...')

    try {
      // Fetch current data
      await this.analyzePortfolio()

      this.logger.info('✅ Risk Management: Analysis complete')
    } catch (error: any) {
      const errorMsg = error?.message || 'Unknown error'
      this.logger.error(`❌ Risk Management failed: ${errorMsg}`)
      throw error
    }
  }

  private async analyzePortfolio(): Promise<void> {
    // Fetch prices for all tracked assets
    const prices = await this.fetchCurrentPrices()

    // Update positions with current prices
    for (const position of this.positions) {
      if (prices[position.asset]) {
        position.currentPrice = prices[position.asset]
        position.unrealizedGain = position.quantity * (position.currentPrice - position.entryPrice)
      }
    }

    // Calculate portfolio metrics
    const metrics = this.calculateMetrics()

    // Generate recommendations
    const recommendations = this.generateRecommendations(metrics)

    // Log critical risks
    for (const rec of recommendations) {
      if (rec.action === 'reduce') {
        this.logger.warn(
          `⚠️  REDUCE ${rec.symbol}: ${rec.reason} (Risk/Reward: ${rec.riskRewardRatio.toFixed(2)})`
        )

        this.emit('risk-alert', {
          symbol: rec.symbol,
          action: rec.action,
          reason: rec.reason,
          suggestedSize: rec.suggestedSize,
          stopLoss: rec.stopLoss,
          confidence: rec.confidence,
          timestamp: new Date(),
        })
      }
    }

    // Emit overall risk metrics
    this.emit('portfolio-risk-update', {
      totalValue: metrics.totalPortfolioValue,
      volatility: metrics.portfolioVolatility,
      maxDrawdown: metrics.maxDrawdown,
      sharpeRatio: metrics.sharpeRatio,
      var95: metrics.var95,
      recommendationCount: recommendations.length,
      timestamp: new Date(),
    })
  }

  private calculateMetrics(): RiskMetrics {
    let totalValue = 0
    const assetWeights: number[] = []

    // Calculate total portfolio value and weights
    for (const pos of this.positions) {
      const posValue = pos.quantity * pos.currentPrice
      totalValue += posValue
      assetWeights.push(posValue)
    }

    // Normalize weights
    const weights = assetWeights.map((w) => (totalValue > 0 ? w / totalValue : 0))

    // Calculate volatilities
    const volatilities = this.positions.map((pos) => this.calculateVolatility(pos.asset))

    // Portfolio volatility (weighted sum of individual volatilities)
    let portfolioVolatility = 0
    for (let i = 0; i < this.positions.length; i++) {
      portfolioVolatility += weights[i] * volatilities[i]
    }

    // Calculate Value at Risk (95% confidence interval)
    // Simplified: VaR = Portfolio Value * Z-score(95%) * Volatility
    const zScore95 = 1.645
    const var95 = totalValue * zScore95 * portfolioVolatility

    // Calculate max drawdown from price history
    const maxDrawdown = this.calculateMaxDrawdown()

    // Sharpe Ratio (simplified: using risk-free rate of 0.02)
    const riskFreeRate = 0.02
    const returns = this.calculateReturns()
    const sharpeRatio = (returns - riskFreeRate) / Math.max(portfolioVolatility, 0.001)

    // Update position risk levels
    for (let i = 0; i < this.positions.length; i++) {
      this.positions[i].volatility = volatilities[i]
      this.positions[i].percentageOfPortfolio = weights[i] * 100

      // Assign risk level based on volatility and position size
      if (volatilities[i] > 0.1 && weights[i] > 0.3) {
        this.positions[i].riskLevel = 'critical'
      } else if (volatilities[i] > 0.08 && weights[i] > 0.2) {
        this.positions[i].riskLevel = 'high'
      } else if (volatilities[i] > 0.05) {
        this.positions[i].riskLevel = 'medium'
      } else {
        this.positions[i].riskLevel = 'low'
      }
    }

    return {
      totalPortfolioValue: totalValue,
      portfolioVolatility,
      maxDrawdown,
      sharpeRatio,
      var95,
      positions: this.positions,
      recommendations: [],
      timestamp: new Date(),
    }
  }

  private calculateVolatility(asset: string): number {
    const history = this.priceHistory.get(asset) || []
    if (history.length < 2) return 0.05 // Default 5% volatility

    // Calculate daily returns
    const returns: number[] = []
    for (let i = 1; i < history.length; i++) {
      const dailyReturn = (history[i] - history[i - 1]) / history[i - 1]
      returns.push(dailyReturn)
    }

    // Standard deviation of returns
    const mean = returns.reduce((a, b) => a + b, 0) / returns.length
    const variance = returns.reduce((sq, n) => sq + Math.pow(n - mean, 2), 0) / returns.length
    const stdDev = Math.sqrt(variance)

    // Annualized volatility (252 trading days)
    return stdDev * Math.sqrt(252)
  }

  private calculateMaxDrawdown(): number {
    let maxDrawdown = 0

    for (const [asset, history] of this.priceHistory) {
      if (history.length < 2) continue

      let peak = history[0]
      for (let i = 1; i < history.length; i++) {
        const drawdown = (peak - history[i]) / peak
        maxDrawdown = Math.max(maxDrawdown, drawdown)
        peak = Math.max(peak, history[i])
      }
    }

    return maxDrawdown
  }

  private calculateReturns(): number {
    if (this.positions.length === 0) return 0

    let totalGain = 0
    let totalInvested = 0

    for (const pos of this.positions) {
      totalGain += pos.unrealizedGain
      totalInvested += pos.quantity * pos.entryPrice
    }

    return totalInvested > 0 ? totalGain / totalInvested : 0
  }

  private generateRecommendations(metrics: RiskMetrics): RiskRecommendation[] {
    const recommendations: RiskRecommendation[] = []

    for (const pos of metrics.positions) {
      const recommendation: RiskRecommendation = {
        symbol: pos.symbol,
        action: 'hold',
        reason: 'Position within risk parameters',
        suggestedSize: pos.quantity,
        stopLoss: pos.entryPrice * 0.95, // 5% below entry
        takeProfit: pos.entryPrice * 1.15, // 15% above entry
        riskRewardRatio: 1.0,
        confidence: 0,
      }

      // Risk/reward calculation
      const risk = pos.currentPrice - recommendation.stopLoss
      const reward = recommendation.takeProfit - pos.currentPrice
      const riskRewardRatio = reward > 0 ? risk / reward : 1.0

      recommendation.riskRewardRatio = riskRewardRatio

      // Determine action based on risk metrics
      if (pos.riskLevel === 'critical') {
        // Position is too large and volatile
        recommendation.action = 'reduce'
        recommendation.reason = 'Critical risk: High volatility + large position'
        recommendation.suggestedSize = Math.floor(pos.quantity * 0.5) // Reduce to 50%
        recommendation.confidence = 0.95
      } else if (pos.percentageOfPortfolio > 0.4 && pos.volatility > 0.08) {
        // Position too large
        recommendation.action = 'reduce'
        recommendation.reason = `Position exceeds 40% of portfolio (${pos.percentageOfPortfolio.toFixed(1)}%)`
        recommendation.suggestedSize = Math.floor(pos.quantity * 0.7)
        recommendation.confidence = 0.85
      } else if (
        pos.volatility < 0.03 &&
        metrics.sharpeRatio < this.targetSharpeRatio &&
        pos.percentageOfPortfolio < 0.2
      ) {
        // Low volatility position could be increased
        recommendation.action = 'increase'
        recommendation.reason = 'Low volatility with good risk/reward'
        recommendation.suggestedSize = Math.floor(pos.quantity * 1.3)
        recommendation.confidence = 0.70
      }

      // Dynamic stop-loss based on volatility
      recommendation.stopLoss = pos.currentPrice * (1 - pos.volatility)

      // Dynamic take-profit based on risk/reward preference
      const targetReward = recommendation.stopLoss - pos.currentPrice
      recommendation.takeProfit = pos.currentPrice + targetReward * 2

      recommendations.push(recommendation)
    }

    return recommendations
  }

  private async fetchCurrentPrices(): Promise<Record<string, number>> {
    const assets = this.positions.map((p) => p.asset)
    if (assets.length === 0) return {}

    const url = `https://api.coingecko.com/api/v3/simple/price?ids=${assets.join(',')}&vs_currencies=usd`

    try {
      const response = await this.get(url)
      const prices: Record<string, number> = {}

      for (const asset of assets) {
        if (response[asset]?.usd) {
          const price = response[asset].usd
          prices[asset] = price

          // Track price history
          const history = this.priceHistory.get(asset) || []
          history.push(price)
          if (history.length > this.maxHistoryLength) {
            history.shift()
          }
          this.priceHistory.set(asset, history)
        }
      }

      return prices
    } catch (error) {
      this.logger.error('Failed to fetch prices', error)
      return {}
    }
  }

  // Public methods for external access
  getRiskMetrics(): RiskMetrics {
    return this.calculateMetrics()
  }

  addPosition(asset: string, symbol: string, quantity: number, entryPrice: number): void {
    const position: Position = {
      asset,
      symbol,
      quantity,
      entryPrice,
      currentPrice: entryPrice,
      unrealizedGain: 0,
      percentageOfPortfolio: 0,
      volatility: 0.05,
      riskLevel: 'medium',
    }

    this.positions.push(position)
    this.logger.info(`✅ Added position: ${symbol} - ${quantity} units @ $${entryPrice}`)

    // Initialize price history
    if (!this.priceHistory.has(asset)) {
      this.priceHistory.set(asset, [entryPrice])
    }
  }

  removePosition(symbol: string): void {
    const index = this.positions.findIndex((p) => p.symbol === symbol)
    if (index >= 0) {
      this.positions.splice(index, 1)
      this.logger.info(`✅ Removed position: ${symbol}`)
    }
  }

  getPositions(): Position[] {
    return this.positions
  }

  getRecommendations(): RiskRecommendation[] {
    const metrics = this.calculateMetrics()
    return this.generateRecommendations(metrics)
  }

  getPositionBySymbol(symbol: string): Position | undefined {
    return this.positions.find((p) => p.symbol === symbol)
  }
}

export const riskManagement = new RiskManagement()
