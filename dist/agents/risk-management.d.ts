/**
 * Agent #7: Risk Management
 * Optimizes portfolio risk through dynamic position sizing and stop-loss levels
 */
import { BaseAgent, AgentConfig } from '../base-agent';
interface Position {
    asset: string;
    symbol: string;
    quantity: number;
    entryPrice: number;
    currentPrice: number;
    unrealizedGain: number;
    percentageOfPortfolio: number;
    volatility: number;
    riskLevel: 'low' | 'medium' | 'high' | 'critical';
}
interface RiskMetrics {
    totalPortfolioValue: number;
    portfolioVolatility: number;
    maxDrawdown: number;
    sharpeRatio: number;
    var95: number;
    positions: Position[];
    recommendations: RiskRecommendation[];
    timestamp: Date;
}
interface RiskRecommendation {
    symbol: string;
    action: 'reduce' | 'hold' | 'increase';
    reason: string;
    suggestedSize: number;
    stopLoss: number;
    takeProfit: number;
    riskRewardRatio: number;
    confidence: number;
}
declare class RiskManagement extends BaseAgent {
    config: AgentConfig;
    private positions;
    private priceHistory;
    private maxHistoryLength;
    private maxPortfolioRisk;
    private targetSharpeRatio;
    execute(): Promise<void>;
    private analyzePortfolio;
    private calculateMetrics;
    private calculateVolatility;
    private calculateMaxDrawdown;
    private calculateReturns;
    private generateRecommendations;
    private fetchCurrentPrices;
    getRiskMetrics(): RiskMetrics;
    addPosition(asset: string, symbol: string, quantity: number, entryPrice: number): void;
    removePosition(symbol: string): void;
    getPositions(): Position[];
    getRecommendations(): RiskRecommendation[];
    getPositionBySymbol(symbol: string): Position | undefined;
}
export declare const riskManagement: RiskManagement;
export {};
//# sourceMappingURL=risk-management.d.ts.map