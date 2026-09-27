"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BollingerSqueezeBot = void 0;
const base_agent_1 = require("../base-agent");
const binance_api_1 = require("../services/binance-api");
class BollingerSqueezeBot extends base_agent_1.BaseAgent {
    constructor() {
        super(...arguments);
        this.config = {
            name: 'bollinger-squeeze-bot',
            category: 'trading',
            description: 'Bollinger Bands squeeze detection for volatility-based entries',
            version: '1.0.0',
            schedule: '*/5 * * * *',
            timeout: 15000,
        };
        this.symbols = ['BTCUSDT', 'ETHUSDT', 'ADAUSDT', 'SOLUSDT', 'XRPUSDT'];
        this.priceHistory = new Map();
    }
    async execute() {
        this.logger.info(`Detecting Bollinger Bands squeeze in ${this.symbols.length} pairs...`);
        try {
            const prices = await this.fetchPrices();
            const signals = await this.detectSqueeze(prices);
            if (signals.length > 0) {
                for (const signal of signals) {
                    const status = signal.squeezed ? '🔺 SQUEEZE' : '📊 NORMAL';
                    this.logger.info(`${status}: ${signal.message}`);
                    await this.publishEvent('squeeze-signal', signal);
                }
            }
            this.logger.info(`✅ Squeeze detection complete: ${signals.length} signals`);
            return { success: true, signalCount: signals.length, signals, timestamp: new Date() };
        }
        catch (error) {
            this.logger.error('Failed to detect squeeze', error);
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
    async detectSqueeze(prices) {
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
                const bb = this.calculateBollingerBands(history);
                const bandWidth = (bb.upper - bb.lower) / bb.middle;
                const squeezeThreshold = 0.02;
                const signal = {
                    symbol,
                    squeezed: bandWidth < squeezeThreshold,
                    confidence: Math.max(0, 1 - bandWidth / 0.05),
                    bandWidth: Math.round(bandWidth * 10000) / 10000,
                    message: `${symbol}: ${bandWidth < squeezeThreshold ? 'SQUEEZE DETECTED' : 'Normal volatility'} (width=${bandWidth.toFixed(4)})`,
                    timestamp: new Date(),
                };
                signals.push(signal);
            }
        }
        return signals;
    }
    calculateBollingerBands(prices) {
        const sma = prices.reduce((a, b) => a + b) / prices.length;
        const variance = prices.reduce((sum, p) => sum + Math.pow(p - sma, 2), 0) / prices.length;
        const stdDev = Math.sqrt(variance);
        const k = 2;
        return {
            middle: sma,
            upper: sma + k * stdDev,
            lower: sma - k * stdDev,
        };
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
exports.BollingerSqueezeBot = BollingerSqueezeBot;
//# sourceMappingURL=bollinger-squeeze-bot.js.map