import { BaseAgent, AgentConfig } from '../base-agent';
export declare class VWAPBounceBot extends BaseAgent {
    config: AgentConfig;
    private symbols;
    private priceHistory;
    private volumeHistory;
    execute(): Promise<any>;
    private fetchPrices;
    private detectBounces;
    private calculateVWAP;
    validate(): Promise<boolean>;
    healthCheck(): Promise<boolean>;
}
//# sourceMappingURL=vwap-bounce-bot.d.ts.map