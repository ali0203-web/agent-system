/**
 * Agent #4: DCA Bot (Dollar-Cost Averaging)
 * Automates periodic cryptocurrency purchases at regular intervals
 * to reduce market volatility impact through dollar-cost averaging
 */
import { BaseAgent, AgentConfig } from '../base-agent';
interface DCAPosition {
    asset: string;
    symbol: string;
    investmentPerPeriod: number;
    totalInvested: number;
    totalUnits: number;
    averageCostPerUnit: number;
    currentPrice: number;
    currentValue: number;
    gainLoss: number;
    gainLossPercent: number;
    lastPurchaseDate: Date;
    nextScheduledPurchase: Date;
}
declare class DCABot extends BaseAgent {
    config: AgentConfig;
    private positions;
    execute(): Promise<void>;
    private fetchCurrentPrices;
    private getPortfolioSummary;
    getPositions(): DCAPosition[];
    addPosition(asset: string, symbol: string, investmentPerPeriod: number): void;
    removePosition(symbol: string): void;
    updateInvestmentAmount(symbol: string, newAmount: number): void;
}
export declare const dcaBot: DCABot;
export {};
//# sourceMappingURL=dca-bot.d.ts.map