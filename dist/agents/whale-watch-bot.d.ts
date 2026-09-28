import { BaseAgent, AgentConfig } from '../base-agent';
export declare class WhaleWatchBot extends BaseAgent {
    config: AgentConfig;
    private symbols;
    private volumeHistory;
    execute(): Promise<any>;
    private fetchPrices;
    private detectWhales;
    validate(): Promise<boolean>;
    healthCheck(): Promise<boolean>;
}
//# sourceMappingURL=whale-watch-bot.d.ts.map