"use strict";
/**
 * Personal Trading Configuration
 * Local instance for testing agents with real capital
 * DO NOT USE IN PRODUCTION
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.personalTradingConfig = void 0;
const dotenv = __importStar(require("dotenv"));
const path = __importStar(require("path"));
// Load .env.local explicitly
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
exports.personalTradingConfig = {
    // Exchange Configuration
    exchange: 'binance',
    apiKey: process.env.BINANCE_API_KEY || '',
    apiSecret: process.env.BINANCE_API_SECRET || '',
    // Capital Management
    capital: parseInt(process.env.TRADING_CAPITAL || '50'),
    maxRiskPerTrade: parseFloat(process.env.MAX_RISK_PER_TRADE || '0.02'), // 2% max loss
    maxPositionSize: parseFloat(process.env.MAX_POSITION_SIZE || '0.1'), // 10% max position
    // Mode Configuration
    mode: 'personal',
    isDryRun: false, // Set to true to test without real trades
    // Agent Configuration
    agents: {
        bitcoinMonitor: { enabled: true, schedule: '*/5 * * * *' },
        portfolioTracker: { enabled: true, schedule: '*/15 * * * *' },
        pumpDumpDetector: { enabled: true, schedule: '*/5 * * * *' },
        dcaBot: { enabled: true, schedule: '0 9 */7 * *' },
        newsMonitor: { enabled: true, schedule: '*/30 * * * *' },
        technicalAnalysis: { enabled: true, schedule: '*/15 * * * *' },
        riskManagement: { enabled: true, schedule: '*/20 * * * *' },
        gridTradingBot: { enabled: true, schedule: '*/10 * * * *' },
        momentumTrader: { enabled: true, schedule: '*/5 * * * *' },
    },
    // Logging
    logLevel: 'info',
    logFile: 'personal-trading.log',
};
// Validation
if (!exports.personalTradingConfig.apiKey || !exports.personalTradingConfig.apiSecret) {
    throw new Error('BINANCE_API_KEY and BINANCE_API_SECRET must be set in .env.local');
}
if (exports.personalTradingConfig.capital < 10) {
    throw new Error('Capital must be at least $10');
}
exports.default = exports.personalTradingConfig;
//# sourceMappingURL=config.personal.js.map