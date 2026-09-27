"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TrendStrengthBot = void 0;
const base_agent_1 = require("../base-agent");
const binance_api_1 = require("../services/binance-api");
class TrendStrengthBot extends base_agent_1.BaseAgent {
    constructor() {
        super(...arguments);
        this.config = {
            name: 'trend-strength-bot',
            category: 'trading',
            description: 'ADX-based trend strength measurement',
            version: '1.0.0',
            schedule: '*/15 * * * *',
            timeout: 15000,
        };
        this.symbols = ['BTCUSDT', 'ETHUSDT', 'ADAUSDT', 'SOLUSDT', 'XRPUSDT'];
        this.priceHistory = new Map();
    }
    async execute() {
        this.logger.info(`Measuring trend strength in ${this.symbols.length} pairs...`);
        try {
            const prices = await this.fetchPrices();
            const signals = await this.measureTrend(prices);
            if (signals.length > 0) {
                for (const signal of signals) {
                    const icon = signal.strength === 'strong' ? '💪' : signal.strength === 'weak' ? '🙌' : '⚪';
                    this.logger.info(`${icon} TREND ${signal.strength.toUpperCase()}: ${signal.message}`);
                    await this.publishEvent('trend-signal', signal);
                }
            }
            this.logger.info(`✅ Trend analysis complete: ${signals.length} signals`);
            return { success: true, signalCount: signals.length, signals, timestamp: new Date() };
        }
        catch (error) {
            this.logger.error('Failed to measure trend', error);
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
    async measureTrend(prices) {
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
            if (history.length > 28) {
                history.shift();
            }
            if (history.length === 28) {
                const adx = this.calculateADX(history);
                const direction = this.getDirection(history);
                let strength = 'neutral';
                if (adx > 25) {
                    strength = 'strong';
                }
                else if (adx < 20) {
                    strength = 'weak';
                }
                const trendSignal = {
                    symbol,
                    strength,
                    adx: Math.round(adx * 100) / 100,
                    direction,
                    confidence: Math.min(1, adx / 40),
                    message: `${symbol}: ${strength} ${direction} trend (ADX=${adx.toFixed(2)})`,
                    timestamp: new Date(),
                };
                signals.push(trendSignal);
            }
        }
        return signals;
    }
    calculateADX(prices) {
        let sumTR = 0;
        let sumDMPlus = 0;
        let sumDMMinus = 0;
        for (let i = 1; i < prices.length; i++) {
            const tr = Math.abs(prices[i] - prices[i - 1]);
            const dm = prices[i] > prices[i - 1] ? Math.abs(prices[i] - prices[i - 1]) : 0;
            const dmMinus = prices[i] < prices[i - 1] ? Math.abs(prices[i] - prices[i - 1]) : 0;
            sumTR += tr;
            sumDMPlus += dm;
            sumDMMinus += dmMinus;
        }
        const avgTR = sumTR / (prices.length - 1);
        const diPlus = (sumDMPlus / avgTR) * 100;
        const diMinus = (sumDMMinus / avgTR) * 100;
        const dx = Math.abs(diPlus - diMinus) / (diPlus + diMinus) * 100;
        return Math.max(0, Math.min(100, dx));
    }
    getDirection(history) {
        const recent = history.slice(-10).reduce((a, b) => a + b) / 10;
        const older = history.slice(-20, -10).reduce((a, b) => a + b) / 10;
        if (recent > older * 1.02)
            return 'uptrend';
        if (recent < older * 0.98)
            return 'downtrend';
        return 'ranging';
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
exports.TrendStrengthBot = TrendStrengthBot;
//# sourceMappingURL=trend-strength-bot.js.map