"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BitcoinPriceMonitor = void 0;
const base_agent_1 = require("../base-agent");
const binance_api_1 = require("../services/binance-api");
class BitcoinPriceMonitor extends base_agent_1.BaseAgent {
    constructor() {
        super(...arguments);
        this.config = {
            name: 'bitcoin-price-monitor',
            category: 'trading',
            description: 'Monitor Bitcoin price in real-time from CoinGecko API',
            version: '1.0.0',
            schedule: '*/5 * * * *', // Every 5 minutes
            timeout: 10000,
        };
        this.currencies = ['usd'];
        this.priceThresholds = {
            significantChange: 2, // 2% change = alert
        };
        this.lastPrice = {};
    }
    /**
     * Fetch and process Bitcoin price
     */
    async execute() {
        this.logger.info('Fetching Bitcoin price...');
        try {
            // Fetch price data
            const priceData = await this.fetchBitcoinPrice();
            // Calculate changes
            const enrichedData = this.enrichPriceData(priceData);
            // Check for significant changes
            const alerts = this.checkForAlerts(enrichedData);
            // Publish alerts if any
            if (alerts.length > 0) {
                await this.publishAlerts(alerts);
            }
            // Update last known prices
            this.updateLastPrices(enrichedData);
            this.logger.info(`✅ Price data collected: ${JSON.stringify(enrichedData)}`);
            return {
                success: true,
                priceData: enrichedData,
                alerts: alerts,
                timestamp: new Date(),
            };
        }
        catch (error) {
            this.logger.error('Failed to fetch Bitcoin price', error);
            throw error;
        }
    }
    /**
     * Fetch Bitcoin price from Binance
     */
    async fetchBitcoinPrice() {
        try {
            const binance = (0, binance_api_1.getBinanceAPI)();
            const prices = await binance.getPrices(['BTCUSDT']);
            // Transform response to PriceData array
            const priceData = [];
            if (prices?.BTCUSDT) {
                priceData.push({
                    symbol: 'BTC',
                    price: prices.BTCUSDT,
                    currency: 'USD',
                    timestamp: new Date(),
                    source: 'binance',
                });
            }
            return priceData;
        }
        catch (error) {
            this.logger.error('API request failed', error);
            throw error;
        }
    }
    /**
     * Enrich price data with additional metrics
     */
    enrichPriceData(priceData) {
        return priceData.map((item) => {
            const lastPrice = this.lastPrice[item.currency];
            const change = lastPrice ? ((item.price - lastPrice) / lastPrice) * 100 : 0;
            return {
                ...item,
                change24h: Math.round(change * 100) / 100, // 2 decimal places
                priceChangeStatus: change > 2 ? 'up' : change < -2 ? 'down' : 'stable',
            };
        });
    }
    /**
     * Check for price changes that should trigger alerts
     */
    checkForAlerts(enrichedData) {
        const alerts = [];
        for (const data of enrichedData) {
            if (Math.abs(data.change24h) >= this.priceThresholds.significantChange) {
                alerts.push({
                    type: 'PRICE_ALERT',
                    severity: Math.abs(data.change24h) > 5 ? 'high' : 'medium',
                    symbol: data.symbol,
                    currency: data.currency,
                    currentPrice: data.price,
                    priceChange: data.change24h,
                    message: `Bitcoin price changed ${data.change24h > 0 ? '📈' : '📉'} ${Math.abs(data.change24h).toFixed(2)}% in ${data.currency}`,
                    timestamp: new Date(),
                });
            }
        }
        return alerts;
    }
    /**
     * Publish alerts to event system
     */
    async publishAlerts(alerts) {
        for (const alert of alerts) {
            this.logger.warn(`🚨 Alert: ${alert.message}`);
            await this.publishEvent('bitcoin-price-alert', alert);
        }
    }
    /**
     * Update last known prices
     */
    updateLastPrices(enrichedData) {
        for (const data of enrichedData) {
            this.lastPrice[data.currency] = data.price;
        }
    }
    /**
     * Validate agent configuration
     */
    async validate() {
        this.logger.info('Validating BitcoinPriceMonitor...');
        try {
            // Test API connectivity
            const testData = await this.fetchBitcoinPrice();
            if (!testData || testData.length === 0) {
                throw new Error('Failed to fetch test data from API');
            }
            this.logger.info(`✅ Validation successful. Current BTC price: $${testData[0].price}`);
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
            const priceData = await this.fetchBitcoinPrice();
            return priceData && priceData.length > 0;
        }
        catch (error) {
            this.logger.error('Health check failed', error);
            return false;
        }
    }
    /**
     * Get current Bitcoin price
     */
    async getCurrentPrice(currency = 'USD') {
        try {
            const priceData = await this.fetchBitcoinPrice();
            const currencyData = priceData.find((p) => p.currency === currency);
            return currencyData?.price || null;
        }
        catch (error) {
            this.logger.error('Failed to get current price', error);
            return null;
        }
    }
}
exports.BitcoinPriceMonitor = BitcoinPriceMonitor;
//# sourceMappingURL=bitcoin-price-monitor.js.map