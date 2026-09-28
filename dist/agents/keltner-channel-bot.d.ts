import { BaseAgent, AgentConfig } from '../base-agent';
export declare class KeltnerChannelBot extends BaseAgent {
    config: AgentConfig;
    private symbols;
    private priceHistory;
    execute(): Promise<any>;
    private fetchPrices;
    private analyzeChannels;
    private calculateEMA;
    private calculateATR;
    validate(): Promise<boolean>;
    healthCheck(): Promise<boolean>;
}
//# sourceMappingURL=keltner-channel-bot.d.ts.map