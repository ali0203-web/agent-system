/**
 * Orchestrator System
 * Manages all agents, coordinates event flow, and handles inter-agent communication
 */
import { EventEmitter } from 'events';
export declare class Orchestrator extends EventEmitter {
    private agents;
    private logger;
    private timers;
    private running;
    constructor();
    /**
     * Register all agents
     */
    private registerAgents;
    /**
     * Register an agent
     */
    private register;
    /**
     * Setup event listeners for agent communication
     */
    private setupEventListeners;
    /**
     * Start the orchestrator
     */
    start(): Promise<void>;
    /**
     * Run all agents once immediately
     */
    private runAllAgents;
    /**
     * Run a single agent
     */
    private runAgent;
    /**
     * Schedule agents based on cron expressions
     */
    private scheduleAgents;
    /**
     * Get orchestrator status
     */
    getStatus(): any;
    /**
     * Get metrics for all agents
     */
    getMetrics(): Promise<any>;
    /**
     * Stop the orchestrator
     */
    stop(): Promise<void>;
}
export declare const orchestrator: Orchestrator;
//# sourceMappingURL=orchestrator.d.ts.map