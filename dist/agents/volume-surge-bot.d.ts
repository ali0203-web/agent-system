import { BaseAgent, AgentConfig } from '../base-agent';
export declare class VolumeSurgeBot extends BaseAgent {
    config: AgentConfig;
    private symbols;
    private volumeHistory;
    private priceHistory;
    execute(): Promise<any>;
    private fetchPrices;
    private detectSurges;
    private calculateOBV;
    validate(): Promise<boolean>;
    healthCheck(): Promise<boolean>;
}
//# sourceMappingURL=volume-surge-bot.d.ts.map