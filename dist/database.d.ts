import { QueryResult } from 'pg';
export declare class Database {
    private pgPool;
    private redisClient;
    private connected;
    constructor();
    /**
     * Connect to databases
     */
    connect(): Promise<void>;
    /**
     * Initialize database tables
     */
    private initializeTables;
    /**
     * Run query
     */
    query(text: string, values?: any[]): Promise<QueryResult>;
    /**
     * Insert data
     */
    insert(table: string, data: Record<string, any>): Promise<any>;
    /**
     * Get agent from registry
     */
    getAgent(agentName: string): Promise<any>;
    /**
     * Publish event
     */
    publishEvent(eventName: string, data: any, emittedBy?: string): Promise<void>;
    /**
     * Subscribe to event (listener pattern)
     */
    subscribeToEvent(eventName: string, callback: (data: any) => Promise<void>): Promise<void>;
    /**
     * Cache get
     */
    cacheGet(key: string): Promise<string | null>;
    /**
     * Cache set
     */
    cacheSet(key: string, value: string, expirationSeconds?: number): Promise<void>;
    /**
     * Close connections
     */
    close(): Promise<void>;
}
//# sourceMappingURL=database.d.ts.map