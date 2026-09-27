import { BaseAgent, AgentConfig } from '../base-agent';
export declare class PumpDumpDetector extends BaseAgent {
    config: AgentConfig;
    private coins;
    private priceHistory;
    private thresholds;
    /**
     * Detect pump & dump patterns
     */
    execute(): Promise<any>;
    /**
     * Fetch coin data from Binance
     */
    private fetchCoinData;
    /**
     * Analyze patterns in price & volume
     */
    private analyzePatterns;
    /**
     * Calculate signal severity
     */
    private calculateSeverity;
    /**
     * Calculate confidence score (0-1)
     */
    private calculateConfidence;
    /**
     * Update price history
     */
    private updateHistory;
    /**
     * Add coin to monitor
     */
    addCoin(name: string, symbol: string, displaySymbol: string): void;
    /**
     * Remove coin from monitor
     */
    removeCoin(name: string): void;
    /**
     * Get current monitored coins
     */
    getMonitoredCoins(): string[];
    /**
     * Validate configuration
     */
    validate(): Promise<boolean>;
    /**
     * Health check
     */
    healthCheck(): Promise<boolean>;
}
//# sourceMappingURL=pump-dump-detector.d.ts.map