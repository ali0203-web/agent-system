declare class SignalStorageService {
    private buffer;
    private readonly BATCH_SIZE;
    private readonly FLUSH_INTERVAL;
    private flushTimer;
    constructor();
    private startPeriodicFlush;
    addSignal(agentId: string, agentName: string, signalType: string, data: any): Promise<void>;
    flush(): Promise<void>;
    shutdown(): Promise<void>;
    getBufferSize(): number;
}
export declare const signalStorage: SignalStorageService;
export {};
//# sourceMappingURL=signal-storage.d.ts.map