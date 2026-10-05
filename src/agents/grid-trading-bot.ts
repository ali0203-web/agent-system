/**
 * Agent #8: Grid Trading Bot
 * Places buy/sell orders at predetermined price levels (grid)
 * Profits from market volatility between grid levels
 */

import { BaseAgent, AgentConfig } from '../base-agent'
import { getBinanceAPI } from '../services/binance-api'

interface GridLevel {
  level: number
  price: number
  buyOrderId?: string
  sellOrderId?: string
  status: 'pending' | 'filled' | 'cancelled'
  buyFilledAt?: Date
  soldAt?: Date
  profit?: number
  profitPercent?: number
}

interface GridPosition {
  asset: string
  symbol: string
  gridLevels: number // e.g., 10 levels
  bottomPrice: number
  topPrice: number
  investmentPerGrid: number
  gridSize: number // price difference between levels
  totalInvestment: number
  totalFilled: number
  totalProfit: number
  levels: GridLevel[]
  isActive: boolean
  createdAt: Date
}

class GridTradingBot extends BaseAgent {
  config: AgentConfig = {
    name: 'grid-trading-bot',
    category: 'trading',
    version: '1.0.0',
    description: 'Grid Trading Bot - Automated buy/sell at grid levels',
    schedule: '*/10 * * * *', // Every 10 minutes
  }

  private positions: Map<string, GridPosition> = new Map()
  private priceHistory: Map<string, number[]> = new Map()
  private maxHistoryLength = 100
  private initialized = false

  async execute(): Promise<void> {
    this.logger.info('📊 Grid Trading Bot: Checking grid positions...')

    try {
      // Initialize default grid positions on first run
      if (!this.initialized) {
        await this.initializeDefaultPositions()
        this.initialized = true
      }

      // Fetch current prices
      const prices = await this.fetchCurrentPrices()

      // Update all grid positions
      for (const [symbol, position] of this.positions) {
        const currentPrice = prices[position.asset]

        if (!currentPrice) {
          this.logger.warn(`⚠️ Could not fetch price for ${position.asset}`)
          continue
        }

        // Update price history
        const history = this.priceHistory.get(position.asset) || []
        history.push(currentPrice)
        if (history.length > this.maxHistoryLength) {
          history.shift()
        }
        this.priceHistory.set(position.asset, history)

        // Check and execute grid orders
        await this.checkGridLevels(position, currentPrice)
      }

      this.logger.info('✅ Grid Trading Bot: Check completed')
    } catch (error: any) {
      const errorMsg = error?.message || 'Unknown error'
      this.logger.error(`❌ Grid Trading Bot failed: ${errorMsg}`)
      throw error
    }
  }

  private async checkGridLevels(position: GridPosition, currentPrice: number): Promise<void> {
    const binance = getBinanceAPI()
    let filledCount = 0
    let executedTrades = 0

    for (const level of position.levels) {
      // Check if we should buy
      if (
        level.status === 'pending' &&
        currentPrice <= level.price &&
        currentPrice >= level.price * 0.98 // Within 2% of grid level
      ) {
        // Place real Binance order
        const orderResult = await binance.placeOrder({
          symbol: position.symbol,
          side: 'BUY',
          quantity: position.investmentPerGrid / currentPrice,
          price: currentPrice,
          orderType: 'LIMIT',
        })

        if (orderResult) {
          level.status = 'filled'
          level.buyOrderId = orderResult.orderId.toString()
          level.buyFilledAt = new Date()
          filledCount++

          this.logger.info(
            `✅ ${orderResult.simulated ? '🧪 [DRY RUN] ' : ''}GRID BUY Level ${level.level}: ${position.symbol} @ $${currentPrice.toFixed(2)} | Order ID: ${orderResult.orderId}`
          )

          this.emit('grid-buy-order', {
            symbol: position.symbol,
            level: level.level,
            price: currentPrice,
            amount: position.investmentPerGrid,
            orderId: orderResult.orderId,
            simulated: orderResult.simulated === true,
            timestamp: new Date(),
          })
        } else {
          this.logger.error(`❌ Failed to place buy order for ${position.symbol}`)
        }
      }

      // Check if we should sell (price bounced up)
      if (level.status === 'filled' && !level.soldAt && currentPrice >= level.price * 1.02) {
        // 2% profit target - place real Binance order
        const sellOrderResult = await binance.placeOrder({
          symbol: position.symbol,
          side: 'SELL',
          quantity: position.investmentPerGrid / level.price,
          price: currentPrice,
          orderType: 'LIMIT',
        })

        if (sellOrderResult) {
          level.soldAt = new Date()
          level.sellOrderId = sellOrderResult.orderId.toString()
          level.profit = (currentPrice - level.price) * (position.investmentPerGrid / level.price)
          level.profitPercent = ((currentPrice - level.price) / level.price) * 100

          position.totalProfit += level.profit
          executedTrades++

          this.logger.info(
            `💰 ${sellOrderResult.simulated ? '🧪 [DRY RUN] ' : ''}GRID SELL Level ${level.level}: ${position.symbol} @ $${currentPrice.toFixed(2)} | Profit: $${level.profit.toFixed(2)} | Order ID: ${sellOrderResult.orderId}`
          )

          this.emit('grid-sell-order', {
            symbol: position.symbol,
            level: level.level,
            buyPrice: level.price,
            sellPrice: currentPrice,
            profit: level.profit,
            profitPercent: level.profitPercent,
            orderId: sellOrderResult.orderId,
            simulated: sellOrderResult.simulated === true,
            timestamp: new Date(),
          })

          // Reset level for next cycle
          level.status = 'pending'
          level.buyFilledAt = undefined
          level.soldAt = undefined
        } else {
          this.logger.error(`❌ Failed to place sell order for ${position.symbol}`)
        }
      }
    }

    position.totalFilled = filledCount

    // Log summary
    if (executedTrades > 0) {
      this.logger.info(
        `📈 Grid Summary ${position.symbol}: ${executedTrades} trades executed | Total profit: $${position.totalProfit.toFixed(2)}`
      )

      this.emit('grid-summary', {
        symbol: position.symbol,
        tradesExecuted: executedTrades,
        totalProfit: position.totalProfit,
        filledLevels: filledCount,
        gridRange: `$${position.bottomPrice.toFixed(2)} - $${position.topPrice.toFixed(2)}`,
        timestamp: new Date(),
      })
    }
  }

