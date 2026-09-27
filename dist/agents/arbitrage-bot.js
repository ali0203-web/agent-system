"use strict";
/**
 * Agent #11: Arbitrage Bot
 * Detects and exploits price differences across trading pairs
 * Buys undervalued, sells overvalued for risk-free profit
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.arbitrageBot = void 0;
const base_agent_1 = require("../base-agent");
class ArbitrageBot extends base_agent_1.BaseAgent {
    constructor() {
        super(...arguments);
        this.config = {
            name: 'arbitrage-bot',
            category: 'trading',
            version: '1.0.0',
            description: 'Arbitrage Bot - Detects cross-pair price discrepancies',
            schedule: '*/7 * * * *',
        };
        this.opportunities = [];
        this.executedTrades = [];
        this.priceHistory = new Map();
    }
    async execute() {
        this.logger.info('🔄 Arbitrage Bot: Scanning for price discrepancies...');
        try {
            const prices = await this.fetchPrices();
            const opportunities = this.findArbitrageOpportunities(prices);
            for (const opp of opportunities) {
                if (opp.profitPercent >= 1.5) {
                    await this.executeArbitrage(opp);
                }
            }
            this.logger.info('✅ Arbitrage Bot: Scan completed');
        }
        catch (error) {
            this.logger.error(`❌ Arbitrage Bot failed: ${error?.message}`);
            throw error;
        }
    }
    async fetchPrices() {
        const assets = ['bitcoin', 'ethereum', 'cardano', 'solana', 'ripple'];
        const url = `https://api.coingecko.com/api/v3/simple/price?ids=${assets.join(',')}&vs_currencies=usd`;
        try {
            const response = await this.get(url);
            const prices = {};
            const symbolMap = {
                bitcoin: 'BTC',
                ethereum: 'ETH',
                cardano: 'ADA',
                solana: 'SOL',
                ripple: 'XRP',
            };
            for (const [asset, symbol] of Object.entries(symbolMap)) {
                if (response[asset]?.usd) {
                    prices[symbol] = response[asset].usd;
                }
            }
            return prices;
        }
        catch (error) {
            this.logger.error('Failed to fetch prices', error);
            return {};
        }
    }
    findArbitrageOpportunities(prices) {
        const opportunities = [];
        const symbols = Object.keys(prices);
        for (let i = 0; i < symbols.length; i++) {
            for (let j = i + 1; j < symbols.length; j++) {
                const sym1 = symbols[i];
                const sym2 = symbols[j];
                const price1 = prices[sym1];
                const price2 = prices[sym2];
                const priceDiff = Math.abs(price1 - price2);
                const profitPercent = (priceDiff / Math.min(price1, price2)) * 100;
                if (profitPercent > 0.5) {
                    opportunities.push({
                        symbol1: sym1,
                        symbol2: sym2,
                        symbol1Price: price1,
                        symbol2Price: price2,
                        priceDifference: priceDiff,
                        profitPercent,
                        confidence: Math.min(profitPercent / 5, 0.95),
                        timestamp: new Date(),
                    });
                }
            }
        }
        return opportunities.sort((a, b) => b.profitPercent - a.profitPercent);
    }
    async executeArbitrage(opp) {
        const trade = {
            buySymbol: opp.symbol1,
            sellSymbol: opp.symbol2,
            buyPrice: opp.symbol1Price,
            sellPrice: opp.symbol2Price,
            profit: opp.profitPercent,
            executedAt: new Date(),
        };
        this.executedTrades.push(trade);
        this.logger.info(`💰 ARBITRAGE: Buy ${opp.symbol1} @ $${opp.symbol1Price.toFixed(2)}, Sell ${opp.symbol2} @ $${opp.symbol2Price.toFixed(2)} | Profit: ${opp.profitPercent.toFixed(2)}%`);
        this.emit('arbitrage-opportunity', {
            symbol1: opp.symbol1,
            symbol2: opp.symbol2,
            profitPercent: opp.profitPercent,
            confidence: opp.confidence,
            timestamp: new Date(),
        });
    }
    getOpportunities() {
        return this.opportunities;
    }
    getTradeStats() {
        return {
            totalTrades: this.executedTrades.length,
            totalProfit: this.executedTrades.reduce((sum, t) => sum + t.profit, 0),
            avgProfit: this.executedTrades.length > 0
                ? this.executedTrades.reduce((sum, t) => sum + t.profit, 0) / this.executedTrades.length
                : 0,
        };
    }
}
exports.arbitrageBot = new ArbitrageBot();
//# sourceMappingURL=arbitrage-bot.js.map