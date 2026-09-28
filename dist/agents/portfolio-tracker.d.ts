import { BaseAgent, AgentConfig } from '../base-agent';
interface PortfolioPosition {
    symbol: string;
    quantity: number;
    currentPrice: number;
    currentValue: number;
    costBasis: number;
    totalCost: number;
    gain: number;
    gainPercent: number;
    currency: string;
}
export declare class PortfolioTracker extends BaseAgent {
    config: AgentConfig;
    private holdings;
    /**
     * Track portfolio value and calculate gains
     */
    execute(): Promise<any>;
    /**
     * Fetch current prices for all holdings
     */
    private fetchPrices;
    /**
     * Calculate portfolio positions
     */
    private calculatePositions;
    /**
     * Calculate portfolio summary
     */
    private calculateSummary;
    /**
     * Check for significant portfolio changes
     */
    private checkForAlerts;
    /**
     * Publish portfolio update event
     */
    private publishPortfolioUpdate;
    /**
     * Get portfolio value in real-time
     */
    getPortfolioValue(): Promise<number>;
    /**
     * Get portfolio breakdown (returns positions)
     */
    getPortfolioBreakdown(): Promise<PortfolioPosition[]>;
    /**
     * Add a new holding
     */
    addHolding(symbol: string, binanceSymbol: string, quantity: number, costBasis: number): void;
    /**
     * Update a holding
     */
    updateHolding(symbol: string, quantity: number): void;
    /**
     * Remove a holding
     */
    removeHolding(symbol: string): void;
    /**
     * Validate configuration
     */
    validate(): Promise<boolean>;
    /**
     * Health check
     */
    healthCheck(): Promise<boolean>;
}
export {};
//# sourceMappingURL=portfolio-tracker.d.ts.map