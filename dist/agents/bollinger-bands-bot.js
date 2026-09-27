"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BollingerBandsBot = void 0;
const base_agent_1 = require("../base-agent");
const binance_api_1 = require("../services/binance-api");
class BollingerBandsBot extends base_agent_1.BaseAgent {
    constructor() {
        super(...arguments);
        this.config = {
            name: 'bollinger-bands-bot',
            category: 'trading',
            description: 'Trade using Bollinger Bands squeeze and breakout signals',
            version: '1.0.0',
            schedule: '*/5 * * * *', // Every 5 minutes
            timeout: 15000,
        };
        this.symbols = ['BTCUSDT', 'ETHUSDT', 'ADAUSDT', 'SOLUSDT', 'XRPUSDT'];
        this.period = 20;
        this.stdDev = 2;
        this.priceHistory = new Map();
        this.bandHistory = new Map();
    }
    async execute() {
        this.logger.info(`Scanning ${this.symbols.length} pairs for Bollinger Bands signals...`);
        try {
            // Fetch current prices
            const prices = await this.fetchPrices();
            // Calculate Bollinger Bands
            const signals = await this.analyzeSignals(prices);
            // Publish signals
            if (signals.length > 0) {
                for (const signal of signals) {
                    this.logger.warn(`🚨 ${signal.type.toUpperCase()}: ${signal.message}`);
                    await this.publishEvent('bollinger-signal', signal);
                }
            }
            this.logger.info(`✅ Analysis complete: Found ${signals.length} signals`);
            return {
                success: true,
                signalCount: signals.length,
                signals,
                timestamp: new Date(),
            };
        }
        catch (error) {
            this.logger.error('Failed to analyze Bollinger Bands', error);
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
    async analyzeSignals(prices) {
        const signals = [];
        for (const symbol of this.symbols) {
            const price = prices[symbol];
            if (!price)
                continue;
            // Update price history
            if (!this.priceHistory.has(symbol)) {
                this.priceHistory.set(symbol, []);
            }
            const history = this.priceHistory.get(symbol);
            history.push(price);
            // Keep only last 50 prices
            if (history.length > 50) {
                history.shift();
            }
            // Need at least 20 data points
            if (history.length < this.period) {
                continue;
            }
            // Calculate Bollinger Bands
            const recentPrices = history.slice(-this.period);
            const bands = this.calculateBands(recentPrices);
            // Store bands history
            if (!this.bandHistory.has(symbol)) {
                this.bandHistory.set(symbol, []);
            }
            const bandHist = this.bandHistory.get(symbol);
            bandHist.push(bands);
            if (bandHist.length > 10) {
                bandHist.shift();
            }
            // Detect signals
            const signal = this.detectSignal(symbol, price, bands, bandHist);
            if (signal) {
                signals.push(signal);
            }
        }
        return signals;
    }
    calculateBands(prices) {
        const middle = prices.reduce((a, b) => a + b) / prices.length;
        const variance = prices.reduce((sum, p) => sum + Math.pow(p - middle, 2), 0) / prices.length;
        const std = Math.sqrt(variance);
        return {
            upper: middle + this.stdDev * std,
            middle,
            lower: middle - this.stdDev * std,
            timestamp: new Date(),
        };
    }
    detectSignal(symbol, price, bands, history) {
        if (history.length < 2)
            return null;
        const prevBands = history[history.length - 2];
        const bandWidth = (bands.upper - bands.lower) / bands.middle;
        const prevBandWidth = (prevBands.upper - prevBands.lower) / prevBands.middle;
        // Squeeze signal: bands getting closer
        if (prevBandWidth > bandWidth && bandWidth < 0.02) {
            return {
                symbol,
                type: 'squeeze',
                price,
                upper: bands.upper,
                lower: bands.lower,
                middle: bands.middle,
                signal_strength: (0.02 - bandWidth) / 0.02,
                message: `${symbol} in Bollinger Band squeeze - volatility contraction`,
                timestamp: new Date(),
            };
        }
        // Breakout signal: price breaks upper band
        if (price > bands.upper && history[history.length - 2] &&
            price > (history[history.length - 2].upper || bands.upper)) {
            return {
                symbol,
                type: 'breakout',
                price,
                upper: bands.upper,
                lower: bands.lower,
                middle: bands.middle,
                signal_strength: Math.min((price - bands.upper) / (bands.middle - bands.lower), 1),
                message: `${symbol} broke above upper Bollinger Band - bullish breakout`,
                timestamp: new Date(),
            };
        }
        // Mean reversion signal: price touches lower band
        if (price < bands.lower && price > bands.middle * 0.98) {
            return {
                symbol,
                type: 'mean-reversion',
                price,
                upper: bands.upper,
                lower: bands.lower,
                middle: bands.middle,
                signal_strength: (bands.lower - price) / (bands.middle - bands.lower),
                message: `${symbol} at lower Bollinger Band - potential mean reversion`,
                timestamp: new Date(),
            };
        }
        return null;
    }
    async validate() {
        this.logger.info('Validating BollingerBandsBot...');
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
exports.BollingerBandsBot = BollingerBandsBot;
//# sourceMappingURL=bollinger-bands-bot.js.map