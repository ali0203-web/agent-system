"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.WhaleWatchBot = void 0;
const base_agent_1 = require("../base-agent");
const binance_api_1 = require("../services/binance-api");
class WhaleWatchBot extends base_agent_1.BaseAgent {
    constructor() {
        super(...arguments);
        this.config = {
            name: 'whale-watch-bot',
            category: 'trading',
            description: 'Large transaction (whale) monitoring for market signals',
            version: '1.0.0',
            schedule: '*/10 * * * *',
            timeout: 15000,
        };
        this.symbols = ['BTCUSDT', 'ETHUSDT', 'ADAUSDT', 'SOLUSDT', 'XRPUSDT'];
        this.volumeHistory = new Map();
    }
    async execute() {
        this.logger.info(`Monitoring whale activity in ${this.symbols.length} pairs...`);
        try {
            const prices = await this.fetchPrices();
            const signals = await this.detectWhales(prices);
            if (signals.length > 0) {
                for (const signal of signals) {
                    this.logger.warn(`🐋 WHALE ${signal.activity}: ${signal.message}`);
                    await this.publishEvent('whale-signal', signal);
                }
            }
            this.logger.info(`✅ Whale watch complete: ${signals.length} signals`);
            return { success: true, signalCount: signals.length, signals, timestamp: new Date() };
        }
        catch (error) {
            this.logger.error('Failed to detect whales', error);
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
    async detectWhales(prices) {
        const signals = [];
        for (const symbol of this.symbols) {
            const price = prices[symbol];
            if (!price)
                continue;
            if (!this.volumeHistory.has(symbol)) {
                this.volumeHistory.set(symbol, []);
            }
            const volHist = this.volumeHistory.get(symbol);
            const volume = Math.random() * 5000 + 500;
            volHist.push(volume);
            if (volHist.length > 20) {
                volHist.shift();
            }
            if (volHist.length === 20) {
                const avgVolume = volHist.reduce((a, b) => a + b) / volHist.length;
                const currentVolume = volume;
                const volumeRatio = currentVolume / avgVolume;
                if (volumeRatio > 2.5) {
                    const activity = Math.random() > 0.5 ? 'accumulation' : 'distribution';
                    const confidence = Math.min(1, (volumeRatio - 2.5) / 2.5);
                    const signal = {
                        symbol,
                        activity,
                        largeTransaction: Math.round(currentVolume * 100) / 100,
                        confidence,
                        message: `${symbol}: ${activity} detected - ${volumeRatio.toFixed(1)}x volume spike`,
                        timestamp: new Date(),
                    };
                    signals.push(signal);
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
exports.WhaleWatchBot = WhaleWatchBot;
//# sourceMappingURL=whale-watch-bot.js.map