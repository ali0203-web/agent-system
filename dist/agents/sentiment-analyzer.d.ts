import { BaseAgent, AgentConfig } from '../base-agent';
export declare class SentimentAnalyzer extends BaseAgent {
    config: AgentConfig;
    private symbols;
    private sentimentHistory;
    private bullishKeywords;
    private bearishKeywords;
    execute(): Promise<any>;
    private analyzeSentiment;
    private generateSentimentData;
    private simulateSentiment;
    private calculateSentimentScore;
    private extractKeywords;
    private calculateAggregateSentiment;
    validate(): Promise<boolean>;
    healthCheck(): Promise<boolean>;
}
//# sourceMappingURL=sentiment-analyzer.d.ts.map