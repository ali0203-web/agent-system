"use strict";
/**
 * Personal Trading System
 * Runs all 7 agents with your capital ($50 test)
 *
 * Usage: npm run dev:personal-trading
 */
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
const orchestrator_1 = require("./orchestrator");
const config_personal_1 = require("./config.personal");
const logger_1 = require("./logger");
const logger = new logger_1.Logger('PersonalTrading');
async function startPersonalTrading() {
    logger.info('═══════════════════════════════════════════');
    logger.info('🤖 PERSONAL TRADING SYSTEM');
    logger.info('═══════════════════════════════════════════');
    logger.info(`💰 Capital: $${config_personal_1.personalTradingConfig.capital}`);
    logger.info(`📊 Mode: ${config_personal_1.personalTradingConfig.mode}`);
    logger.info(`⚖️  Max Risk Per Trade: ${(config_personal_1.personalTradingConfig.maxRiskPerTrade * 100).toFixed(1)}%`);
    logger.info(`📈 Max Position Size: ${(config_personal_1.personalTradingConfig.maxPositionSize * 100).toFixed(1)}%`);
    logger.info('');
    try {
        // Initialize orchestrator
        await orchestrator_1.orchestrator.start();
        logger.info('═══════════════════════════════════════════');
        logger.info('✅ ALL AGENTS RUNNING');
        logger.info('═══════════════════════════════════════════');
        logger.info('');
        logger.info('Agent Status:');
        logger.info('  ✓ Bitcoin Price Monitor (*/5 min)');
        logger.info('  ✓ Portfolio Tracker (*/15 min)');
        logger.info('  ✓ Pump & Dump Detector (*/5 min)');
        logger.info('  ✓ DCA Bot (Weekly)');
        logger.info('  ✓ News Monitor (*/30 min)');
        logger.info('  ✓ Technical Analysis (*/15 min)');
        logger.info('  ✓ Risk Management (*/20 min)');
        logger.info('  ✓ Grid Trading Bot (*/10 min)');
        logger.info('  ✓ Momentum Trader (*/5 min)');
        logger.info('');
        logger.info('Logs: personal-trading.log');
        logger.info('Dashboard: http://localhost:3000 (when running)');
        logger.info('');
        logger.info('Press Ctrl+C to stop');
        logger.info('═══════════════════════════════════════════');
        // Handle graceful shutdown
        process.on('SIGINT', async () => {
            logger.info('🛑 Shutting down...');
            await orchestrator_1.orchestrator.stop();
            process.exit(0);
        });
    }
    catch (error) {
        logger.error('Failed to start personal trading system:', error);
        process.exit(1);
    }
}
startPersonalTrading();
//# sourceMappingURL=personal-trading.js.map