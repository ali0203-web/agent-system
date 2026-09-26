/**
 * Agent #9: Momentum Trader
 * Identifies and trades rapid price movements using momentum indicators
 * Enters positions when momentum accelerates, exits on reversal signals
 */
import { BaseAgent, AgentConfig } from '../base-agent';
interface MomentumPosition {
    symbol: string;
    entryPrice: number;
    entryTime: Date;
    momentumAtEntry: number;
    targetProfit: number;
    stopLoss: number;
    trailingStop: number;
    isActive: boolean;
    unrealizedGain: number;
    trades: {
        entryPrice: number;
        exitPrice?: number;
        profit?: number;
        profitPercent?: number;
        duration: number;
    }[];
}
declare class MomentumTrader extends BaseAgent {
    config: AgentConfig;
    private positions;
    private priceHistory;
    private momentumHistory;
    private maxHistoryLength;
    execute(): Promise<void>;
    private calculateMomentumSignals;
    private calculateMomentum;
    private getSignalStrength;
    private calculateConfidence;
    private checkExitSignals;
    private enterPosition;
    private fetchCurrentPrices;
    getPositions(): MomentumPosition[];
    getPositionBySymbol(symbol: string): MomentumPosition | undefined;
    getTradeStats(): {
        totalTrades: number;
        winningTrades: number;
        losingTrades: number;
        totalProfit: number;
        winRate: number;
        avgProfitPercent: number;
    };
}
export declare const momentumTrader: MomentumTrader;
export {};
//# sourceMappingURL=momentum-trader.d.ts.map