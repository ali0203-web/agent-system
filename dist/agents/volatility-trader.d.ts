import { BaseAgent, AgentConfig } from '../base-agent';
declare class VolatilityTrader extends BaseAgent {
    config: AgentConfig;
    private priceHistory;
    execute(): Promise<void>;
    fetchPrices(): Promise<Record<string, number>>;
}
export declare const volatilityTrader: VolatilityTrader;
export {};
//# sourceMappingURL=volatility-trader.d.ts.map