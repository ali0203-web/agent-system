/**
 * Personal Trading Configuration
 * Local instance for testing agents with real capital
 * DO NOT USE IN PRODUCTION
 */

import * as dotenv from 'dotenv'
import * as path from 'path'

// Load .env.local explicitly
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') })

export const personalTradingConfig = {
  // Exchange Configuration
  exchange: 'binance',
  apiKey: process.env.BINANCE_API_KEY || '',
  apiSecret: process.env.BINANCE_API_SECRET || '',

  // Capital Management
  capital: parseInt(process.env.TRADING_CAPITAL || '50'),
  maxRiskPerTrade: parseFloat(process.env.MAX_RISK_PER_TRADE || '0.02'), // 2% max loss
  maxPositionSize: parseFloat(process.env.MAX_POSITION_SIZE || '0.1'), // 10% max position

  // Mode Configuration
  mode: 'personal' as const,
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
  },

  // Logging
  logLevel: 'info',
  logFile: 'personal-trading.log',
}

// Validation
if (!personalTradingConfig.apiKey || !personalTradingConfig.apiSecret) {
  throw new Error('BINANCE_API_KEY and BINANCE_API_SECRET must be set in .env.local')
}

if (personalTradingConfig.capital < 10) {
  throw new Error('Capital must be at least $10')
}

export default personalTradingConfig