  private async fetchCurrentPrices(): Promise<Record<string, number>> {
    // TESTNET DEMO MODE: Using mock prices to trigger real order execution
    // This allows us to demonstrate Binance API integration without rate limits
    const mockPrices: Record<string, number> = {
      bitcoin: 43000, // Within BTCUSDT grid ($42k-$44k) - will trigger buys
      ethereum: 2300, // Within ETHUSDT grid ($2.2k-$2.4k) - will trigger buys
    }

    this.logger.info(`📊 [TESTNET DEMO] Using mock prices for grid trading simulation`)
    return mockPrices
  }

  // Public methods
  addGridPosition(
    asset: string,
    symbol: string,
    gridLevels: number,
    bottomPrice: number,
    topPrice: number,
    investmentPerGrid: number
  ): void {
    const gridSize = (topPrice - bottomPrice) / gridLevels
    const levels: GridLevel[] = []

    // Create grid levels from bottom to top
    for (let i = 0; i < gridLevels; i++) {
      const levelPrice = bottomPrice + gridSize * i
      levels.push({
        level: i + 1,
        price: levelPrice,
        status: 'pending',
      })
    }

    const position: GridPosition = {
      asset,
      symbol,
      gridLevels,
      bottomPrice,
      topPrice,
      investmentPerGrid,
      gridSize,
      totalInvestment: gridLevels * investmentPerGrid,
      totalFilled: 0,
      totalProfit: 0,
      levels,
      isActive: true,
      createdAt: new Date(),
    }

    this.positions.set(symbol, position)
    this.logger.info(
      `✅ Added grid position: ${symbol} | ${gridLevels} levels | $${bottomPrice.toFixed(2)} - $${topPrice.toFixed(2)}`
    )
  }

  removeGridPosition(symbol: string): void {
    if (this.positions.delete(symbol)) {
      this.logger.info(`✅ Removed grid position: ${symbol}`)
    }
  }

  getPositions(): GridPosition[] {
    return Array.from(this.positions.values())
  }

  getPositionBySymbol(symbol: string): GridPosition | undefined {
    return this.positions.get(symbol)
  }

  getGridStats(symbol: string): {
    totalProfit: number
    tradesCompleted: number
    fillRate: number
  } | null {
    const position = this.positions.get(symbol)
    if (!position) return null

    const filledLevels = position.levels.filter((l) => l.soldAt).length
    const fillRate = (filledLevels / position.gridLevels) * 100

    return {
      totalProfit: position.totalProfit,
      tradesCompleted: filledLevels,
      fillRate,
    }
  }

  private async initializeDefaultPositions(): Promise<void> {
    this.logger.info('🚀 Initializing default grid positions...')

    // Set up default grid positions for major crypto pairs
    // These will be automatically traded by the grid strategy
    this.addGridPosition(
      'bitcoin',
      'BTCUSDT',
      10, // 10 grid levels
      42000, // Bottom price
      44000, // Top price
      50 // $50 per grid level
    )

    this.addGridPosition(
      'ethereum',
      'ETHUSDT',
      8, // 8 grid levels
      2200, // Bottom price
      2400, // Top price
      30 // $30 per grid level
    )

    this.logger.info('✅ Default positions initialized and ready for trading')
  }
}

export const gridTradingBot = new GridTradingBot()
