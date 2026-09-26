/**
 * Agent #10: Mean Reversion Bot
 * Identifies price deviations from moving averages and trades reversions
 * Buys when price drops below MA, sells when it reverts to average
 */
import { BaseAgent, AgentConfig } from '../base-agent';
interface ReversionPosition {
    symbol: string;
    entryPrice: number;
    meanPrice: number;
    expectedReversion: number;
    entryTime: Date;
    zScoreAtEntry: number;
    isActive: boolean;
    unrealizedGain: number;
    trades: {
        entryPrice: number;
        exitPrice?: number;
        profit?: number;
        profitPercent?: number;
        revertedTo?: number;
    }[];
}
declare class MeanReversionBot extends BaseAgent {
    config: AgentConfig;
    private positions;
    private priceHistory;
    private maxHistoryLength;
    execute(): Promise<void>;
    private calculateReversionSignals;
    private calculateMA;
    private calculateStdDev;
    private getReversionStatus;
    private calculateConfidence;
    private checkExitSignals;
    private enterPosition;
    private fetchCurrentPrices;
    getPositions(): ReversionPosition[];
    getPositionBySymbol(symbol: string): ReversionPosition | undefined;
    getReversionStats(): {
        totalTrades: number;
        successfulReverts: number;
        failedReverts: number;
        totalProfit: number;
        reversionRate: number;
        avgProfitPercent: number;
    };
}
export declare const meanReversionBot: MeanReversionBot;
export {};
//# sourceMappingURL=mean-reversion-bot.d.ts.map