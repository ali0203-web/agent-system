import { BaseAgent, AgentConfig } from '../base-agent';
export declare class BollingerBandsBot extends BaseAgent {
    config: AgentConfig;
    private symbols;
    private period;
    private stdDev;
    private priceHistory;
    private bandHistory;
    execute(): Promise<any>;
    private fetchPrices;
    private analyzeSignals;
    private calculateBands;
    private detectSignal;
    validate(): Promise<boolean>;
    healthCheck(): Promise<boolean>;
}
//# sourceMappingURL=bollinger-bands-bot.d.ts.map