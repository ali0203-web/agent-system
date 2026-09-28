export interface Signal {
    id: string;
    agentId: string;
    agentName: string;
    signalType: 'bullish' | 'bearish' | 'neutral' | 'strong_bullish' | 'strong_bearish';
    confidence: number;
    symbol?: string;
    message: string;
    data: Record<string, any>;
    timestamp: Date;
    createdAt?: Date;
}
export interface SignalStats {
    agentId: string;
    agentName: string;
    signalsLast24h: number;
    bullishSignals: number;
    bearishSignals: number;
    avgConfidence: number;
    successRate: number;
}
//# sourceMappingURL=signal.d.ts.map