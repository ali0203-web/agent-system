"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MeanReversionOscillatorBot = void 0;
const base_agent_1 = require("../base-agent");
const binance_api_1 = require("../services/binance-api");
class MeanReversionOscillatorBot extends base_agent_1.BaseAgent {
    constructor() {
        super(...arguments);
        this.config = {
            name: 'mean-reversion-oscillator-bot',
            category: 'trading',
            description: 'Custom mean reversion oscillator for overbought/oversold detection',
            version: '1.0.0',
            schedule: '*/5 * * * *',
            timeout: 15000,
        };
        this.symbols = ['BTCUSDT', 'ETHUSDT', 'ADAUSDT', 'SOLUSDT', 'XRPUSDT'];
        this.priceHistory = new Map();
    }
    async execute() {
        this.logger.info(`Calculating reversion oscillator for ${this.symbols.length} pairs...`);
        try {
            const prices = await this.fetchPrices();
            const signals = await this.calculateOscillator(prices);
            if (signals.length > 0) {
                for (const signal of signals) {
                    const icon = signal.signal === 'overbought' ? '📈' : signal.signal === 'oversold' ? '📉' : '⚖️';
                    this.logger.info(`${icon} ${signal.signal.toUpperCase()}: ${signal.message}`);
                    await this.publishEvent('reversion-signal', signal);
                }
            }
            this.logger.info(`✅ Oscillator calculation complete: ${signals.length} signals`);
            return { success: true, signalCount: signals.length, signals, timestamp: new Date() };
        }
        catch (error) {
            this.logger.error('Failed to calculate oscillator', error);
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
    async calculateOscillator(prices) {
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
            if (history.length > 30) {
                history.shift();
            }
            if (history.length === 30) {
                const sma = history.reduce((a, b) => a + b) / history.length;
                const deviation = history.reduce((sum, p) => sum + Math.pow(p - sma, 2), 0) / history.length;
                const stdDev = Math.sqrt(deviation);
                const oscillator = (price - sma) / stdDev;
                let signal = 'neutral';
                let confidence = 0;
                if (oscillator > 2) {
                    signal = 'overbought';
                    confidence = Math.min(1, (oscillator - 2) / 2);
                }
                else if (oscillator < -2) {
                    signal = 'oversold';
                    confidence = Math.min(1, (-oscillator - 2) / 2);
                }
                const reversionSignal = {
                    symbol,
                    signal,
                    oscillator: Math.round(oscillator * 1000) / 1000,
                    confidence,
                    message: `${symbol}: ${signal} (oscillator=${oscillator.toFixed(3)}, threshold=±2.0)`,
                    timestamp: new Date(),
                };
                signals.push(reversionSignal);
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
exports.MeanReversionOscillatorBot = MeanReversionOscillatorBot;
//# sourceMappingURL=mean-reversion-oscillator-bot.js.map