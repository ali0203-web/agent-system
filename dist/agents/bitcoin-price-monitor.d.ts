import { BaseAgent, AgentConfig } from '../base-agent';
export declare class BitcoinPriceMonitor extends BaseAgent {
    config: AgentConfig;
    private currencies;
    private priceThresholds;
    private lastPrice;
    /**
     * Fetch and process Bitcoin price
     */
    execute(): Promise<any>;
    /**
     * Fetch Bitcoin price from Binance
     */
    private fetchBitcoinPrice;
    /**
     * Enrich price data with additional metrics
     */
    private enrichPriceData;
    /**
     * Check for price changes that should trigger alerts
     */
    private checkForAlerts;
    /**
     * Publish alerts to event system
     */
    private publishAlerts;
    /**
     * Update last known prices
     */
    private updateLastPrices;
    /**
     * Validate agent configuration
     */
    validate(): Promise<boolean>;
    /**
     * Health check
     */
    healthCheck(): Promise<boolean>;
    /**
     * Get current Bitcoin price
     */
    getCurrentPrice(currency?: string): Promise<number | null>;
}
//# sourceMappingURL=bitcoin-price-monitor.d.ts.map