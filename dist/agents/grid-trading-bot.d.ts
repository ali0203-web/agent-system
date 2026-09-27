/**
 * Agent #8: Grid Trading Bot
 * Places buy/sell orders at predetermined price levels (grid)
 * Profits from market volatility between grid levels
 */
import { BaseAgent, AgentConfig } from '../base-agent';
interface GridLevel {
    level: number;
    price: number;
    buyOrderId?: string;
    sellOrderId?: string;
    status: 'pending' | 'filled' | 'cancelled';
    buyFilledAt?: Date;
    soldAt?: Date;
    profit?: number;
    profitPercent?: number;
}
interface GridPosition {
    asset: string;
    symbol: string;
    gridLevels: number;
    bottomPrice: number;
    topPrice: number;
    investmentPerGrid: number;
    gridSize: number;
    totalInvestment: number;
    totalFilled: number;
    totalProfit: number;
    levels: GridLevel[];
    isActive: boolean;
    createdAt: Date;
}
declare class GridTradingBot extends BaseAgent {
    config: AgentConfig;
    private positions;
    private priceHistory;
    private maxHistoryLength;
    private initialized;
    execute(): Promise<void>;
    private checkGridLevels;
    private fetchCurrentPrices;
    addGridPosition(asset: string, symbol: string, gridLevels: number, bottomPrice: number, topPrice: number, investmentPerGrid: number): void;
    removeGridPosition(symbol: string): void;
    getPositions(): GridPosition[];
    getPositionBySymbol(symbol: string): GridPosition | undefined;
    getGridStats(symbol: string): {
        totalProfit: number;
        tradesCompleted: number;
        fillRate: number;
    } | null;
    private initializeDefaultPositions;
}
export declare const gridTradingBot: GridTradingBot;
export {};
//# sourceMappingURL=grid-trading-bot.d.ts.map