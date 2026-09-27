import { BaseAgent, AgentConfig } from '../base-agent';
declare class CorrelationTrader extends BaseAgent {
    config: AgentConfig;
    private correlations;
    execute(): Promise<void>;
    fetchPrices(): Promise<Record<string, number>>;
}
export declare const correlationTrader: CorrelationTrader;
export {};
//# sourceMappingURL=correlation-trader.d.ts.map