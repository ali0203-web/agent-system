export interface Trade {
    id: string;
    agentId: string;
    agentName: string;
    symbol: string;
    entryPrice: number;
    exitPrice?: number;
    positionSize: number;
    profitLoss?: number;
    profitLossPercent?: number;
    status: 'open' | 'closed' | 'cancelled';
    entryTime: Date;
    exitTime?: Date;
    durationMinutes?: number;
    signalId?: string;
}
export interface TradeMetrics {
    totalTrades: number;
    closedTrades: number;
    openTrades: number;
    totalProfit: number;
    totalLoss: number;
    netPnL: number;
    winRate: number;
    avgWin: number;
    avgLoss: number;
    profitFactor: number;
    sharpeRatio?: number;
}
//# sourceMappingURL=trade.d.ts.map