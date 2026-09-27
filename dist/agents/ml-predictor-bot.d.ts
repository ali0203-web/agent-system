import { BaseAgent, AgentConfig } from '../base-agent';
export declare class MLPredictorBot extends BaseAgent {
    config: AgentConfig;
    private symbols;
    private priceHistory;
    private volatilityHistory;
    private momentumHistory;
    execute(): Promise<any>;
    private fetchPrices;
    private predictPrices;
    private calculateVolatility;
    private calculateMomentum;
    private calculateRSI;
    private calculateTrend;
    private calculateMeanReversion;
    private predictDirection;
    validate(): Promise<boolean>;
    healthCheck(): Promise<boolean>;
}
//# sourceMappingURL=ml-predictor-bot.d.ts.map