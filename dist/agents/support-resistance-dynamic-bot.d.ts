import { BaseAgent, AgentConfig } from '../base-agent';
export declare class SupportResistanceDynamicBot extends BaseAgent {
    config: AgentConfig;
    private symbols;
    private priceHistory;
    execute(): Promise<any>;
    private fetchPrices;
    private detectLevels;
    validate(): Promise<boolean>;
    healthCheck(): Promise<boolean>;
}
//# sourceMappingURL=support-resistance-dynamic-bot.d.ts.map