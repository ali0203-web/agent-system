"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ATRBot = void 0;
const base_agent_1 = require("../base-agent");
const binance_api_1 = require("../services/binance-api");
class ATRBot extends base_agent_1.BaseAgent {
    constructor() {
        super(...arguments);
        this.config = {
            name: 'atr-bot',
            category: 'trading',
            description: 'Average True Range based volatility and position sizing strategy',
            version: '1.0.0',
            schedule: '*/5 * * * *',
            timeout: 15000,
        };
        this.symbols = ['BTCUSDT', 'ETHUSDT', 'ADAUSDT', 'SOLUSDT', 'XRPUSDT'];
        this.priceHistory = new Map();
    }
    async execute() {
        this.logger.info(`Analyzing volatility with ATR for ${this.symbols.length} pairs...`);
        try {
            const prices = await this.fetchPrices();
            const signals = await this.analyzeATR(prices);
            if (signals.length > 0) {
                for (const signal of signals) {
                    this.logger.info(`📈 ATR Signal: ${signal.message}`);
                    await this.publishEvent('atr-signal', signal);
                }
            }
            this.logger.info(`✅ ATR analysis complete: ${signals.length} signals`);
            return {
                success: true,
                signalCount: signals.length,
                signals,
                timestamp: new Date(),
            };
        }
        catch (error) {
            this.logger.error('Failed to analyze ATR', error);
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
    async analyzeATR(prices) {
        const signals = [];
        for (const symbol of this.symbols) {
            const price = prices[symbol];
            if (!price)
                continue;
            if (!this.priceHistory.has(symbol)) {
                this.priceHistory.set(symbol, []);
            }
            const history = this.priceHistory.get(symbol);
            // Simulate high/low with price variations
            const high = price * (1 + Math.random() * 0.01);
            const low = price * (1 - Math.random() * 0.01);
            history.push({ high, low, close: price });
            if (history.length > 14) {
                history.shift();
            }
            if (history.length === 14) {
                const atr = this.calculateATR(history);
                const volatilityLevel = this.getVolatilityLevel(atr, price);
                const stopLoss = price - atr * 2;
                const signal = {
                    symbol,
                    atrValue: Math.round(atr * 100) / 100,
                    volatilityLevel,
                    recommendedStopLoss: Math.round(stopLoss * 100) / 100,
                    message: `${symbol}: ATR=${atr.toFixed(2)}, Volatility=${volatilityLevel}, SL=${stopLoss.toFixed(2)}`,
                    timestamp: new Date(),
                };
                signals.push(signal);
            }
        }
        return signals;
    }
    calculateATR(history) {
        let sumTR = 0;
        for (const bar of history) {
            const tr = bar.high - bar.low;
            sumTR += tr;
        }
        return sumTR / history.length;
    }
    getVolatilityLevel(atr, price) {
        const atrPercent = (atr / price) * 100;
        if (atrPercent < 1)
            return 'low';
        if (atrPercent < 2)
            return 'medium';
        return 'high';
    }
    async validate() {
        try {
            const prices = await this.fetchPrices();
            return Object.keys(prices).length > 0;
        }
        catch (error) {
            this.logger.error('Validation failed', error);
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
exports.ATRBot = ATRBot;
//# sourceMappingURL=atr-bot.js.map