import { BaseAgent, AgentConfig } from '../base-agent';
export declare class ATRBot extends BaseAgent {
    config: AgentConfig;
    private symbols;
    private priceHistory;
    execute(): Promise<any>;
    private fetchPrices;
    private analyzeATR;
    private calculateATR;
    private getVolatilityLevel;
    validate(): Promise<boolean>;
    healthCheck(): Promise<boolean>;
}
//# sourceMappingURL=atr-bot.d.ts.map