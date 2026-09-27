"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.StochasticBot = void 0;
const base_agent_1 = require("../base-agent");
const binance_api_1 = require("../services/binance-api");
class StochasticBot extends base_agent_1.BaseAgent {
    constructor() {
        super(...arguments);
        this.config = {
            name: 'stochastic-bot',
            category: 'trading',
            description: 'Stochastic Oscillator trading strategy for momentum analysis',
            version: '1.0.0',
            schedule: '*/5 * * * *', // Every 5 minutes
            timeout: 15000,
        };
        this.symbols = ['BTCUSDT', 'ETHUSDT', 'ADAUSDT', 'SOLUSDT', 'XRPUSDT'];
        this.priceHistory = new Map();
        this.kHistory = new Map();
        this.dHistory = new Map();
    }
    async execute() {
        this.logger.info(`Scanning ${this.symbols.length} pairs with Stochastic Oscillator...`);
        try {
            const prices = await this.fetchPrices();
            const signals = await this.analyzeStochastic(prices);
            if (signals.length > 0) {
                for (const signal of signals) {
                    this.logger.warn(`📊 ${signal.signal.toUpperCase()}: ${signal.message}`);
                    await this.publishEvent('stochastic-signal', signal);
                }
            }
            this.logger.info(`✅ Stochastic analysis complete: ${signals.length} signals`);
            return {
                success: true,
                signalCount: signals.length,
                signals,
                timestamp: new Date(),
            };
        }
        catch (error) {
            this.logger.error('Failed to analyze stochastic', error);
            throw error;
        }
    }
    async fetchPrices() {
        try {
            const binance = (0, binance_api_1.getBinanceAPI)();
            const prices = await binance.getPrices(this.symbols);
            return prices || {};
        }
        catch (error) {
            this.logger.error('Failed to fetch prices', error);
            throw error;
        }
    }
    async analyzeStochastic(prices) {
        const signals = [];
        for (const symbol of this.symbols) {
            const price = prices[symbol];
            if (!price)
                continue;
            // Initialize histories
            if (!this.priceHistory.has(symbol)) {
                this.priceHistory.set(symbol, []);
                this.kHistory.set(symbol, []);
                this.dHistory.set(symbol, []);
            }
            const priceHist = this.priceHistory.get(symbol);
            priceHist.push(price);
            // Keep last 14 prices for %K calculation
            if (priceHist.length > 14) {
                priceHist.shift();
            }
            if (priceHist.length === 14) {
                // Calculate %K (Stochastic)
                const low14 = Math.min(...priceHist);
                const high14 = Math.max(...priceHist);
                const kValue = ((price - low14) / (high14 - low14)) * 100;
                const kHist = this.kHistory.get(symbol);
                kHist.push(kValue);
                // Keep last 3 K values for D calculation (SMA of K)
                if (kHist.length > 3) {
                    kHist.shift();
                }
                let dValue = kValue;
                if (kHist.length === 3) {
                    dValue = (kHist[0] + kHist[1] + kHist[2]) / 3;
                }
                const dHist = this.dHistory.get(symbol);
                dHist.push(dValue);
                // Detect crossover
                const crossover = this.detectCrossover(kHist, dHist);
                // Determine signal
                let signal = 'neutral';
                if (kValue > 80)
                    signal = 'overbought';
                else if (kValue < 20)
                    signal = 'oversold';
                const stochasticSignal = {
                    symbol,
                    signal,
                    kValue: Math.round(kValue * 100) / 100,
                    dValue: Math.round(dValue * 100) / 100,
                    crossover,
                    message: `${symbol}: K=${Math.round(kValue)}% D=${Math.round(dValue)}% ${crossover !== 'none' ? `- ${crossover} crossover` : ''}`,
                    timestamp: new Date(),
                };
                if (signal !== 'neutral' || crossover !== 'none') {
                    signals.push(stochasticSignal);
                }
            }
        }
        return signals;
    }
    detectCrossover(kHist, dHist) {
        if (kHist.length < 2 || dHist.length < 2)
            return 'none';
        const prevK = kHist[kHist.length - 2];
        const currK = kHist[kHist.length - 1];
        const prevD = dHist[dHist.length - 2];
        const currD = dHist[dHist.length - 1];
        // Bullish crossover: K crosses above D
        if (prevK <= prevD && currK > currD) {
            return 'bullish';
        }
        // Bearish crossover: K crosses below D
        if (prevK >= prevD && currK < currD) {
            return 'bearish';
        }
        return 'none';
    }
    async validate() {
        this.logger.info('Validating StochasticBot...');
        try {
            if (this.symbols.length === 0) {
                throw new Error('No symbols configured');
            }
            const prices = await this.fetchPrices();
            if (!prices || Object.keys(prices).length === 0) {
                throw new Error('Failed to fetch prices');
            }
            this.logger.info(`✅ Validation successful. Monitoring ${this.symbols.length} pairs`);
            return true;
        }
        catch (error) {
            this.logger.error('Validation failed', error);
            return false;
        }
    }
    async healthCheck() {
        try {
            const prices = await this.fetchPrices();
            return Object.keys(prices).length > 0;
        }
        catch (error) {
            this.logger.error('Health check failed', error);
            return false;
        }
    }
}
exports.StochasticBot = StochasticBot;
//# sourceMappingURL=stochastic-bot.js.map