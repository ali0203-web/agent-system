"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.volatilityTrader = void 0;
const base_agent_1 = require("../base-agent");
class VolatilityTrader extends base_agent_1.BaseAgent {
    constructor() {
        super(...arguments);
        this.config = {
            name: 'volatility-trader',
            category: 'trading',
            version: '1.0.0',
            description: 'Volatility Trader - Profits from price swings',
            schedule: '*/8 * * * *',
        };
        this.priceHistory = new Map();
    }
    async execute() {
        this.logger.info('📈 Volatility Trader: Analyzing price swings...');
        try {
            const prices = await this.fetchPrices();
            for (const [symbol, price] of Object.entries(prices)) {
                const history = this.priceHistory.get(symbol) || [];
                history.push(price);
                if (history.length > 10)
                    history.shift();
                this.priceHistory.set(symbol, history);
                if (history.length > 3) {
                    const volatility = Math.abs(history[history.length - 1] - history[0]) / history[0];
                    if (volatility > 0.02) {
                        this.logger.info(`💥 VOLATILITY ${symbol}: ${(volatility * 100).toFixed(2)}%`);
                        this.emit('volatility-spike', { symbol, volatility, price, timestamp: new Date() });
                    }
                }
            }
        }
        catch (error) {
            this.logger.error(`❌ Volatility failed: ${error?.message}`);
        }
    }
    async fetchPrices() {
        const response = await this.get('https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum,cardano&vs_currencies=usd');
        return { BTC: response.bitcoin?.usd || 0, ETH: response.ethereum?.usd || 0, ADA: response.cardano?.usd || 0 };
    }
}
exports.volatilityTrader = new VolatilityTrader();
//# sourceMappingURL=volatility-trader.js.map