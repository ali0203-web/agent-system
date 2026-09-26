/**
 * Personal Trading Configuration
 * Local instance for testing agents with real capital
 * DO NOT USE IN PRODUCTION
 */

import * as dotenv from 'dotenv'
import * as path from 'path'

// Load .env.local explicitly
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') })

// Determine if using testnet or mainnet
const useTestnet = (process.env.USE_TESTNET || 'true').toLowerCase() === 'true'

export const personalTradingConfig = {
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
  mode: 'personal' as const,
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
  },

  // Logging
  logLevel: 'info',
  logFile: 'personal-trading.log',
}

// Validation
if (!personalTradingConfig.apiKey || !personalTradingConfig.apiSecret) {
  const keyType = useTestnet ? 'BINANCE_TESTNET_API_KEY and BINANCE_TESTNET_API_SECRET' : 'BINANCE_API_KEY and BINANCE_API_SECRET'
  throw new Error(`${keyType} must be set in .env.local`)
}

if (personalTradingConfig.capital < 10) {
  throw new Error('Capital must be at least $10')
}

export default personalTradingConfig
