"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RSIBot = void 0;
const base_agent_1 = require("../base-agent");
const binance_api_1 = require("../services/binance-api");
class RSIBot extends base_agent_1.BaseAgent {
    constructor() {
        super(...arguments);
        this.config = {
            name: 'rsi-bot',
            category: 'trading',
            description: 'Trade using RSI (Relative Strength Index) oversold/overbought signals',
            version: '1.0.0',
            schedule: '*/5 * * * *', // Every 5 minutes
            timeout: 15000,
        };
        this.symbols = ['BTCUSDT', 'ETHUSDT', 'ADAUSDT', 'SOLUSDT', 'XRPUSDT'];
        this.period = 14;
        this.oversold = 30;
        this.overbought = 70;
        this.priceHistory = new Map();
        this.rsiHistory = new Map();
    }
    async execute() {
        this.logger.info(`Scanning ${this.symbols.length} pairs for RSI signals...`);
        try {
            // Fetch current prices
            const prices = await this.fetchPrices();
            // Calculate RSI and detect signals
            const signals = await this.analyzeRSI(prices);
            // Publish signals
            if (signals.length > 0) {
                for (const signal of signals) {
                    this.logger.warn(`📊 ${signal.type.toUpperCase()}: ${signal.message}`);
                    await this.publishEvent('rsi-signal', signal);
                }
            }
            this.logger.info(`✅ RSI analysis complete: Found ${signals.length} signals`);
            return {
                success: true,
                signalCount: signals.length,
                signals,
                timestamp: new Date(),
            };
        }
        catch (error) {
            this.logger.error('Failed to analyze RSI', error);
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
    async analyzeRSI(prices) {
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
            // Keep last 30 prices
            if (history.length > 30) {
                history.shift();
            }
            // Need at least 14 prices for RSI
            if (history.length < this.period) {
                continue;
            }
            // Calculate RSI
            const rsi = this.calculateRSI(history);
            // Store RSI history
            if (!this.rsiHistory.has(symbol)) {
                this.rsiHistory.set(symbol, []);
            }
            const rsiHist = this.rsiHistory.get(symbol);
            rsiHist.push(rsi);
            if (rsiHist.length > 20) {
                rsiHist.shift();
            }
            // Detect signals
            const signal = this.detectSignal(symbol, rsi, rsiHist, history);
            if (signal) {
                signals.push(signal);
            }
        }
        return signals;
    }
    calculateRSI(prices) {
        const changes = [];
        for (let i = 1; i < prices.length; i++) {
            changes.push(prices[i] - prices[i - 1]);
        }
        // Get last 14 changes
        const recentChanges = changes.slice(-this.period);
        const gains = recentChanges.filter((c) => c > 0).reduce((a, b) => a + b, 0);
        const losses = Math.abs(recentChanges.filter((c) => c < 0).reduce((a, b) => a + b, 0));
        const avgGain = gains / this.period;
        const avgLoss = losses / this.period;
        if (avgLoss === 0)
            return 100;
        const rs = avgGain / avgLoss;
        const rsi = 100 - 100 / (1 + rs);
        return rsi;
    }
    detectSignal(symbol, rsi, rsiHistory, priceHistory) {
        // Oversold signal: RSI < 30
        if (rsi < this.oversold) {
            const strength = (this.oversold - rsi) / this.oversold;
            return {
                symbol,
                type: 'oversold',
                rsi,
                threshold: this.oversold,
                strength,
                message: `${symbol} RSI oversold (${rsi.toFixed(1)}) - potential bounce`,
                timestamp: new Date(),
            };
        }
        // Overbought signal: RSI > 70
        if (rsi > this.overbought) {
            const strength = (rsi - this.overbought) / (100 - this.overbought);
            return {
                symbol,
                type: 'overbought',
                rsi,
                threshold: this.overbought,
                strength,
                message: `${symbol} RSI overbought (${rsi.toFixed(1)}) - potential pullback`,
                timestamp: new Date(),
            };
        }
        // Divergence: RSI and price moving in opposite directions
        if (rsiHistory.length >= 3) {
            const prevRSI = rsiHistory[rsiHistory.length - 2];
            const prevPrice = priceHistory[priceHistory.length - 2];
            const currentPrice = priceHistory[priceHistory.length - 1];
            // Bullish divergence: price lower but RSI higher
            if (currentPrice < prevPrice && rsi > prevRSI && rsi < 50) {
                return {
                    symbol,
                    type: 'divergence',
                    rsi,
                    threshold: 50,
                    strength: (rsi - prevRSI) / 50,
                    message: `${symbol} bullish divergence - potential reversal`,
                    timestamp: new Date(),
                };
            }
            // Bearish divergence: price higher but RSI lower
            if (currentPrice > prevPrice && rsi < prevRSI && rsi > 50) {
                return {
                    symbol,
                    type: 'divergence',
                    rsi,
                    threshold: 50,
                    strength: (prevRSI - rsi) / 50,
                    message: `${symbol} bearish divergence - potential reversal`,
                    timestamp: new Date(),
                };
            }
        }
        return null;
    }
    async validate() {
        this.logger.info('Validating RSIBot...');
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
exports.RSIBot = RSIBot;
//# sourceMappingURL=rsi-bot.js.map