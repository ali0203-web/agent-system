/**
 * Agent #5: News Monitor
 * Monitors cryptocurrency news sources for price-moving events and trading signals
 */
import { BaseAgent, AgentConfig } from '../base-agent';
interface NewsItem {
    id: string;
    title: string;
    source: string;
    url: string;
    sentiment: 'positive' | 'negative' | 'neutral';
    impact: 'low' | 'medium' | 'high' | 'critical';
    relevantAssets: string[];
    timestamp: Date;
    summary: string;
}
declare class NewsMonitor extends BaseAgent {
    config: AgentConfig;
    private newsHistory;
    private keywordsPositive;
    private keywordsNegative;
    execute(): Promise<void>;
    private fetchNews;
    private analyzeSentiment;
    private calculateImpact;
    private detectAssets;
    getNewsHistory(): NewsItem[];
    getNewsByAsset(asset: string): NewsItem[];
    getHighImpactNews(): NewsItem[];
}
export declare const newsMonitor: NewsMonitor;
export {};
//# sourceMappingURL=news-monitor.d.ts.map