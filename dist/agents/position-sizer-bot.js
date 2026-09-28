"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PositionSizerBot = void 0;
const base_agent_1 = require("../base-agent");
const binance_api_1 = require("../services/binance-api");
class PositionSizerBot extends base_agent_1.BaseAgent {
    constructor() {
        super(...arguments);
        this.config = {
            name: 'position-sizer-bot',
            category: 'trading',
            description: 'Risk-adjusted position sizing based on volatility',
            version: '1.0.0',
            schedule: '*/10 * * * *',
            timeout: 15000,
        };
        this.symbols = ['BTCUSDT', 'ETHUSDT', 'ADAUSDT', 'SOLUSDT', 'XRPUSDT'];
        this.priceHistory = new Map();
        this.accountBalance = 10000;
    }
    async execute() {
        this.logger.info(`Calculating position sizes for ${this.symbols.length} symbols...`);
        try {
            const prices = await this.fetchPrices();
            const signals = await this.calculatePositions(prices);
            if (signals.length > 0) {
                for (const signal of signals) {
                    const riskIcon = signal.riskLevel === 'low' ? '🟢' : signal.riskLevel === 'medium' ? '🟡' : '🔴';
                    this.logger.info(`${riskIcon} SIZE: ${signal.message}`);
                    await this.publishEvent('position-signal', signal);
                }
            }
            this.logger.info(`✅ Position sizing complete: ${signals.length} signals`);
            return { success: true, signalCount: signals.length, signals, timestamp: new Date() };
        }
        catch (error) {
            this.logger.error('Failed to calculate positions', error);
            throw error;
        }
    }
    async fetchPrices() {
        try {
            const binance = (0, binance_api_1.getBinanceAPI)();
            return (await binance.getPrices(this.symbols)) || {};
        }
        catch (error) {
            this.logger.error('Failed to fetch prices', error);
            throw error;
        }
    }
    async calculatePositions(prices) {
        const signals = [];
        for (const symbol of this.symbols) {
            const price = prices[symbol];
            if (!price)
                continue;
            if (!this.priceHistory.has(symbol)) {
                this.priceHistory.set(symbol, []);
            }
            const history = this.priceHistory.get(symbol);
            history.push(price);
            if (history.length > 20) {
                history.shift();
            }
            if (history.length === 20) {
                const volatility = this.calculateVolatility(history);
                let riskLevel = 'medium';
                let positionPercent = 2;
                if (volatility < 0.01) {
                    riskLevel = 'low';
                    positionPercent = 3;
                }
                else if (volatility > 0.03) {
                    riskLevel = 'high';
                    positionPercent = 1;
                }
                const recommendedSize = (this.accountBalance * positionPercent) / 100 / price;
                const stopLoss = price * (1 - 2 * volatility);
                const maxLoss = recommendedSize * Math.abs(price - stopLoss);
                const positionSignal = {
                    symbol,
                    recommendedSize: Math.round(recommendedSize * 1000) / 1000,
                    riskLevel,
                    volatility: Math.round(volatility * 10000) / 10000,
                    maxLoss: Math.round(maxLoss * 100) / 100,
                    message: `${symbol}: Size=${recommendedSize.toFixed(3)} (volatility=${volatility.toFixed(4)}, risk=${riskLevel}, maxLoss=${maxLoss.toFixed(2)})`,
                    timestamp: new Date(),
                };
                signals.push(positionSignal);
            }
        }
        return signals;
    }
    calculateVolatility(prices) {
        if (prices.length < 2)
            return 0;
        const returns = prices.slice(1).map((p, i) => (p - prices[i]) / prices[i]);
        const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
        const variance = returns.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) / returns.length;
        return Math.sqrt(variance);
    }
    async validate() {
        try {
            const prices = await this.fetchPrices();
            return Object.keys(prices).length > 0;
        }
        catch (error) {
            return false;
        }
    }
    async healthCheck() {
        try {
            const prices = await this.fetchPrices();
            return Object.keys(prices).length > 0;
        }
        catch (error) {
            return false;
        }
    }
}
exports.PositionSizerBot = PositionSizerBot;
//# sourceMappingURL=position-sizer-bot.js.map