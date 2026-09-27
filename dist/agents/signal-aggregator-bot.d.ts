import { BaseAgent, AgentConfig } from '../base-agent';
export declare class SignalAggregatorBot extends BaseAgent {
    config: AgentConfig;
    private symbols;
    private signalCache;
    execute(): Promise<any>;
    private fetchPrices;
    private aggregateSignals;
    validate(): Promise<boolean>;
    healthCheck(): Promise<boolean>;
}
//# sourceMappingURL=signal-aggregator-bot.d.ts.map