import { BaseAgent, AgentConfig } from '../base-agent';
export declare class CorrelationMatrixBot extends BaseAgent {
    config: AgentConfig;
    private symbols;
    private priceHistory;
    execute(): Promise<any>;
    private fetchPrices;
    private analyzeCorrelations;
    private calculateCorrelation;
    validate(): Promise<boolean>;
    healthCheck(): Promise<boolean>;
}
//# sourceMappingURL=correlation-matrix-bot.d.ts.map