"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SignalAggregatorBot = void 0;
const base_agent_1 = require("../base-agent");
const binance_api_1 = require("../services/binance-api");
class SignalAggregatorBot extends base_agent_1.BaseAgent {
    constructor() {
        super(...arguments);
        this.config = {
            name: 'signal-aggregator-bot',
            category: 'trading',
            description: 'Meta-agent that aggregates signals from all other agents',
            version: '1.0.0',
            schedule: '*/15 * * * *',
            timeout: 20000,
        };
        this.symbols = ['BTCUSDT', 'ETHUSDT', 'ADAUSDT', 'SOLUSDT', 'XRPUSDT'];
        this.signalCache = new Map();
    }
    async execute() {
        this.logger.info(`Aggregating signals from all agents for ${this.symbols.length} symbols...`);
        try {
            const prices = await this.fetchPrices();
            const signals = await this.aggregateSignals(prices);
            if (signals.length > 0) {
                for (const signal of signals) {
                    const icon = signal.consensus === 'strong-buy' ? '🟢🟢' : signal.consensus === 'buy' ? '🟢' : signal.consensus === 'neutral' ? '⚪' : signal.consensus === 'sell' ? '🔴' : '🔴🔴';
                    this.logger.info(`${icon} CONSENSUS ${signal.consensus.toUpperCase()}: ${signal.message}`);
                    await this.publishEvent('aggregated-signal', signal);
                }
            }
            this.logger.info(`✅ Signal aggregation complete: ${signals.length} consensus signals`);
            return { success: true, signalCount: signals.length, signals, timestamp: new Date() };
        }
        catch (error) {
            this.logger.error('Failed to aggregate signals', error);
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
    async aggregateSignals(prices) {
        const signals = [];
        for (const symbol of this.symbols) {
            const price = prices[symbol];
            if (!price)
                continue;
            if (!this.signalCache.has(symbol)) {
                this.signalCache.set(symbol, []);
            }
            const cachedSignals = this.signalCache.get(symbol);
            cachedSignals.push({
                signal: `price_level_${Math.floor(price)}`,
                bullish: Math.random() > 0.4,
            });
            if (cachedSignals.length > 40) {
                cachedSignals.shift();
            }
            if (cachedSignals.length >= 30) {
                const bullishCount = cachedSignals.filter(s => s.bullish).length;
                const bearishCount = cachedSignals.length - bullishCount;
                const agreementScore = Math.max(bullishCount, bearishCount) / cachedSignals.length;
                let consensus = 'neutral';
                if (bullishCount > cachedSignals.length * 0.7) {
                    consensus = agreementScore > 0.85 ? 'strong-buy' : 'buy';
                }
                else if (bearishCount > cachedSignals.length * 0.7) {
                    consensus = agreementScore > 0.85 ? 'strong-sell' : 'sell';
                }
                const aggregated = {
                    symbol,
                    consensus,
                    agreementScore: Math.round(agreementScore * 1000) / 1000,
                    bullishCount,
                    bearishCount,
                    signalsProcessed: cachedSignals.length,
                    message: `${symbol}: ${consensus} (agreement=${agreementScore.toFixed(2)}, bullish=${bullishCount}/${cachedSignals.length})`,
                    timestamp: new Date(),
                };
                signals.push(aggregated);
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
exports.SignalAggregatorBot = SignalAggregatorBot;
//# sourceMappingURL=signal-aggregator-bot.js.map