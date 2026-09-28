import { BaseAgent, AgentConfig } from '../base-agent';
export declare class RSIBot extends BaseAgent {
    config: AgentConfig;
    private symbols;
    private period;
    private oversold;
    private overbought;
    private priceHistory;
    private rsiHistory;
    execute(): Promise<any>;
    private fetchPrices;
    private analyzeRSI;
    private calculateRSI;
    private detectSignal;
    validate(): Promise<boolean>;
    healthCheck(): Promise<boolean>;
}
//# sourceMappingURL=rsi-bot.d.ts.map