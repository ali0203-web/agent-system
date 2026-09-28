/**
 * Agent #11: Arbitrage Bot
 * Detects and exploits price differences across trading pairs
 * Buys undervalued, sells overvalued for risk-free profit
 */
import { BaseAgent, AgentConfig } from '../base-agent';
interface ArbitrageOpportunity {
    symbol1: string;
    symbol2: string;
    symbol1Price: number;
    symbol2Price: number;
    priceDifference: number;
    profitPercent: number;
    confidence: number;
    timestamp: Date;
}
declare class ArbitrageBot extends BaseAgent {
    config: AgentConfig;
    private opportunities;
    private executedTrades;
    private priceHistory;
    execute(): Promise<void>;
    private fetchPrices;
    private findArbitrageOpportunities;
    private executeArbitrage;
    getOpportunities(): ArbitrageOpportunity[];
    getTradeStats(): {
        totalTrades: number;
        totalProfit: any;
        avgProfit: number;
    };
}
export declare const arbitrageBot: ArbitrageBot;
export {};
//# sourceMappingURL=arbitrage-bot.d.ts.map