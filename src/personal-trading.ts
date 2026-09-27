/**
 * Personal Trading System
 * Runs all 7 agents with your capital ($50 test)
 * 
 * Usage: npm run dev:personal-trading
 */

import 'dotenv/config'
import { orchestrator } from './orchestrator'
import { personalTradingConfig } from './config.personal'
import { Logger } from './logger'
import { startDashboardServer } from './dashboard-server'

const logger = new Logger('PersonalTrading')

async function startPersonalTrading() {
  logger.info('═══════════════════════════════════════════')
  logger.info('🤖 PERSONAL TRADING SYSTEM')
  logger.info('═══════════════════════════════════════════')
  logger.info(`💰 Capital: $${personalTradingConfig.capital}`)
  logger.info(`📊 Mode: ${personalTradingConfig.mode}`)
  logger.info(`🌐 Environment: ${personalTradingConfig.isTestnet ? '🧪 TESTNET (FAKE MONEY)' : '🚀 MAINNET (REAL MONEY)'}`)
  logger.info(`⚖️  Max Risk Per Trade: ${(personalTradingConfig.maxRiskPerTrade * 100).toFixed(1)}%`)
  logger.info(`📈 Max Position Size: ${(personalTradingConfig.maxPositionSize * 100).toFixed(1)}%`)
  logger.info('')

  try {
    // Start dashboard server on exposed port
    startDashboardServer(3000)
    logger.info('')

    // Initialize orchestrator
    await orchestrator.start()

    logger.info('═══════════════════════════════════════════')
    logger.info('✅ ALL AGENTS RUNNING')
    logger.info('═══════════════════════════════════════════')
    logger.info('')
    logger.info('Agent Status:')
    logger.info('  ✓ Bitcoin Price Monitor (*/5 min)')
    logger.info('  ✓ Portfolio Tracker (*/15 min)')
    logger.info('  ✓ Pump & Dump Detector (*/5 min)')
    logger.info('  ✓ DCA Bot (Weekly)')
    logger.info('  ✓ News Monitor (*/30 min)')
    logger.info('  ✓ Technical Analysis (*/15 min)')
    logger.info('  ✓ Risk Management (*/20 min)')
    logger.info('  ✓ Grid Trading Bot (*/10 min)')
    logger.info('  ✓ Momentum Trader (*/5 min)')
    logger.info('  ✓ Mean Reversion Bot (*/10 min)')
    logger.info('  ✓ Arbitrage Bot (*/7 min)')
    logger.info('  ✓ Scalping Bot (*/3 min)')
    logger.info('  ✓ Volatility Trader (*/8 min)')
    logger.info('  ✓ Support/Resistance Bot (*/15 min)')
    logger.info('  ✓ Correlation Trader (*/12 min)')
    logger.info('')
    logger.info('Logs: personal-trading.log')
    logger.info('Dashboard: http://localhost:3000 (when running)')
    logger.info('')
    logger.info('Press Ctrl+C to stop')
    logger.info('═══════════════════════════════════════════')

    // Handle graceful shutdown
    process.on('SIGINT', async () => {
      logger.info('🛑 Shutting down...')
      await orchestrator.stop()
      process.exit(0)
    })
  } catch (error) {
    logger.error('Failed to start personal trading system:', error)
    process.exit(1)
  }
}

startPersonalTrading()
