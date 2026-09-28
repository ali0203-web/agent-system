import { BaseAgent, AgentConfig } from '../base-agent';
export declare class MeanReversionOscillatorBot extends BaseAgent {
    config: AgentConfig;
    private symbols;
    private priceHistory;
    execute(): Promise<any>;
    private fetchPrices;
    private calculateOscillator;
    validate(): Promise<boolean>;
    healthCheck(): Promise<boolean>;
}
//# sourceMappingURL=mean-reversion-oscillator-bot.d.ts.map