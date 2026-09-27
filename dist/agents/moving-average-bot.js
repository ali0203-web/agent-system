"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MovingAverageBot = void 0;
const base_agent_1 = require("../base-agent");
const binance_api_1 = require("../services/binance-api");
class MovingAverageBot extends base_agent_1.BaseAgent {
    constructor() {
        super(...arguments);
        this.config = {
            name: 'moving-average-bot',
            category: 'trading',
            description: 'Moving Average Crossover trading strategy',
            version: '1.0.0',
            schedule: '*/5 * * * *',
            timeout: 15000,
        };
        this.symbols = ['BTCUSDT', 'ETHUSDT', 'ADAUSDT', 'SOLUSDT', 'XRPUSDT'];
        this.priceHistory = new Map();
    }
    async execute() {
        this.logger.info(`Analyzing MA crossovers for ${this.symbols.length} pairs...`);
        try {
            const prices = await this.fetchPrices();
            const signals = await this.analyzeMA(prices);
            if (signals.length > 0) {
                for (const signal of signals) {
                    this.logger.warn(`🔄 ${signal.signal.toUpperCase()}: ${signal.message}`);
                    await this.publishEvent('ma-signal', signal);
                }
            }
            this.logger.info(`✅ MA analysis complete: ${signals.length} signals`);
            return { success: true, signalCount: signals.length, signals, timestamp: new Date() };
        }
        catch (error) {
            this.logger.error('Failed to analyze MA', error);
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
    async analyzeMA(prices) {
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
            if (history.length > 50) {
                history.shift();
            }
            if (history.length >= 20) {
                const fastMA = this.calculateSMA(history, 10);
                const slowMA = this.calculateSMA(history, 20);
                const prevFastMA = history.length > 11 ? this.calculateSMA(history.slice(0, -1), 10) : fastMA;
                const prevSlowMA = history.length > 21 ? this.calculateSMA(history.slice(0, -1), 20) : slowMA;
                const crossover = (prevFastMA <= prevSlowMA && fastMA > slowMA) || (prevFastMA >= prevSlowMA && fastMA < slowMA);
                let signal = 'neutral';
                if (fastMA > slowMA)
                    signal = 'bullish';
                else if (fastMA < slowMA)
                    signal = 'bearish';
                const maSignal = {
                    symbol,
                    signal,
                    fastMA: Math.round(fastMA * 100) / 100,
                    slowMA: Math.round(slowMA * 100) / 100,
                    crossover,
                    message: `${symbol}: 10SMA=${fastMA.toFixed(2)} vs 20SMA=${slowMA.toFixed(2)}${crossover ? ' - CROSSOVER' : ''}`,
                    timestamp: new Date(),
                };
                if (signal !== 'neutral' || crossover) {
                    signals.push(maSignal);
                }
            }
        }
        return signals;
    }
    calculateSMA(prices, period) {
        const recent = prices.slice(-period);
        return recent.reduce((a, b) => a + b, 0) / recent.length;
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
exports.MovingAverageBot = MovingAverageBot;
//# sourceMappingURL=moving-average-bot.js.map