import { BaseAgent, AgentConfig } from '../base-agent';
export declare class MovingAverageBot extends BaseAgent {
    config: AgentConfig;
    private symbols;
    private priceHistory;
    execute(): Promise<any>;
    private fetchPrices;
    private analyzeMA;
    private calculateSMA;
    validate(): Promise<boolean>;
    healthCheck(): Promise<boolean>;
}
//# sourceMappingURL=moving-average-bot.d.ts.map