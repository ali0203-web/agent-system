import { BaseAgent, AgentConfig } from '../base-agent';
export declare class MarketRegimeBot extends BaseAgent {
    config: AgentConfig;
    private symbols;
    private priceHistory;
    execute(): Promise<any>;
    private fetchPrices;
    private analyzeRegimes;
    private detectRegime;
    private detectTrend;
    private calculateConfidence;
    validate(): Promise<boolean>;
    healthCheck(): Promise<boolean>;
}
//# sourceMappingURL=market-regime-bot.d.ts.map