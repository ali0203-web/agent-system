"use strict";
/**
 * Agent #9: Momentum Trader
 * Identifies and trades rapid price movements using momentum indicators
 * Enters positions when momentum accelerates, exits on reversal signals
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.momentumTrader = void 0;
const base_agent_1 = require("../base-agent");
const binance_api_1 = require("../services/binance-api");
class MomentumTrader extends base_agent_1.BaseAgent {
    constructor() {
        super(...arguments);
        this.config = {
            name: 'momentum-trader',
            category: 'trading',
            version: '1.0.0',
            description: 'Momentum Trader - Rides rapid price movements',
            schedule: '*/5 * * * *', // Every 5 minutes for faster momentum detection
        };
        this.positions = new Map();
        this.priceHistory = new Map();
        this.momentumHistory = new Map();
        this.maxHistoryLength = 50;
    }
    async execute() {
        this.logger.info('🚀 Momentum Trader: Scanning for momentum signals...');
        try {
            // Fetch current prices
            const prices = await this.fetchCurrentPrices();
            // Calculate momentum signals
            const signals = await this.calculateMomentumSignals(prices);
            // Check existing positions
            for (const [symbol, position] of this.positions) {
                const currentPrice = prices[position.symbol];
                if (!currentPrice)
                    continue;
                // Update position metrics
                position.unrealizedGain = ((currentPrice - position.entryPrice) / position.entryPrice) * 100;
                // Check for exit signals
                await this.checkExitSignals(position, currentPrice, signals.get(symbol));
            }
            // Check for entry signals
            for (const signal of signals.values()) {
                if (signal.strength === 'strong' || signal.strength === 'extreme') {
                    const currentPrice = prices[signal.symbol];
                    if (currentPrice && !this.positions.has(signal.symbol)) {
                        await this.enterPosition(signal, currentPrice);
                    }
                }
            }
            this.logger.info('✅ Momentum Trader: Scan completed');
        }
        catch (error) {
            const errorMsg = error?.message || 'Unknown error';
            this.logger.error(`❌ Momentum Trader failed: ${errorMsg}`);
            throw error;
        }
    }
    async calculateMomentumSignals(prices) {
        const signals = new Map();
        for (const [symbol, currentPrice] of Object.entries(prices)) {
            const history = this.priceHistory.get(symbol) || [];
            history.push(currentPrice);
            if (history.length > this.maxHistoryLength) {
                history.shift();
            }
            this.priceHistory.set(symbol, history);
            if (history.length < 5)
                continue; // Need at least 5 data points
            // Calculate momentum (rate of change)
            const momentum = this.calculateMomentum(history);
            // Calculate acceleration (momentum change)
            const momentumHist = this.momentumHistory.get(symbol) || [];
            momentumHist.push(momentum);
            if (momentumHist.length > 20)
                momentumHist.shift();
            this.momentumHistory.set(symbol, momentumHist);
            const acceleration = momentumHist.length > 1 ? momentumHist[momentumHist.length - 1] - momentumHist[momentumHist.length - 2] : 0;
            // Determine signal strength
            const strength = this.getSignalStrength(Math.abs(momentum), Math.abs(acceleration));
            const direction = momentum > 0 ? 'up' : 'down';
            const confidence = this.calculateConfidence(momentum, acceleration);
            signals.set(symbol, {
                symbol,
                momentum,
                acceleration,
                strength,
                direction,
                confidence,
                timestamp: new Date(),
            });
        }
        return signals;
    }
    calculateMomentum(priceHistory) {
        if (priceHistory.length < 2)
            return 0;
        const recentPrice = priceHistory[priceHistory.length - 1];
        const previousPrice = priceHistory[priceHistory.length - 2];
        return ((recentPrice - previousPrice) / previousPrice) * 100; // percentage change
    }
    getSignalStrength(momentum, acceleration) {
        const momentumAbs = Math.abs(momentum);
        if (momentumAbs > 3 && acceleration > 0.5)
            return 'extreme';
        if (momentumAbs > 2 && acceleration > 0.2)
            return 'strong';
        if (momentumAbs > 1)
            return 'moderate';
        return 'weak';
    }
    calculateConfidence(momentum, acceleration) {
        let confidence = 0.5; // base confidence
        // Higher momentum = higher confidence
        confidence += Math.min(Math.abs(momentum) / 5, 0.3);
        // Positive acceleration = higher confidence
        if (acceleration > 0)
            confidence += 0.1;
        return Math.min(confidence, 0.95);
    }
    async checkExitSignals(position, currentPrice, signal) {
        // Check trailing stop
        if (currentPrice > position.trailingStop) {
            position.trailingStop = currentPrice * (1 - position.stopLoss / 100);
        }
        const gainPercent = ((currentPrice - position.entryPrice) / position.entryPrice) * 100;
        // Exit conditions
        let shouldExit = false;
        let reason = '';
        // 1. Hit take profit
        if (gainPercent >= position.targetProfit) {
            shouldExit = true;
            reason = `Take profit (${gainPercent.toFixed(2)}%)`;
        }
        // 2. Hit trailing stop
        if (currentPrice < position.trailingStop) {
            shouldExit = true;
            reason = `Trailing stop hit at $${position.trailingStop.toFixed(2)}`;
        }
        // 3. Momentum reversal
        if (signal && signal.direction !== (position.momentumAtEntry > 0 ? 'up' : 'down')) {
            if (Math.abs(signal.momentum) > 1) {
                shouldExit = true;
                reason = 'Momentum reversal';
            }
        }
        if (shouldExit) {
            const profit = currentPrice - position.entryPrice;
            const profitPercent = (profit / position.entryPrice) * 100;
            this.logger.info(`💰 EXIT ${position.symbol} @ $${currentPrice.toFixed(2)} | Profit: $${profit.toFixed(2)} (${profitPercent.toFixed(2)}%) | Reason: ${reason}`);
            this.emit('momentum-exit', {
                symbol: position.symbol,
                entryPrice: position.entryPrice,
                exitPrice: currentPrice,
                profit,
                profitPercent,
                reason,
                holdDuration: Date.now() - position.entryTime.getTime(),
                timestamp: new Date(),
            });
            position.isActive = false;
            position.trades[position.trades.length - 1].exitPrice = currentPrice;
            position.trades[position.trades.length - 1].profit = profit;
            position.trades[position.trades.length - 1].profitPercent = profitPercent;
        }
    }
    async enterPosition(signal, currentPrice) {
        const position = {
            symbol: signal.symbol,
            entryPrice: currentPrice,
            entryTime: new Date(),
            momentumAtEntry: signal.momentum,
            targetProfit: signal.strength === 'extreme' ? 5 : signal.strength === 'strong' ? 3 : 2,
            stopLoss: 2,
            trailingStop: currentPrice * 0.98,
            isActive: true,
            unrealizedGain: 0,
            trades: [
                {
                    entryPrice: currentPrice,
                    duration: 0,
                },
            ],
        };
        this.positions.set(signal.symbol, position);
        this.logger.info(`🚀 ENTER ${signal.symbol} @ $${currentPrice.toFixed(2)} | Momentum: ${signal.momentum.toFixed(2)}% | Strength: ${signal.strength.toUpperCase()} | Confidence: ${(signal.confidence * 100).toFixed(0)}%`);
        this.emit('momentum-entry', {
            symbol: signal.symbol,
            entryPrice: currentPrice,
            momentum: signal.momentum,
            strength: signal.strength,
            confidence: signal.confidence,
            targetProfit: position.targetProfit,
            stopLoss: position.stopLoss,
            timestamp: new Date(),
        });
    }
    async fetchCurrentPrices() {
        try {
            const binance = (0, binance_api_1.getBinanceAPI)();
            const binancePrices = await binance.getPrices(['BTCUSDT', 'ETHUSDT', 'ADAUSDT', 'SOLUSDT', 'XRPUSDT']);
            return {
                BTC: binancePrices?.BTCUSDT || 0,
                ETH: binancePrices?.ETHUSDT || 0,
                ADA: binancePrices?.ADAUSDT || 0,
                SOL: binancePrices?.SOLUSDT || 0,
                XRP: binancePrices?.XRPUSDT || 0,
            };
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
    getTradeStats() {
        let totalTrades = 0;
        let winningTrades = 0;
        let losingTrades = 0;
        let totalProfit = 0;
        let totalProfitPercent = 0;
        for (const position of this.positions.values()) {
            for (const trade of position.trades) {
                if (trade.exitPrice) {
                    totalTrades++;
                    const profit = trade.exitPrice - trade.entryPrice;
                    if (profit > 0)
                        winningTrades++;
                    else if (profit < 0)
                        losingTrades++;
                    totalProfit += profit;
                    if (trade.profitPercent)
                        totalProfitPercent += trade.profitPercent;
                }
            }
        }
        return {
            totalTrades,
            winningTrades,
            losingTrades,
            totalProfit,
            winRate: totalTrades > 0 ? (winningTrades / totalTrades) * 100 : 0,
            avgProfitPercent: totalTrades > 0 ? totalProfitPercent / totalTrades : 0,
        };
    }
}
exports.momentumTrader = new MomentumTrader();
//# sourceMappingURL=momentum-trader.js.map