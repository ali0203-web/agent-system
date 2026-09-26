/**
 * Agent #6: Technical Analysis
 * Performs technical analysis on cryptocurrency price movements
 */
import { BaseAgent, AgentConfig } from '../base-agent';
interface TechnicalIndicators {
    asset: string;
    symbol: string;
    currentPrice: number;
    ma20: number;
    ma50: number;
    rsi: number;
    macd: number;
    signal: 'buy' | 'sell' | 'neutral';
    strength: 'strong' | 'moderate' | 'weak';
    confidence: number;
    timestamp: Date;
    priceHistory: number[];
}
declare class TechnicalAnalysis extends BaseAgent {
    config: AgentConfig;
    private indicators;
    private priceHistory;
    private assets;
    execute(): Promise<void>;
    private fetchPrices;
    private calculateMA;
    private calculateRSI;
    private calculateMACD;
    private calculateEMA;
    private generateSignal;
    private getSymbol;
    getIndicators(): TechnicalIndicators[];
    getIndicatorsBySignal(signal: 'buy' | 'sell'): TechnicalIndicators[];
    getAssetAnalysis(asset: string): TechnicalIndicators | undefined;
}
export declare const technicalAnalysis: TechnicalAnalysis;
export {};
//# sourceMappingURL=technical-analysis.d.ts.map