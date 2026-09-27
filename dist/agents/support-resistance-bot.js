"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.supportResistanceBot = void 0;
const base_agent_1 = require("../base-agent");
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
        const response = await this.get('https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum,solana&vs_currencies=usd');
        return { BTC: response.bitcoin?.usd || 0, ETH: response.ethereum?.usd || 0, SOL: response.solana?.usd || 0 };
    }
}
exports.supportResistanceBot = new SupportResistanceBot();
//# sourceMappingURL=support-resistance-bot.js.map