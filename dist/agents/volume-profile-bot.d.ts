import { BaseAgent, AgentConfig } from '../base-agent';
export declare class VolumeProfileBot extends BaseAgent {
    config: AgentConfig;
    private symbols;
    private priceHistory;
    private volumeHistory;
    private volumeProfile;
    execute(): Promise<any>;
    private fetchPrices;
    private analyzeVolumeProfile;
    private buildVolumeProfile;
    private detectSignal;
    validate(): Promise<boolean>;
    healthCheck(): Promise<boolean>;
}
//# sourceMappingURL=volume-profile-bot.d.ts.map