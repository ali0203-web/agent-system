"use strict";
/**
 * Agent #8: Grid Trading Bot
 * Places buy/sell orders at predetermined price levels (grid)
 * Profits from market volatility between grid levels
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.gridTradingBot = void 0;
const base_agent_1 = require("../base-agent");
class GridTradingBot extends base_agent_1.BaseAgent {
    constructor() {
        super(...arguments);
        this.config = {
            name: 'grid-trading-bot',
            category: 'trading',
            version: '1.0.0',
            description: 'Grid Trading Bot - Automated buy/sell at grid levels',
            schedule: '*/10 * * * *', // Every 10 minutes
        };
        this.positions = new Map();
        this.priceHistory = new Map();
        this.maxHistoryLength = 100;
    }
    async execute() {
        this.logger.info('📊 Grid Trading Bot: Checking grid positions...');
        try {
            // Fetch current prices
            const prices = await this.fetchCurrentPrices();
            // Update all grid positions
            for (const [symbol, position] of this.positions) {
                const currentPrice = prices[position.asset];
                if (!currentPrice) {
                    this.logger.warn(`⚠️ Could not fetch price for ${position.asset}`);
                    continue;
                }
                // Update price history
                const history = this.priceHistory.get(position.asset) || [];
                history.push(currentPrice);
                if (history.length > this.maxHistoryLength) {
                    history.shift();
                }
                this.priceHistory.set(position.asset, history);
                // Check and execute grid orders
                await this.checkGridLevels(position, currentPrice);
            }
            this.logger.info('✅ Grid Trading Bot: Check completed');
        }
        catch (error) {
            const errorMsg = error?.message || 'Unknown error';
            this.logger.error(`❌ Grid Trading Bot failed: ${errorMsg}`);
            throw error;
        }
    }
    async checkGridLevels(position, currentPrice) {
        let filledCount = 0;
        let executedTrades = 0;
        for (const level of position.levels) {
            // Check if we should buy
            if (level.status === 'pending' &&
                currentPrice <= level.price &&
                currentPrice >= level.price * 0.98 // Within 2% of grid level
            ) {
                level.status = 'filled';
                level.buyFilledAt = new Date();
                filledCount++;
                this.logger.info(`✅ GRID BUY Level ${level.level}: ${position.symbol} @ $${currentPrice.toFixed(2)}`);
                this.emit('grid-buy-order', {
                    symbol: position.symbol,
                    level: level.level,
                    price: currentPrice,
                    amount: position.investmentPerGrid,
                    timestamp: new Date(),
                });
            }
            // Check if we should sell (price bounced up)
            if (level.status === 'filled' && !level.soldAt && currentPrice >= level.price * 1.02) {
                // 2% profit target
                level.soldAt = new Date();
                level.profit = position.investmentPerGrid * 0.02; // 2% profit
                level.profitPercent = 2;
                position.totalProfit += level.profit;
                executedTrades++;
                this.logger.info(`💰 GRID SELL Level ${level.level}: ${position.symbol} @ $${currentPrice.toFixed(2)} | Profit: $${level.profit.toFixed(2)}`);
                this.emit('grid-sell-order', {
                    symbol: position.symbol,
                    level: level.level,
                    buyPrice: level.price,
                    sellPrice: currentPrice,
                    profit: level.profit,
                    profitPercent: level.profitPercent,
                    timestamp: new Date(),
                });
                // Reset level for next cycle
                level.status = 'pending';
                level.buyFilledAt = undefined;
                level.soldAt = undefined;
            }
        }
        position.totalFilled = filledCount;
        // Log summary
        if (executedTrades > 0) {
            this.logger.info(`📈 Grid Summary ${position.symbol}: ${executedTrades} trades executed | Total profit: $${position.totalProfit.toFixed(2)}`);
            this.emit('grid-summary', {
                symbol: position.symbol,
                tradesExecuted: executedTrades,
                totalProfit: position.totalProfit,
                filledLevels: filledCount,
                gridRange: `$${position.bottomPrice.toFixed(2)} - $${position.topPrice.toFixed(2)}`,
                timestamp: new Date(),
            });
        }
    }
    async fetchCurrentPrices() {
        const assets = Array.from(this.positions.values()).map((p) => p.asset);
        if (assets.length === 0)
            return {};
        const url = `https://api.coingecko.com/api/v3/simple/price?ids=${assets.join(',')}&vs_currencies=usd`;
        try {
            const response = await this.get(url);
            const prices = {};
            for (const asset of assets) {
                if (response[asset]?.usd) {
                    prices[asset] = response[asset].usd;
                }
            }
            return prices;
        }
        catch (error) {
            this.logger.error('Failed to fetch prices', error);
            return {};
        }
    }
    // Public methods
    addGridPosition(asset, symbol, gridLevels, bottomPrice, topPrice, investmentPerGrid) {
        const gridSize = (topPrice - bottomPrice) / gridLevels;
        const levels = [];
        // Create grid levels from bottom to top
        for (let i = 0; i < gridLevels; i++) {
            const levelPrice = bottomPrice + gridSize * i;
            levels.push({
                level: i + 1,
                price: levelPrice,
                status: 'pending',
            });
        }
        const position = {
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
        };
        this.positions.set(symbol, position);
        this.logger.info(`✅ Added grid position: ${symbol} | ${gridLevels} levels | $${bottomPrice.toFixed(2)} - $${topPrice.toFixed(2)}`);
    }
    removeGridPosition(symbol) {
        if (this.positions.delete(symbol)) {
            this.logger.info(`✅ Removed grid position: ${symbol}`);
        }
    }
    getPositions() {
        return Array.from(this.positions.values());
    }
    getPositionBySymbol(symbol) {
        return this.positions.get(symbol);
    }
    getGridStats(symbol) {
        const position = this.positions.get(symbol);
        if (!position)
            return null;
        const filledLevels = position.levels.filter((l) => l.soldAt).length;
        const fillRate = (filledLevels / position.gridLevels) * 100;
        return {
            totalProfit: position.totalProfit,
            tradesCompleted: filledLevels,
            fillRate,
        };
    }
}
exports.gridTradingBot = new GridTradingBot();
//# sourceMappingURL=grid-trading-bot.js.map