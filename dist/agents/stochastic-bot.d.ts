import { BaseAgent, AgentConfig } from '../base-agent';
export declare class StochasticBot extends BaseAgent {
    config: AgentConfig;
    private symbols;
    private priceHistory;
    private kHistory;
    private dHistory;
    execute(): Promise<any>;
    private fetchPrices;
    private analyzeStochastic;
    private detectCrossover;
    validate(): Promise<boolean>;
    healthCheck(): Promise<boolean>;
}
//# sourceMappingURL=stochastic-bot.d.ts.map