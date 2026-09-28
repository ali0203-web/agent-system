/**
 * Database Initialization Service
 * Sets up PostgreSQL schema and creates necessary tables
 */
declare class DatabaseInitService {
    private pool;
    constructor();
    initialize(): Promise<void>;
    createSignal(agentId: string, agentName: string, signalType: string, data: any): Promise<any>;
    updateAgentMetrics(agentId: string, agentName: string, metrics: any): Promise<any>;
    updateAgentStatus(agentId: string, agentName: string, status: any): Promise<any>;
    getAgentSummary(): Promise<any[]>;
    getRecentSignals(limit?: number): Promise<any[]>;
    close(): Promise<void>;
}
export declare const dbInit: DatabaseInitService;
export {};
//# sourceMappingURL=database-init.d.ts.map