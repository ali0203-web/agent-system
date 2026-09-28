"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SupportResistanceDynamicBot = void 0;
const base_agent_1 = require("../base-agent");
const binance_api_1 = require("../services/binance-api");
class SupportResistanceDynamicBot extends base_agent_1.BaseAgent {
    constructor() {
        super(...arguments);
        this.config = {
            name: 'support-resistance-dynamic-bot',
            category: 'trading',
            description: 'Auto-detected support and resistance levels',
            version: '1.0.0',
            schedule: '*/10 * * * *',
            timeout: 15000,
        };
        this.symbols = ['BTCUSDT', 'ETHUSDT', 'ADAUSDT', 'SOLUSDT', 'XRPUSDT'];
        this.priceHistory = new Map();
    }
    async execute() {
        this.logger.info(`Detecting S/R levels in ${this.symbols.length} pairs...`);
        try {
            const prices = await this.fetchPrices();
            const signals = await this.detectLevels(prices);
            if (signals.length > 0) {
                for (const signal of signals) {
                    const icon = signal.levelType === 'support' ? '🔽' : '🔼';
                    this.logger.info(`${icon} ${signal.levelType.toUpperCase()}: ${signal.message}`);
                    await this.publishEvent('level-signal', signal);
                }
            }
            this.logger.info(`✅ Level detection complete: ${signals.length} signals`);
            return { success: true, signalCount: signals.length, signals, timestamp: new Date() };
        }
        catch (error) {
            this.logger.error('Failed to detect levels', error);
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
    async detectLevels(prices) {
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
                const high = Math.max(...history);
                const low = Math.min(...history);
                const mid = (high + low) / 2;
                const levels = [
                    { type: 'resistance', level: high, strength: 0.9 },
                    { type: 'resistance', level: high * 0.95 + low * 0.05, strength: 0.7 },
                    { type: 'support', level: mid, strength: 0.6 },
                    { type: 'support', level: low * 0.95 + high * 0.05, strength: 0.7 },
                    { type: 'support', level: low, strength: 0.9 },
                ];
                for (const levelInfo of levels) {
                    const distance = ((price - levelInfo.level) / levelInfo.level) * 100;
                    if (Math.abs(distance) < 1) {
                        const signal = {
                            symbol,
                            levelType: levelInfo.type,
                            level: Math.round(levelInfo.level * 100) / 100,
                            distance: Math.round(distance * 100) / 100,
                            strength: levelInfo.strength,
                            message: `${symbol}: ${levelInfo.type} at ${levelInfo.level.toFixed(2)} (${distance.toFixed(2)}% away, strength=${levelInfo.strength})`,
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
exports.SupportResistanceDynamicBot = SupportResistanceDynamicBot;
//# sourceMappingURL=support-resistance-dynamic-bot.js.map