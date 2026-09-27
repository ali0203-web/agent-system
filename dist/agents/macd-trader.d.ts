import { BaseAgent, AgentConfig } from '../base-agent';
export declare class MACDTrader extends BaseAgent {
    config: AgentConfig;
    private symbols;
    private fast;
    private slow;
    private signal;
    private priceHistory;
    private macdHistory;
    execute(): Promise<any>;
    private fetchPrices;
    private analyzeMACD;
    private calculateEMA;
    private calculateMACD;
    private detectSignal;
    validate(): Promise<boolean>;
    healthCheck(): Promise<boolean>;
}
//# sourceMappingURL=macd-trader.d.ts.map