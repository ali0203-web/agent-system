import { BaseAgent, AgentConfig } from '../base-agent';
export declare class OrderFlowBot extends BaseAgent {
    config: AgentConfig;
    private symbols;
    private priceHistory;
    private volumeHistory;
    execute(): Promise<any>;
    private fetchPrices;
    private analyzeOrderFlow;
    private calculateVWAP;
    private calculateBuyPressure;
    validate(): Promise<boolean>;
    healthCheck(): Promise<boolean>;
}
//# sourceMappingURL=order-flow-bot.d.ts.map