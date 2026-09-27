import { BaseAgent, AgentConfig } from '../base-agent';
export declare class FibonacciBot extends BaseAgent {
    config: AgentConfig;
    private symbols;
    private priceHistory;
    execute(): Promise<any>;
    private fetchPrices;
    private analyzeFibonacci;
    validate(): Promise<boolean>;
    healthCheck(): Promise<boolean>;
}
//# sourceMappingURL=fibonacci-bot.d.ts.map