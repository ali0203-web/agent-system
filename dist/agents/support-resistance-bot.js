"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.supportResistanceBot = void 0;
const base_agent_1 = require("../base-agent");
const binance_api_1 = require("../services/binance-api");
class SupportResistanceBot extends base_agent_1.BaseAgent {
    constructor() {
        super(...arguments);
        this.config = {
            name: 'support-resistance-bot',
            category: 'trading',
            version: '1.0.0',
            description: 'Support/Resistance Bot - Trades key technical levels',
            schedule: '*/15 * * * *',
        };
        this.levels = new Map();
    }
    async execute() {
        this.logger.info('📊 Support/Resistance Bot: Analyzing technical levels...');
        try {
            const prices = await this.fetchPrices();
            for (const [symbol, price] of Object.entries(prices)) {
                const level = this.calculateLevels(symbol, price);
                this.levels.set(symbol, level);
                if (price <= level.support) {
                    this.logger.info(`📍 SUPPORT BOUNCE ${symbol}: Buy @ $${price.toFixed(2)}`);
                    this.emit('support-level', { symbol, price, level: level.support, timestamp: new Date() });
                }
                if (price >= level.resistance) {
                    this.logger.info(`📍 RESISTANCE BREAK ${symbol}: Sell @ $${price.toFixed(2)}`);
                    this.emit('resistance-level', { symbol, price, level: level.resistance, timestamp: new Date() });
                }
            }
        }
        catch (error) {
            this.logger.error(`❌ Support/Resistance failed: ${error?.message}`);
        }
    }
    calculateLevels(symbol, price) {
        return { support: price * 0.95, resistance: price * 1.05 };
    }
    async fetchPrices() {
        const binance = (0, binance_api_1.getBinanceAPI)();
        const prices = await binance.getPrices(['BTCUSDT', 'ETHUSDT', 'SOLUSDT']);
        return {
            BTC: prices?.BTCUSDT || 0,
            ETH: prices?.ETHUSDT || 0,
            SOL: prices?.SOLUSDT || 0,
        };
    }
}
exports.supportResistanceBot = new SupportResistanceBot();
//# sourceMappingURL=support-resistance-bot.js.map