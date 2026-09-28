"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MarketRegimeBot = void 0;
const base_agent_1 = require("../base-agent");
const binance_api_1 = require("../services/binance-api");
class MarketRegimeBot extends base_agent_1.BaseAgent {
    constructor() {
        super(...arguments);
        this.config = {
            name: 'market-regime-bot',
            category: 'trading',
            description: 'Market regime detection for bull/bear/sideways movements',
            version: '1.0.0',
            schedule: '*/15 * * * *',
            timeout: 15000,
        };
        this.symbols = ['BTCUSDT', 'ETHUSDT', 'ADAUSDT', 'SOLUSDT', 'XRPUSDT'];
        this.priceHistory = new Map();
    }
    async execute() {
        this.logger.info(`Detecting market regimes for ${this.symbols.length} pairs...`);
        try {
            const prices = await this.fetchPrices();
            const signals = await this.analyzeRegimes(prices);
            if (signals.length > 0) {
                for (const signal of signals) {
                    this.logger.warn(`🎯 Market ${signal.regime.toUpperCase()}: ${signal.message}`);
                    await this.publishEvent('regime-signal', signal);
                }
            }
            this.logger.info(`✅ Regime analysis complete: ${signals.length} signals`);
            return { success: true, signalCount: signals.length, signals, timestamp: new Date() };
        }
        catch (error) {
            this.logger.error('Failed to analyze regimes', error);
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
    async analyzeRegimes(prices) {
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
            if (history.length === 50) {
                const regime = this.detectRegime(history);
                const trend = this.detectTrend(history);
                const confidence = this.calculateConfidence(history);
                const signal = {
                    symbol,
                    regime: regime,
                    confidence,
                    trend: trend,
                    message: `${symbol}: ${regime} market, ${trend}, confidence=${(confidence * 100).toFixed(0)}%`,
                    timestamp: new Date(),
                };
                signals.push(signal);
            }
        }
        return signals;
    }
    detectRegime(history) {
        const first = history[0];
        const last = history[history.length - 1];
        const change = (last - first) / first;
        if (change > 0.05)
            return 'bull';
        if (change < -0.05)
            return 'bear';
        return 'sideways';
    }
    detectTrend(history) {
        const recent = history.slice(-10);
        const older = history.slice(-20, -10);
        const recentAvg = recent.reduce((a, b) => a + b) / recent.length;
        const olderAvg = older.reduce((a, b) => a + b) / older.length;
        if (recentAvg > olderAvg * 1.02)
            return 'uptrend';
        if (recentAvg < olderAvg * 0.98)
            return 'downtrend';
        return 'ranging';
    }
    calculateConfidence(history) {
        const volatility = Math.sqrt(history.reduce((sum, val, i) => {
            if (i === 0)
                return sum;
            return sum + Math.pow(val - history[i - 1], 2);
        }, 0) / history.length) / history[0];
        return Math.max(0, Math.min(1, 1 - volatility));
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
exports.MarketRegimeBot = MarketRegimeBot;
//# sourceMappingURL=market-regime-bot.js.map