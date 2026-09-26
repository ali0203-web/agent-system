/**
 * Personal Trading Configuration
 * Local instance for testing agents with real capital
 * DO NOT USE IN PRODUCTION
 */
export declare const personalTradingConfig: {
    exchange: string;
    apiKey: string;
    apiSecret: string;
    binanceApiBaseUrl: string;
    binanceWsBaseUrl: string;
    capital: number;
    maxRiskPerTrade: number;
    maxPositionSize: number;
    mode: "personal";
    isTestnet: boolean;
    isDryRun: boolean;
    agents: {
        bitcoinMonitor: {
            enabled: boolean;
            schedule: string;
        };
        portfolioTracker: {
            enabled: boolean;
            schedule: string;
        };
        pumpDumpDetector: {
            enabled: boolean;
            schedule: string;
        };
        dcaBot: {
            enabled: boolean;
            schedule: string;
        };
        newsMonitor: {
            enabled: boolean;
            schedule: string;
        };
        technicalAnalysis: {
            enabled: boolean;
            schedule: string;
        };
        riskManagement: {
            enabled: boolean;
            schedule: string;
        };
        gridTradingBot: {
            enabled: boolean;
            schedule: string;
        };
        momentumTrader: {
            enabled: boolean;
            schedule: string;
        };
        meanReversionBot: {
            enabled: boolean;
            schedule: string;
        };
    };
    logLevel: string;
    logFile: string;
};
export default personalTradingConfig;
//# sourceMappingURL=config.personal.d.ts.map