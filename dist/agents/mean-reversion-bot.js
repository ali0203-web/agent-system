"use strict";
/**
 * Agent #10: Mean Reversion Bot
 * Identifies price deviations from moving averages and trades reversions
 * Buys when price drops below MA, sells when it reverts to average
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.meanReversionBot = void 0;
const base_agent_1 = require("../base-agent");
class MeanReversionBot extends base_agent_1.BaseAgent {
    constructor() {
        super(...arguments);
        this.config = {
            name: 'mean-reversion-bot',
            category: 'trading',
            version: '1.0.0',
            description: 'Mean Reversion Bot - Trades price deviations and reversions',
            schedule: '*/10 * * * *', // Every 10 minutes
        };
        this.positions = new Map();
        this.priceHistory = new Map();
        this.maxHistoryLength = 100;
    }
    async execute() {
        this.logger.info('📊 Mean Reversion Bot: Scanning for reversion opportunities...');
        try {
            // Fetch current prices
            const prices = await this.fetchCurrentPrices();
            // Calculate reversion signals
            const signals = await this.calculateReversionSignals(prices);
            // Check existing positions
            for (const [symbol, position] of this.positions) {
                const currentPrice = prices[position.symbol];
                const signal = signals.get(symbol);
                if (currentPrice && signal) {
                    position.unrealizedGain = ((currentPrice - position.entryPrice) / position.entryPrice) * 100;
                    // Check for exit signals
                    await this.checkExitSignals(position, currentPrice, signal);
                }
            }
            // Check for entry signals
            for (const signal of signals.values()) {
                if ((signal.reversion === 'strong_oversold' || signal.reversion === 'oversold') &&
                    !this.positions.has(signal.symbol)) {
                    const currentPrice = prices[signal.symbol];
                    if (currentPrice) {
                        await this.enterPosition(signal, currentPrice);
                    }
                }
            }
            this.logger.info('✅ Mean Reversion Bot: Scan completed');
        }
        catch (error) {
            const errorMsg = error?.message || 'Unknown error';
            this.logger.error(`❌ Mean Reversion Bot failed: ${errorMsg}`);
            throw error;
        }
    }
    async calculateReversionSignals(prices) {
        const signals = new Map();
        for (const [symbol, currentPrice] of Object.entries(prices)) {
            const history = this.priceHistory.get(symbol) || [];
            history.push(currentPrice);
            if (history.length > this.maxHistoryLength) {
                history.shift();
            }
            this.priceHistory.set(symbol, history);
            if (history.length < 20)
                continue; // Need at least 20 data points
            // Calculate moving averages
            const ma20 = this.calculateMA(history, 20);
            const ma50 = history.length >= 50 ? this.calculateMA(history, 50) : ma20;
            // Calculate standard deviation
            const stdDev = this.calculateStdDev(history, ma20);
            // Calculate z-score
            const zScore = stdDev > 0 ? (currentPrice - ma20) / stdDev : 0;
            // Calculate deviation percentage
            const deviation = ((currentPrice - ma20) / ma20) * 100;
            // Determine reversion status
            const reversion = this.getReversionStatus(zScore, deviation);
            const confidence = this.calculateConfidence(Math.abs(zScore));
            signals.set(symbol, {
                symbol,
                currentPrice,
                movingAverage20: ma20,
                movingAverage50: ma50,
                standardDeviation: stdDev,
                zScore,
                deviation,
                reversion,
                confidence,
                timestamp: new Date(),
            });
        }
        return signals;
    }
    calculateMA(prices, period) {
        const slice = prices.slice(-period);
        return slice.reduce((a, b) => a + b, 0) / slice.length;
    }
    calculateStdDev(prices, mean) {
        const slice = prices.slice(-20);
        const variance = slice.reduce((acc, price) => acc + Math.pow(price - mean, 2), 0) / slice.length;
        return Math.sqrt(variance);
    }
    getReversionStatus(zScore, deviation) {
        if (zScore < -2)
            return 'strong_oversold';
        if (zScore < -1)
            return 'oversold';
        if (zScore > 2)
            return 'strong_overbought';
        if (zScore > 1)
            return 'overbought';
        return 'neutral';
    }
    calculateConfidence(zScoreAbs) {
        // Higher z-score = higher confidence in reversion
        return Math.min(zScoreAbs / 3, 0.95);
    }
    async checkExitSignals(position, currentPrice, signal) {
        const gainPercent = ((currentPrice - position.entryPrice) / position.entryPrice) * 100;
        // Exit if price reverts to MA or profit threshold
        let shouldExit = false;
        let reason = '';
        let revertedTo = 0;
        // 1. Price reverted to mean
        if (Math.abs(currentPrice - position.meanPrice) < position.meanPrice * 0.01) {
            shouldExit = true;
            reason = 'Reverted to mean price';
            revertedTo = currentPrice;
        }
        // 2. Z-score near zero (reversion happening)
        if (Math.abs(signal.zScore) < 0.5 && gainPercent > 0.5) {
            shouldExit = true;
            reason = 'Reversion in progress';
            revertedTo = signal.movingAverage20;
        }
        // 3. Stop loss (don't lose more than 2%)
        if (gainPercent < -2) {
            shouldExit = true;
            reason = 'Stop loss (2%)';
        }
        // 4. Take profit (if reverting strongly)
        if (gainPercent > position.expectedReversion * 0.8) {
            shouldExit = true;
            reason = 'Take profit';
            revertedTo = currentPrice;
        }
        if (shouldExit) {
            const profit = currentPrice - position.entryPrice;
            const profitPercent = (profit / position.entryPrice) * 100;
            this.logger.info(`💰 EXIT ${position.symbol} @ $${currentPrice.toFixed(2)} | Profit: $${profit.toFixed(2)} (${profitPercent.toFixed(2)}%) | Reason: ${reason}`);
            this.emit('reversion-exit', {
                symbol: position.symbol,
                entryPrice: position.entryPrice,
                exitPrice: currentPrice,
                meanPrice: position.meanPrice,
                profit,
                profitPercent,
                reason,
                revertedTo,
                holdDuration: Date.now() - position.entryTime.getTime(),
                timestamp: new Date(),
            });
            position.isActive = false;
            const lastTrade = position.trades[position.trades.length - 1];
            lastTrade.exitPrice = currentPrice;
            lastTrade.profit = profit;
            lastTrade.profitPercent = profitPercent;
            lastTrade.revertedTo = revertedTo;
        }
    }
    async enterPosition(signal, currentPrice) {
        const expectedReversion = Math.abs(signal.deviation * 0.8); // expect 80% of deviation to revert
        const position = {
            symbol: signal.symbol,
            entryPrice: currentPrice,
            meanPrice: signal.movingAverage20,
            expectedReversion,
            entryTime: new Date(),
            zScoreAtEntry: signal.zScore,
            isActive: true,
            unrealizedGain: 0,
            trades: [
                {
                    entryPrice: currentPrice,
                },
            ],
        };
        this.positions.set(signal.symbol, position);
        this.logger.info(`🔄 ENTER ${signal.symbol} @ $${currentPrice.toFixed(2)} | Mean: $${signal.movingAverage20.toFixed(2)} | Z-Score: ${signal.zScore.toFixed(2)} | Deviation: ${signal.deviation.toFixed(2)}% | Confidence: ${(signal.confidence * 100).toFixed(0)}%`);
        this.emit('reversion-entry', {
            symbol: signal.symbol,
            entryPrice: currentPrice,
            meanPrice: signal.movingAverage20,
            zScore: signal.zScore,
            deviation: signal.deviation,
            expectedReversion,
            confidence: signal.confidence,
            timestamp: new Date(),
        });
    }
    async fetchCurrentPrices() {
        const assets = ['bitcoin', 'ethereum', 'cardano', 'solana', 'ripple'];
        const url = `https://api.coingecko.com/api/v3/simple/price?ids=${assets.join(',')}&vs_currencies=usd`;
        try {
            const response = await this.get(url);
            const prices = {};
            const symbolMap = {
                bitcoin: 'BTC',
                ethereum: 'ETH',
                cardano: 'ADA',
                solana: 'SOL',
                ripple: 'XRP',
            };
            for (const [asset, symbol] of Object.entries(symbolMap)) {
                if (response[asset]?.usd) {
                    prices[symbol] = response[asset].usd;
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
    getPositions() {
        return Array.from(this.positions.values());
    }
    getPositionBySymbol(symbol) {
        return this.positions.get(symbol);
    }
    getReversionStats() {
        let totalTrades = 0;
        let successfulReverts = 0;
        let failedReverts = 0;
        let totalProfit = 0;
        let totalProfitPercent = 0;
        for (const position of this.positions.values()) {
            for (const trade of position.trades) {
                if (trade.exitPrice) {
                    totalTrades++;
                    const profit = trade.exitPrice - trade.entryPrice;
                    if (profit > 0)
                        successfulReverts++;
                    else if (profit < 0)
                        failedReverts++;
                    totalProfit += profit;
                    if (trade.profitPercent)
                        totalProfitPercent += trade.profitPercent;
                }
            }
        }
        return {
            totalTrades,
            successfulReverts,
            failedReverts,
            totalProfit,
            reversionRate: totalTrades > 0 ? (successfulReverts / totalTrades) * 100 : 0,
            avgProfitPercent: totalTrades > 0 ? totalProfitPercent / totalTrades : 0,
        };
    }
}
exports.meanReversionBot = new MeanReversionBot();
//# sourceMappingURL=mean-reversion-bot.js.map