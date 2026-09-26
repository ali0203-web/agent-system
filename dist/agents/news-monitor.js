"use strict";
/**
 * Agent #5: News Monitor
 * Monitors cryptocurrency news sources for price-moving events and trading signals
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.newsMonitor = void 0;
const base_agent_1 = require("../base-agent");
class NewsMonitor extends base_agent_1.BaseAgent {
    constructor() {
        super(...arguments);
        this.config = {
            name: 'news-monitor',
            category: 'intelligence',
            version: '1.0.0',
            description: 'Cryptocurrency News Monitoring Agent',
            schedule: '*/30 * * * *', // Every 30 minutes
        };
        this.newsHistory = [];
        this.keywordsPositive = [
            'partnership',
            'approval',
            'launch',
            'upgrade',
            'bull',
            'surge',
            'rally',
            'breakthrough',
            'adoption',
        ];
        this.keywordsNegative = [
            'hack',
            'breach',
            'crash',
            'exploit',
            'ban',
            'regulation',
            'bear',
            'collapse',
            'concern',
        ];
    }
    async execute() {
        this.logger.info('📰 News Monitor: Starting news scan...');
        try {
            // Fetch news from multiple sources
            const newsItems = await this.fetchNews();
            if (newsItems.length === 0) {
                this.logger.warn('⚠️ No news items fetched');
                return;
            }
            // Process each news item
            for (const item of newsItems) {
                // Calculate sentiment
                item.sentiment = this.analyzeSentiment(item.title);
                // Calculate impact
                item.impact = this.calculateImpact(item.title, item.sentiment);
                // Detect relevant assets
                item.relevantAssets = this.detectAssets(item.title);
                // Add to history
                this.newsHistory.unshift(item);
                if (this.newsHistory.length > 100) {
                    this.newsHistory.pop();
                }
                // Emit alert if high impact
                if (item.impact === 'critical' || item.impact === 'high') {
                    this.logger.warn(`🚨 NEWS ALERT [${item.impact.toUpperCase()}]: ${item.title}`);
                    this.emit('news-alert', {
                        title: item.title,
                        source: item.source,
                        sentiment: item.sentiment,
                        impact: item.impact,
                        assets: item.relevantAssets,
                        url: item.url,
                        timestamp: item.timestamp,
                    });
                }
                this.logger.info(`📰 ${item.source}: ${item.title.substring(0, 60)}... [${item.sentiment}/${item.impact}]`);
            }
            // Emit portfolio impact if relevant
            if (newsItems.some((n) => n.relevantAssets.length > 0)) {
                this.emit('news-sentiment-shift', {
                    totalNewsItems: newsItems.length,
                    criticalCount: newsItems.filter((n) => n.impact === 'critical').length,
                    positiveSentiment: newsItems.filter((n) => n.sentiment === 'positive').length,
                    negativeSentiment: newsItems.filter((n) => n.sentiment === 'negative').length,
                    timestamp: new Date(),
                });
            }
            this.logger.info('✅ News Monitor: Scan completed');
        }
        catch (error) {
            const errorMsg = error?.message || 'Unknown error';
            this.logger.error(`❌ News Monitor failed: ${errorMsg}`);
            throw error;
        }
    }
    async fetchNews() {
        const newsItems = [];
        try {
            // Fetch from NewsAPI
            const newsApiUrl = 'https://newsapi.org/v2/everything?q=cryptocurrency&sortBy=publishedAt&language=en&pageSize=10';
            const response = await this.get(newsApiUrl);
            if (response.articles && Array.isArray(response.articles)) {
                for (const article of response.articles.slice(0, 5)) {
                    newsItems.push({
                        id: `news-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                        title: article.title || 'Untitled',
                        source: article.source?.name || 'Unknown',
                        url: article.url || '',
                        sentiment: 'neutral',
                        impact: 'low',
                        relevantAssets: [],
                        timestamp: new Date(article.publishedAt || Date.now()),
                        summary: article.description || article.title || '',
                    });
                }
            }
        }
        catch (error) {
            // API unavailable - that's OK, will use mock data
            const status = error?.response?.status || 'unknown';
            this.logger.info(`ℹ️ NewsAPI unavailable (${status}), using mock data`);
        }
        // Add mock news for testing (remove in production if desired)
        if (newsItems.length === 0) {
            newsItems.push({
                id: `news-mock-${Date.now()}`,
                title: 'Bitcoin Hits New All-Time High Amid Institutional Adoption',
                source: 'CoinTelegraph',
                url: 'https://cointelegraph.com',
                sentiment: 'positive',
                impact: 'high',
                relevantAssets: ['BTC', 'ETH'],
                timestamp: new Date(),
                summary: 'Bitcoin surges on institutional adoption news',
            }, {
                id: `news-mock-${Date.now() + 1}`,
                title: 'Ethereum Technical Analysis Shows Bullish Breakout',
                source: 'CryptoBreifing',
                url: 'https://cryptobriefing.com',
                sentiment: 'positive',
                impact: 'medium',
                relevantAssets: ['ETH'],
                timestamp: new Date(),
                summary: 'ETH technical indicators suggest upward movement',
            }, {
                id: `news-mock-${Date.now() + 2}`,
                title: 'Regulatory Uncertainty Impacts Market',
                source: 'Decrypt',
                url: 'https://decrypt.co',
                sentiment: 'negative',
                impact: 'medium',
                relevantAssets: ['BTC', 'ETH', 'ADA'],
                timestamp: new Date(),
                summary: 'New regulations could impact crypto markets',
            });
        }
        return newsItems;
    }
    analyzeSentiment(text) {
        const lower = text.toLowerCase();
        const positiveCount = this.keywordsPositive.filter((k) => lower.includes(k)).length;
        const negativeCount = this.keywordsNegative.filter((k) => lower.includes(k)).length;
        if (positiveCount > negativeCount)
            return 'positive';
        if (negativeCount > positiveCount)
            return 'negative';
        return 'neutral';
    }
    calculateImpact(text, sentiment) {
        const lower = text.toLowerCase();
        // Critical keywords
        if (lower.includes('hack') ||
            lower.includes('exploit') ||
            lower.includes('approval') ||
            lower.includes('partnership with')) {
            return 'critical';
        }
        // High impact keywords
        if (lower.includes('regulation') ||
            lower.includes('sec') ||
            lower.includes('launch') ||
            lower.includes('upgrade')) {
            return 'high';
        }
        // Medium impact
        if (sentiment !== 'neutral') {
            return 'medium';
        }
        return 'low';
    }
    detectAssets(text) {
        const assets = ['BTC', 'ETH', 'ADA', 'XRP', 'SOL', 'DOT'];
        const detected = [];
        const lower = text.toLowerCase();
        const assetNames = {
            bitcoin: 'BTC',
            ethereum: 'ETH',
            cardano: 'ADA',
            ripple: 'XRP',
            solana: 'SOL',
            polkadot: 'DOT',
        };
        for (const [name, symbol] of Object.entries(assetNames)) {
            if (lower.includes(name)) {
                detected.push(symbol);
            }
        }
        for (const asset of assets) {
            if (lower.includes(asset.toLowerCase())) {
                if (!detected.includes(asset)) {
                    detected.push(asset);
                }
            }
        }
        return detected;
    }
    getNewsHistory() {
        return this.newsHistory;
    }
    getNewsByAsset(asset) {
        return this.newsHistory.filter((n) => n.relevantAssets.includes(asset));
    }
    getHighImpactNews() {
        return this.newsHistory.filter((n) => n.impact === 'critical' || n.impact === 'high');
    }
}
exports.newsMonitor = new NewsMonitor();
//# sourceMappingURL=news-monitor.js.map