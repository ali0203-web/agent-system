"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PortfolioTracker = void 0;
const base_agent_1 = require("../base-agent");
const binance_api_1 = require("../services/binance-api");
class PortfolioTracker extends base_agent_1.BaseAgent {
    constructor() {
        super(...arguments);
        this.config = {
            name: 'portfolio-tracker',
            category: 'trading',
            description: 'Track cryptocurrency portfolio value and gains/losses',
            version: '1.0.0',
            schedule: '*/15 * * * *', // Every 15 minutes
            timeout: 15000,
        };
        // Sample holdings (in production, read from database)
        this.holdings = [
            {
                symbol: 'BTC',
                binanceSymbol: 'BTCUSDT',
                quantity: 0.5,
                costBasis: 40000,
                purchaseDate: new Date('2024-01-01'),
            },
            {
                symbol: 'ETH',
                binanceSymbol: 'ETHUSDT',
                quantity: 5,
                costBasis: 2000,
                purchaseDate: new Date('2024-02-01'),
            },
            {
                symbol: 'ADA',
                binanceSymbol: 'ADAUSDT',
                quantity: 100,
                costBasis: 0.5,
                purchaseDate: new Date('2024-03-01'),
            },
        ];
    }
    /**
     * Track portfolio value and calculate gains
     */
    async execute() {
        this.logger.info(`Tracking portfolio with ${this.holdings.length} holdings...`);
        try {
            // Get current prices for all holdings
            const prices = await this.fetchPrices();
            // Calculate portfolio positions
            const positions = this.calculatePositions(prices);
            // Calculate summary
            const summary = this.calculateSummary(positions);
            // Check for significant changes
            const alerts = this.checkForAlerts(summary);
            // Publish portfolio update event
            await this.publishPortfolioUpdate(summary, positions);
            // Publish alerts if any
            if (alerts.length > 0) {
                for (const alert of alerts) {
                    await this.publishEvent('portfolio-alert', alert);
                }
            }
            this.logger.info(`✅ Portfolio tracked: Total value $${summary.totalValue.toFixed(2)}`);
            return {
                success: true,
                summary,
                positions,
                alerts,
                timestamp: new Date(),
            };
        }
        catch (error) {
            this.logger.error('Failed to track portfolio', error);
            throw error;
        }
    }
    /**
     * Fetch current prices for all holdings
     */
    async fetchPrices() {
        try {
            const binance = (0, binance_api_1.getBinanceAPI)();
            const binanceSymbols = this.holdings.map((h) => h.binanceSymbol);
            this.logger.debug(`Fetching prices for: ${binanceSymbols.join(', ')}`);
            const binancePrices = await binance.getPrices(binanceSymbols);
            const prices = {};
            for (const holding of this.holdings) {
                prices[holding.symbol] = binancePrices?.[holding.binanceSymbol] || 0;
            }
            return prices;
        }
        catch (error) {
            this.logger.error('Failed to fetch prices', error);
            throw error;
        }
    }
    /**
     * Calculate portfolio positions
     */
    calculatePositions(prices) {
        return this.holdings.map((holding) => {
            const price = prices[holding.symbol] || 0;
            const currentValue = holding.quantity * price;
            const totalCost = holding.quantity * holding.costBasis;
            const gain = currentValue - totalCost;
            const gainPercent = totalCost > 0 ? (gain / totalCost) * 100 : 0;
            return {
                symbol: holding.symbol,
                quantity: holding.quantity,
                currentPrice: price,
                currentValue,
                costBasis: holding.costBasis,
                totalCost,
                gain,
                gainPercent: Math.round(gainPercent * 100) / 100,
                currency: 'USD',
            };
        });
    }
    /**
     * Calculate portfolio summary
     */
    calculateSummary(positions) {
        const totalValue = positions.reduce((sum, pos) => sum + pos.currentValue, 0);
        const totalCost = positions.reduce((sum, pos) => sum + pos.totalCost, 0);
        const totalGain = totalValue - totalCost;
        const totalGainPercent = totalCost > 0 ? (totalGain / totalCost) * 100 : 0;
        const holdingCount = positions.length;
        // Find best and worst performers
        const bestPerformer = positions.reduce((best, pos) => pos.gainPercent > best.gainPercent ? pos : best);
        const worstPerformer = positions.reduce((worst, pos) => pos.gainPercent < worst.gainPercent ? pos : worst);
        return {
            timestamp: new Date(),
            totalValue: Math.round(totalValue * 100) / 100,
            totalCost: Math.round(totalCost * 100) / 100,
            totalGain: Math.round(totalGain * 100) / 100,
            totalGainPercent: Math.round(totalGainPercent * 100) / 100,
            holdingCount,
            bestPerformer: {
                symbol: bestPerformer.symbol,
                gainPercent: bestPerformer.gainPercent,
            },
            worstPerformer: {
                symbol: worstPerformer.symbol,
                gainPercent: worstPerformer.gainPercent,
            },
        };
    }
    /**
     * Check for significant portfolio changes
     */
    checkForAlerts(summary) {
        const alerts = [];
        // Alert if portfolio gained/lost >5% since last check
        const significantChangeThreshold = 5;
        if (Math.abs(summary.totalGainPercent) >= significantChangeThreshold) {
            alerts.push({
                type: 'PORTFOLIO_ALERT',
                severity: Math.abs(summary.totalGainPercent) > 10 ? 'high' : 'medium',
                message: `Portfolio ${summary.totalGainPercent > 0 ? 'gained' : 'lost'} ${Math.abs(summary.totalGainPercent).toFixed(2)}%`,
                totalValue: summary.totalValue,
                totalGain: summary.totalGain,
                timestamp: new Date(),
            });
        }
        return alerts;
    }
    /**
     * Publish portfolio update event
     */
    async publishPortfolioUpdate(summary, positions) {
        await this.publishEvent('portfolio-updated', {
            summary,
            positions,
            timestamp: new Date(),
        });
    }
    /**
     * Get portfolio value in real-time
     */
    async getPortfolioValue() {
        try {
            const prices = await this.fetchPrices();
            const positions = this.calculatePositions(prices);
            return positions.reduce((sum, pos) => sum + pos.currentValue, 0);
        }
        catch (error) {
            this.logger.error('Failed to get portfolio value', error);
            return 0;
        }
    }
    /**
     * Get portfolio breakdown (returns positions)
     */
    async getPortfolioBreakdown() {
        try {
            const prices = await this.fetchPrices();
            return this.calculatePositions(prices);
        }
        catch (error) {
            this.logger.error('Failed to get portfolio breakdown', error);
            return [];
        }
    }
    /**
     * Add a new holding
     */
    addHolding(symbol, binanceSymbol, quantity, costBasis) {
        this.holdings.push({
            symbol,
            binanceSymbol,
            quantity,
            costBasis,
            purchaseDate: new Date(),
        });
        this.logger.info(`Added holding: ${quantity} ${symbol.toUpperCase()} at $${costBasis}`);
    }
    /**
     * Update a holding
     */
    updateHolding(symbol, quantity) {
        const index = this.holdings.findIndex((h) => h.symbol === symbol);
        if (index >= 0) {
            this.holdings[index].quantity = quantity;
            this.logger.info(`Updated holding: ${quantity} ${symbol.toUpperCase()}`);
        }
        else {
            this.logger.warn(`Holding not found: ${symbol}`);
        }
    }
    /**
     * Remove a holding
     */
    removeHolding(symbol) {
        const index = this.holdings.findIndex((h) => h.symbol === symbol);
        if (index >= 0) {
            this.holdings.splice(index, 1);
            this.logger.info(`Removed holding: ${symbol.toUpperCase()}`);
        }
        else {
            this.logger.warn(`Holding not found: ${symbol}`);
        }
    }
    /**
     * Validate configuration
     */
    async validate() {
        this.logger.info('Validating PortfolioTracker...');
        try {
            if (this.holdings.length === 0) {
                throw new Error('No holdings configured');
            }
            // Test API connectivity
            const prices = await this.fetchPrices();
            const positions = this.calculatePositions(prices);
            if (!positions || positions.length === 0) {
                throw new Error('Failed to fetch price data');
            }
            const totalValue = positions.reduce((sum, pos) => sum + pos.currentValue, 0);
            this.logger.info(`✅ Validation successful. Portfolio value: $${totalValue.toFixed(2)}`);
            return true;
        }
        catch (error) {
            this.logger.error('Validation failed', error);
            return false;
        }
    }
    /**
     * Health check
     */
    async healthCheck() {
        try {
            const prices = await this.fetchPrices();
            return Object.keys(prices).length > 0;
        }
        catch (error) {
            this.logger.error('Health check failed', error);
            return false;
        }
    }
}
exports.PortfolioTracker = PortfolioTracker;
//# sourceMappingURL=portfolio-tracker.js.map