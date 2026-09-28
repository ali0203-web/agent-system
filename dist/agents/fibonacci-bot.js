"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FibonacciBot = void 0;
const base_agent_1 = require("../base-agent");
const binance_api_1 = require("../services/binance-api");
class FibonacciBot extends base_agent_1.BaseAgent {
    constructor() {
        super(...arguments);
        this.config = {
            name: 'fibonacci-bot',
            category: 'trading',
            description: 'Fibonacci retracement levels for support and resistance',
            version: '1.0.0',
            schedule: '*/10 * * * *',
            timeout: 15000,
        };
        this.symbols = ['BTCUSDT', 'ETHUSDT', 'ADAUSDT', 'SOLUSDT', 'XRPUSDT'];
        this.priceHistory = new Map();
    }
    async execute() {
        this.logger.info(`Analyzing Fibonacci levels for ${this.symbols.length} pairs...`);
        try {
            const prices = await this.fetchPrices();
            const signals = await this.analyzeFibonacci(prices);
            if (signals.length > 0) {
                for (const signal of signals) {
                    this.logger.info(`📐 Fibonacci ${signal.signal}: ${signal.message}`);
                    await this.publishEvent('fibonacci-signal', signal);
                }
            }
            this.logger.info(`✅ Fibonacci analysis complete: ${signals.length} signals`);
            return { success: true, signalCount: signals.length, signals, timestamp: new Date() };
        }
        catch (error) {
            this.logger.error('Failed to analyze Fibonacci', error);
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
    async analyzeFibonacci(prices) {
        const signals = [];
        const fibLevels = [0.236, 0.382, 0.5, 0.618, 0.786];
        for (const symbol of this.symbols) {
            const price = prices[symbol];
            if (!price)
                continue;
            if (!this.priceHistory.has(symbol)) {
                this.priceHistory.set(symbol, []);
            }
            const history = this.priceHistory.get(symbol);
            history.push(price);
            if (history.length > 50)
                history.shift();
            if (history.length >= 20) {
                const high = Math.max(...history);
                const low = Math.min(...history);
                const range = high - low;
                for (const level of fibLevels) {
                    const fibLevel = high - range * level;
                    const distance = Math.abs(price - fibLevel);
                    if (distance < range * 0.02) {
                        const signal = {
                            symbol,
                            retracement: `${(level * 100).toFixed(1)}%`,
                            level: Math.round(fibLevel * 100) / 100,
                            distance: Math.round(distance * 100) / 100,
                            signal: price < fibLevel ? 'support' : 'resistance',
                            message: `${symbol}: ${(level * 100).toFixed(1)}% level at ${fibLevel.toFixed(2)}`,
                            timestamp: new Date(),
                        };
                        signals.push(signal);
                    }
                }
            }
        }
        return signals;
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
exports.FibonacciBot = FibonacciBot;
//# sourceMappingURL=fibonacci-bot.js.map