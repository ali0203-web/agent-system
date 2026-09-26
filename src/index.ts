/**
 * Agent #1: Bitcoin Price Monitor
 * Runs on a schedule and monitors Bitcoin price 24/7
 */

import schedule from 'node-schedule'
import dotenv from 'dotenv'
import { BitcoinPriceMonitor } from './agents/bitcoin-price-monitor'
import { Logger } from './logger'

dotenv.config()

const logger = new Logger('Main')

async function main() {
  console.log(`
╔════════════════════════════════════════════════════════════╗
║    🚀 Agent #1: Bitcoin Price Monitor                      ║
║    Starting production service...                          ║
╚════════════════════════════════════════════════════════════╝
  `)

  const agent = new BitcoinPriceMonitor()

  try {
    // Validate agent on startup
    logger.info('🔍 Validating agent...')
    const isValid = await agent.validate()

    if (!isValid) {
      throw new Error('Agent validation failed')
    }

    logger.info('✅ Agent validation passed')

    // Run immediately on startup
    logger.info('⚡ Running agent immediately...')
    await agent.run()

    // Schedule recurring execution
    logger.info('📅 Setting up schedule: Every 5 minutes')
    schedule.scheduleJob('*/5 * * * *', async () => {
      try {
        logger.info('🔄 Running scheduled execution...')
        await agent.run()
      } catch (error) {
        logger.error('Scheduled execution failed', error)
      }
    })

    logger.info('✅ Agent service started successfully')
    logger.info('')
    logger.info('📊 Status:')
    logger.info('   • Agent: Bitcoin Price Monitor')
    logger.info('   • Schedule: Every 5 minutes')
    logger.info('   • API: CoinGecko (free)')
    logger.info('   • Status: ✅ Running')
    logger.info('')
    logger.info('📈 Monitoring Bitcoin prices in:')
    logger.info('   • USD (US Dollar)')
    logger.info('   • EUR (Euro)')
    logger.info('')
    logger.info('🔔 Alerts will be published for >2% price changes')
    logger.info('')
    logger.info('Press Ctrl+C to stop the service')
    logger.info('')

    // Handle graceful shutdown
    process.on('SIGINT', async () => {
      logger.info('🛑 Shutting down...')
      process.exit(0)
    })

    process.on('SIGTERM', async () => {
      logger.info('🛑 Shutting down...')
      process.exit(0)
    })
  } catch (error) {
    logger.error('❌ Failed to start agent service', error)
    process.exit(1)
  }
}

// Start the service
main()
