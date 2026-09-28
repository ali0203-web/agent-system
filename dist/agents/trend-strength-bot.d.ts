import { BaseAgent, AgentConfig } from '../base-agent';
export declare class TrendStrengthBot extends BaseAgent {
    config: AgentConfig;
    private symbols;
    private priceHistory;
    execute(): Promise<any>;
    private fetchPrices;
    private measureTrend;
    private calculateADX;
    private getDirection;
    validate(): Promise<boolean>;
    healthCheck(): Promise<boolean>;
}
//# sourceMappingURL=trend-strength-bot.d.ts.map