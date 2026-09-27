"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PumpDumpDetector = void 0;
const base_agent_1 = require("../base-agent");
const binance_api_1 = require("../services/binance-api");
class PumpDumpDetector extends base_agent_1.BaseAgent {
    constructor() {
        super(...arguments);
        this.config = {
            name: 'pump-dump-detector',
            category: 'trading',
            description: 'Detect pump and dump patterns in cryptocurrency prices',
            version: '1.0.0',
            schedule: '*/5 * * * *', // Every 5 minutes
            timeout: 15000,
        };
        // Monitoring coins (map to Binance symbols)
        this.coins = [
            { name: 'bitcoin', symbol: 'BTCUSDT', displaySymbol: 'BTC' },
            { name: 'ethereum', symbol: 'ETHUSDT', displaySymbol: 'ETH' },
            { name: 'cardano', symbol: 'ADAUSDT', displaySymbol: 'ADA' },
            { name: 'ripple', symbol: 'XRPUSDT', displaySymbol: 'XRP' },
        ];
        // Store historical data for comparison
        this.priceHistory = new Map();
        // Detection thresholds
        this.thresholds = {
            priceChangePercent: 5, // 5% change = alert
            volumeMultiplier: 2.5, // 2.5x normal volume = spike
            timeWindow: 60, // Look at last 60 minutes
        };
    }
    /**
     * Detect pump & dump patterns
     */
    async execute() {
        this.logger.info(`Scanning ${this.coins.length} coins for pump/dump patterns...`);
        try {
            // Fetch current prices
            const currentPrices = await this.fetchCoinData();
            // Analyze for patterns
            const signals = await this.analyzePatterns(currentPrices);
            // Update history
            this.updateHistory(currentPrices);
            // Publish critical signals
            if (signals.length > 0) {
                for (const signal of signals) {
                    this.logger.warn(`🚨 ${signal.type.toUpperCase()}: ${signal.message}`);
                    await this.publishEvent('pump-dump-signal', signal);
                }
            }
            this.logger.info(`✅ Scan complete: Found ${signals.length} signals`);
            return {
                success: true,
                signalCount: signals.length,
                signals,
                timestamp: new Date(),
            };
        }
        catch (error) {
            this.logger.error('Failed to detect pump/dump patterns', error);
            throw error;
        }
    }
    /**
     * Fetch coin data from Binance
     */
    async fetchCoinData() {
        try {
            const binance = (0, binance_api_1.getBinanceAPI)();
            const binanceSymbols = this.coins.map((c) => c.symbol);
            const prices = await binance.getPrices(binanceSymbols);
            // Transform to snapshots
            const snapshots = [];
            for (const coin of this.coins) {
                const price = prices?.[coin.symbol];
                if (price) {
                    snapshots.push({
                        symbol: coin.displaySymbol,
                        price,
                        volume: 0, // Binance getPrices doesn't include volume
                        timestamp: new Date(),
                    });
                }
            }
            return snapshots;
        }
        catch (error) {
            this.logger.error('Failed to fetch coin data', error);
            throw error;
        }
    }
    /**
     * Analyze patterns in price & volume
     */
    async analyzePatterns(currentPrices) {
        const signals = [];
        for (const current of currentPrices) {
            const history = this.priceHistory.get(current.symbol) || [];
            if (history.length < 12) {
                // Need at least 12 data points (1 hour at 5-min intervals)
                continue;
            }
            // Get price from 1 hour ago
            const oneHourAgo = history[0]; // Oldest data point
            const priceChange = ((current.price - oneHourAgo.price) / oneHourAgo.price) * 100;
            const avgVolume = history.reduce((sum, h) => sum + h.volume, 0) / history.length;
            const volumeChange = current.volume / avgVolume;
            // Detect pump
            if (priceChange > this.thresholds.priceChangePercent &&
                volumeChange > this.thresholds.volumeMultiplier) {
                const severity = this.calculateSeverity(priceChange, volumeChange, 'pump');
                const confidence = this.calculateConfidence(priceChange, volumeChange, 'pump');
                signals.push({
                    symbol: current.symbol,
                    type: 'pump',
                    severity,
                    priceChange: Math.round(priceChange * 100) / 100,
                    volumeChange: Math.round(volumeChange * 100) / 100,
                    confidence: Math.round(confidence * 100),
                    message: `PUMP detected: ${current.symbol} +${priceChange.toFixed(2)}% with ${volumeChange.toFixed(1)}x volume`,
                    timestamp: new Date(),
                });
            }
            // Detect dump
            if (priceChange < -this.thresholds.priceChangePercent &&
                volumeChange > this.thresholds.volumeMultiplier) {
                const severity = this.calculateSeverity(Math.abs(priceChange), volumeChange, 'dump');
                const confidence = this.calculateConfidence(Math.abs(priceChange), volumeChange, 'dump');
                signals.push({
                    symbol: current.symbol,
                    type: 'dump',
                    severity,
                    priceChange: Math.round(priceChange * 100) / 100,
                    volumeChange: Math.round(volumeChange * 100) / 100,
                    confidence: Math.round(confidence * 100),
                    message: `DUMP detected: ${current.symbol} ${priceChange.toFixed(2)}% with ${volumeChange.toFixed(1)}x volume`,
                    timestamp: new Date(),
                });
            }
        }
        return signals;
    }
    /**
     * Calculate signal severity
     */
    calculateSeverity(priceChange, volumeChange, type) {
        const scorePrice = priceChange / 10; // 10% = 1 point
        const scoreVolume = volumeChange / 2; // 2x volume = 1 point
        const totalScore = scorePrice + scoreVolume;
        if (totalScore >= 4)
            return 'critical';
        if (totalScore >= 3)
            return 'high';
        if (totalScore >= 2)
            return 'medium';
        return 'low';
    }
    /**
     * Calculate confidence score (0-1)
     */
    calculateConfidence(priceChange, volumeChange, type) {
        // Base confidence on how extreme the pattern is
        const priceConfidence = Math.min(priceChange / 20, 1); // Max 1 at 20% change
        const volumeConfidence = Math.min(volumeChange / 5, 1); // Max 1 at 5x volume
        // Average them
        return (priceConfidence + volumeConfidence) / 2;
    }
    /**
     * Update price history
     */
    updateHistory(snapshots) {
        for (const snapshot of snapshots) {
            if (!this.priceHistory.has(snapshot.symbol)) {
                this.priceHistory.set(snapshot.symbol, []);
            }
            const history = this.priceHistory.get(snapshot.symbol);
            history.push(snapshot);
            // Keep only last 2 hours (24 data points at 5-min intervals)
            if (history.length > 24) {
                history.shift();
            }
        }
    }
    /**
     * Add coin to monitor
     */
    addCoin(name, symbol, displaySymbol) {
        if (!this.coins.find((c) => c.name === name)) {
            this.coins.push({ name, symbol, displaySymbol });
            this.priceHistory.delete(displaySymbol);
            this.logger.info(`Added coin to monitor: ${name}`);
        }
    }
    /**
     * Remove coin from monitor
     */
    removeCoin(name) {
        const index = this.coins.findIndex((c) => c.name === name);
        if (index >= 0) {
            this.coins.splice(index, 1);
            this.logger.info(`Removed coin from monitor: ${name}`);
        }
    }
    /**
     * Get current monitored coins
     */
    getMonitoredCoins() {
        return this.coins.map((c) => c.displaySymbol);
    }
    /**
     * Validate configuration
     */
    async validate() {
        this.logger.info('Validating PumpDumpDetector...');
        try {
            if (this.coins.length === 0) {
                throw new Error('No coins configured to monitor');
            }
            // Test API connectivity
            const data = await this.fetchCoinData();
            if (!data || data.length === 0) {
                throw new Error('Failed to fetch coin data');
            }
            this.logger.info(`✅ Validation successful. Monitoring ${data.length} coins`);
            return true;
        }
        catch (error) {
            this.logger.error('Validation failed', error);
            return false;
        }
    }
    /**
     * Health check
     */
    async healthCheck() {
        try {
            const data = await this.fetchCoinData();
            return data && data.length > 0;
        }
        catch (error) {
            this.logger.error('Health check failed', error);
            return false;
        }
    }
}
exports.PumpDumpDetector = PumpDumpDetector;
//# sourceMappingURL=pump-dump-detector.js.map