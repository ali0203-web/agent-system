import { BaseAgent, AgentConfig } from '../base-agent';
export declare class PatternRecognitionBot extends BaseAgent {
    config: AgentConfig;
    private symbols;
    private priceHistory;
    execute(): Promise<any>;
    private fetchPrices;
    private analyzePatterns;
    private detectPatterns;
    validate(): Promise<boolean>;
    healthCheck(): Promise<boolean>;
}
//# sourceMappingURL=pattern-recognition-bot.d.ts.map