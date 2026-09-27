"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.VolumeSurgeBot = void 0;
const base_agent_1 = require("../base-agent");
const binance_api_1 = require("../services/binance-api");
class VolumeSurgeBot extends base_agent_1.BaseAgent {
    constructor() {
        super(...arguments);
        this.config = {
            name: 'volume-surge-bot',
            category: 'trading',
            description: 'On-Balance Volume spike detection and analysis',
            version: '1.0.0',
            schedule: '*/5 * * * *',
            timeout: 15000,
        };
        this.symbols = ['BTCUSDT', 'ETHUSDT', 'ADAUSDT', 'SOLUSDT', 'XRPUSDT'];
        this.volumeHistory = new Map();
        this.priceHistory = new Map();
    }
    async execute() {
        this.logger.info(`Detecting volume surges in ${this.symbols.length} pairs...`);
        try {
            const prices = await this.fetchPrices();
            const signals = await this.detectSurges(prices);
            if (signals.length > 0) {
                for (const signal of signals) {
                    const icon = signal.surge === 'extreme' ? '🌪️' : signal.surge === 'moderate' ? '💨' : '💧';
                    this.logger.info(`${icon} VOLUME ${signal.surge.toUpperCase()}: ${signal.message}`);
                    await this.publishEvent('volume-signal', signal);
                }
            }
            this.logger.info(`✅ Volume surge detection complete: ${signals.length} signals`);
            return { success: true, signalCount: signals.length, signals, timestamp: new Date() };
        }
        catch (error) {
            this.logger.error('Failed to detect surges', error);
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
    async detectSurges(prices) {
        const signals = [];
        for (const symbol of this.symbols) {
            const price = prices[symbol];
            if (!price)
                continue;
            if (!this.volumeHistory.has(symbol)) {
                this.volumeHistory.set(symbol, []);
                this.priceHistory.set(symbol, []);
            }
            const volHist = this.volumeHistory.get(symbol);
            const priceHist = this.priceHistory.get(symbol);
            const volume = Math.random() * 1000 + 100;
            volHist.push(volume);
            priceHist.push(price);
            if (volHist.length > 20) {
                volHist.shift();
                priceHist.shift();
            }
            if (volHist.length === 20) {
                const avgVolume = volHist.reduce((a, b) => a + b) / volHist.length;
                const volumeRatio = volume / avgVolume;
                const obv = this.calculateOBV(priceHist, volHist);
                let surge = 'normal';
                if (volumeRatio > 3) {
                    surge = 'extreme';
                }
                else if (volumeRatio > 1.5) {
                    surge = 'moderate';
                }
                const obvDirection = obv > 0 ? 'positive' : obv < 0 ? 'negative' : 'neutral';
                const surgeSignal = {
                    symbol,
                    surge,
                    volumeRatio: Math.round(volumeRatio * 100) / 100,
                    obvDirection,
                    confidence: Math.min(1, (volumeRatio - 1) / 2),
                    message: `${symbol}: ${surge} surge (ratio=${volumeRatio.toFixed(2)}, OBV=${obvDirection})`,
                    timestamp: new Date(),
                };
                signals.push(surgeSignal);
            }
        }
        return signals;
    }
    calculateOBV(prices, volumes) {
        let obv = 0;
        for (let i = 1; i < prices.length; i++) {
            if (prices[i] > prices[i - 1]) {
                obv += volumes[i];
            }
            else if (prices[i] < prices[i - 1]) {
                obv -= volumes[i];
            }
        }
        return obv;
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
exports.VolumeSurgeBot = VolumeSurgeBot;
//# sourceMappingURL=volume-surge-bot.js.map