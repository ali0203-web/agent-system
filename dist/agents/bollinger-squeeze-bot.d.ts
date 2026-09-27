import { BaseAgent, AgentConfig } from '../base-agent';
export declare class BollingerSqueezeBot extends BaseAgent {
    config: AgentConfig;
    private symbols;
    private priceHistory;
    execute(): Promise<any>;
    private fetchPrices;
    private detectSqueeze;
    private calculateBollingerBands;
    validate(): Promise<boolean>;
    healthCheck(): Promise<boolean>;
}
//# sourceMappingURL=bollinger-squeeze-bot.d.ts.map