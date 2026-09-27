"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CorrelationMatrixBot = void 0;
const base_agent_1 = require("../base-agent");
const binance_api_1 = require("../services/binance-api");
class CorrelationMatrixBot extends base_agent_1.BaseAgent {
    constructor() {
        super(...arguments);
        this.config = {
            name: 'correlation-matrix-bot',
            category: 'trading',
            description: 'Multi-pair correlation analysis for diversification',
            version: '1.0.0',
            schedule: '*/15 * * * *',
            timeout: 20000,
        };
        this.symbols = ['BTCUSDT', 'ETHUSDT', 'ADAUSDT', 'SOLUSDT', 'XRPUSDT'];
        this.priceHistory = new Map();
    }
    async execute() {
        this.logger.info(`Analyzing correlations across ${this.symbols.length} symbols...`);
        try {
            const prices = await this.fetchPrices();
            const signals = await this.analyzeCorrelations(prices);
            if (signals.length > 0) {
                for (const signal of signals) {
                    const icon = signal.signal === 'diverge' ? '📊' : signal.signal === 'converge' ? '🔗' : '⚙️';
                    this.logger.info(`${icon} CORR ${signal.correlation.toFixed(2)}: ${signal.message}`);
                    await this.publishEvent('correlation-signal', signal);
                }
            }
            this.logger.info(`✅ Correlation analysis complete: ${signals.length} signals`);
            return { success: true, signalCount: signals.length, signals, timestamp: new Date() };
        }
        catch (error) {
            this.logger.error('Failed to analyze correlations', error);
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
    async analyzeCorrelations(prices) {
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
        }
        if (this.symbols.every(s => (this.priceHistory.get(s)?.length || 0) === 30)) {
            for (let i = 0; i < this.symbols.length; i++) {
                for (let j = i + 1; j < this.symbols.length; j++) {
                    const hist1 = this.priceHistory.get(this.symbols[i]);
                    const hist2 = this.priceHistory.get(this.symbols[j]);
                    const correlation = this.calculateCorrelation(hist1, hist2);
                    let signal = 'neutral';
                    if (correlation > 0.7) {
                        signal = 'converge';
                    }
                    else if (correlation < 0.3) {
                        signal = 'diverge';
                    }
                    if (signal !== 'neutral') {
                        const corrSignal = {
                            symbols: [this.symbols[i], this.symbols[j]],
                            correlation: Math.round(correlation * 1000) / 1000,
                            signal,
                            confidence: Math.abs(correlation),
                            message: `${this.symbols[i]}-${this.symbols[j]}: correlation=${correlation.toFixed(3)} (${signal})`,
                            timestamp: new Date(),
                        };
                        signals.push(corrSignal);
                    }
                }
            }
        }
        return signals;
    }
    calculateCorrelation(arr1, arr2) {
        const mean1 = arr1.reduce((a, b) => a + b) / arr1.length;
        const mean2 = arr2.reduce((a, b) => a + b) / arr2.length;
        let numerator = 0;
        let denom1 = 0;
        let denom2 = 0;
        for (let i = 0; i < arr1.length; i++) {
            const diff1 = arr1[i] - mean1;
            const diff2 = arr2[i] - mean2;
            numerator += diff1 * diff2;
            denom1 += diff1 * diff1;
            denom2 += diff2 * diff2;
        }
        return numerator / Math.sqrt(denom1 * denom2);
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
exports.CorrelationMatrixBot = CorrelationMatrixBot;
//# sourceMappingURL=correlation-matrix-bot.js.map