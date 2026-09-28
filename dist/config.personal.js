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
// Load .env.local if it exists (development), otherwise use environment variables (production)
const envPath = path.resolve(process.cwd(), '.env.local');
try {
    const fs = require('fs');
    if (fs.existsSync(envPath)) {
        dotenv.config({ path: envPath });
    }
}
catch (e) {
    // File doesn't exist, rely on environment variables instead
}
// Determine if using testnet or mainnet
const useTestnet = (process.env.USE_TESTNET || 'true').toLowerCase() === 'true';
exports.personalTradingConfig = {
    // Exchange Configuration
    exchange: 'binance',
    apiKey: useTestnet ? (process.env.BINANCE_TESTNET_API_KEY || '') : (process.env.BINANCE_API_KEY || ''),
    apiSecret: useTestnet ? (process.env.BINANCE_TESTNET_API_SECRET || '') : (process.env.BINANCE_API_SECRET || ''),
    // Binance API Configuration
    binanceApiBaseUrl: useTestnet
        ? 'https://testnet.binance.vision/api'
        : 'https://api.binance.com/api',
    binanceWsBaseUrl: useTestnet
        ? 'wss://stream.testnet.binance.vision:9443/ws'
        : 'wss://stream.binance.com:9443/ws',
    // Capital Management
    capital: parseInt(process.env.TRADING_CAPITAL || '50'),
    maxRiskPerTrade: parseFloat(process.env.MAX_RISK_PER_TRADE || '0.02'), // 2% max loss
    maxPositionSize: parseFloat(process.env.MAX_POSITION_SIZE || '0.1'), // 10% max position
    // Mode Configuration
    mode: 'personal',
    isTestnet: useTestnet,
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
        meanReversionBot: { enabled: true, schedule: '*/10 * * * *' },
        arbitrageBot: { enabled: true, schedule: '*/7 * * * *' },
        scalpingBot: { enabled: true, schedule: '*/3 * * * *' },
        volatilityTrader: { enabled: true, schedule: '*/8 * * * *' },
        supportResistanceBot: { enabled: true, schedule: '*/15 * * * *' },
        correlationTrader: { enabled: true, schedule: '*/12 * * * *' },
    },
    // Logging
    logLevel: 'info',
    logFile: 'personal-trading.log',
};
// Validation - use dummy values for testnet if not provided
const apiKey = exports.personalTradingConfig.apiKey || (useTestnet ? 'demo-key' : '');
const apiSecret = exports.personalTradingConfig.apiSecret || (useTestnet ? 'demo-secret' : '');
// Only throw if using mainnet and credentials are missing
if (!useTestnet && (!apiKey || !apiSecret)) {
    const keyType = 'BINANCE_API_KEY and BINANCE_API_SECRET';
    throw new Error(`${keyType} must be set in .env.local`);
}
// Update config with validated keys
exports.personalTradingConfig.apiKey = apiKey;
exports.personalTradingConfig.apiSecret = apiSecret;
if (exports.personalTradingConfig.capital < 10) {
    throw new Error('Capital must be at least $10');
}
exports.default = exports.personalTradingConfig;
//# sourceMappingURL=config.personal.js.map