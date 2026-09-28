import { EventEmitter } from 'events';
import { Logger } from './logger';
import { Database } from './database';
export interface AgentConfig {
    name: string;
    category: string;
    description: string;
    version: string;
    schedule?: string;
    timeout?: number;
    retries?: number;
}
export interface AgentResult {
    agentId: string;
    agentName: string;
    success: boolean;
    data?: any;
    error?: string;
    executedAt: Date;
    executionTime: number;
    nextRun?: Date;
}
export declare abstract class BaseAgent extends EventEmitter {
    abstract config: AgentConfig;
    id: string;
    logger: Logger;
    db: Database;
    lastExecution?: Date;
    lastError?: string;
    constructor();
    /**
     * Main execution method - override in child classes
     */
    abstract execute(): Promise<any>;
    /**
     * Health check - verify agent can run
     */
    healthCheck(): Promise<boolean>;
    /**
     * Validate configuration
     */
    validate(): Promise<boolean>;
    /**
     * Run agent with error handling
     */
    run(): Promise<AgentResult>;
    /**
     * Call another agent
     */
    callAgent(agentName: string, data?: any): Promise<any>;
    /**
     * Publish event for other agents
     */
    publishEvent(eventName: string, data: any): Promise<void>;
    /**
     * Subscribe to event
     */
    subscribeToEvent(eventName: string, callback: (data: any) => Promise<void>): Promise<void>;
    /**
     * Save result to database
     */
    protected saveResult(result: AgentResult): Promise<void>;
    /**
     * Get metrics
     */
    getMetrics(): Promise<{
        agentId: string;
        agentName: string;
        lastExecution: Date | undefined;
        lastError: string | undefined;
        metrics: any;
    } | null>;
    /**
     * HTTP GET request helper with retry logic for rate limiting
     */
    protected get<T = any>(url: string, headers?: any, retries?: number): Promise<T>;
    /**
     * HTTP POST request helper
     */
    protected post<T = any>(url: string, data: any, headers?: any): Promise<T>;
    /**
     * Log message
     */
    protected log(level: 'info' | 'warn' | 'error' | 'debug', message: string, data?: any): void;
}
//# sourceMappingURL=base-agent.d.ts.map