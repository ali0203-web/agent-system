import { BaseAgent, AgentConfig } from '../base-agent';
export declare class PositionSizerBot extends BaseAgent {
    config: AgentConfig;
    private symbols;
    private priceHistory;
    private accountBalance;
    execute(): Promise<any>;
    private fetchPrices;
    private calculatePositions;
    private calculateVolatility;
    validate(): Promise<boolean>;
    healthCheck(): Promise<boolean>;
}
//# sourceMappingURL=position-sizer-bot.d.ts.map