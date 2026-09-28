import { BaseAgent, AgentConfig } from '../base-agent';
export declare class IchimokuBot extends BaseAgent {
    config: AgentConfig;
    private symbols;
    private priceHistory;
    execute(): Promise<any>;
    private fetchPrices;
    private analyzeIchimoku;
    private calculateConversionLine;
    private calculateBaseLine;
    private calculateLeadingSpanB;
    private getSignal;
    validate(): Promise<boolean>;
    healthCheck(): Promise<boolean>;
}
//# sourceMappingURL=ichimoku-bot.d.ts.map