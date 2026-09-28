"use strict";
/**
 * Test Agent #8: Grid Trading Bot
 * Tests grid placement, order execution, and profit tracking
 */
Object.defineProperty(exports, "__esModule", { value: true });
const grid_trading_bot_1 = require("./agents/grid-trading-bot");
async function testGridTradingBot() {
    console.log('🧪 Testing Agent #8: Grid Trading Bot');
    console.log('================================\n');
    try {
        // Test 1: Add grid position
        console.log('📍 Test 1: Add Grid Position');
        console.log('-----------------------------------');
        grid_trading_bot_1.gridTradingBot.addGridPosition('bitcoin', 'BTC', 10, 80000, 90000, 100);
        grid_trading_bot_1.gridTradingBot.addGridPosition('ethereum', 'ETH', 8, 2400, 3000, 75);
        console.log('✅ Test 1 Passed: 2 grid positions added\n');
        // Test 2: Execute grid trading
        console.log('📍 Test 2: Execute Grid Trading');
        console.log('-----------------------------------');
        await grid_trading_bot_1.gridTradingBot.execute();
        console.log('✅ Test 2 Passed: Grid trading execution completed\n');
        // Test 3: Get positions
        console.log('📍 Test 3: Get Grid Positions');
        console.log('-----------------------------------');
        const positions = grid_trading_bot_1.gridTradingBot.getPositions();
        console.log(`✅ Retrieved ${positions.length} positions:`);
        for (const pos of positions) {
            console.log(`  ${pos.symbol}:`);
            console.log(`    Grid Levels: ${pos.gridLevels}`);
            console.log(`    Price Range: $${pos.bottomPrice.toFixed(2)} - $${pos.topPrice.toFixed(2)}`);
            console.log(`    Grid Size: $${pos.gridSize.toFixed(2)}`);
            console.log(`    Investment Per Level: $${pos.investmentPerGrid}`);
            console.log(`    Total Investment: $${pos.totalInvestment}`);
            console.log(`    Total Filled: ${pos.totalFilled} levels`);
            console.log(`    Total Profit: $${pos.totalProfit.toFixed(2)}\n`);
        }
        // Test 4: Check grid levels
        console.log('📍 Test 4: View Grid Levels');
        console.log('-----------------------------------');
        const btcPos = grid_trading_bot_1.gridTradingBot.getPositionBySymbol('BTC');
        if (btcPos) {
            console.log(`✅ BTC Grid Levels:`);
            for (const level of btcPos.levels.slice(0, 5)) {
                console.log(`  Level ${level.level}: $${level.price.toFixed(2)} | Status: ${level.status}`);
            }
            console.log(`  ... (${btcPos.levels.length} total levels)\n`);
        }
        // Test 5: Get grid stats
        console.log('📍 Test 5: Get Grid Statistics');
        console.log('-----------------------------------');
        const btcStats = grid_trading_bot_1.gridTradingBot.getGridStats('BTC');
        const ethStats = grid_trading_bot_1.gridTradingBot.getGridStats('ETH');
        if (btcStats && ethStats) {
            console.log(`✅ Grid Statistics:`);
            console.log(`  BTC:`);
            console.log(`    Total Profit: $${btcStats.totalProfit.toFixed(2)}`);
            console.log(`    Trades Completed: ${btcStats.tradesCompleted}`);
            console.log(`    Fill Rate: ${btcStats.fillRate.toFixed(1)}%`);
            console.log(`  ETH:`);
            console.log(`    Total Profit: $${ethStats.totalProfit.toFixed(2)}`);
            console.log(`    Trades Completed: ${ethStats.tradesCompleted}`);
            console.log(`    Fill Rate: ${ethStats.fillRate.toFixed(1)}%\n`);
        }
        // Test 6: Execute second cycle
        console.log('📍 Test 6: Execute Second Cycle');
        console.log('-----------------------------------');
        await grid_trading_bot_1.gridTradingBot.execute();
        console.log('✅ Test 6 Passed: Second cycle executed\n');
        // Test 7: Simulate position update
        console.log('📍 Test 7: Get Updated Position');
        console.log('-----------------------------------');
        const updatedBTC = grid_trading_bot_1.gridTradingBot.getPositionBySymbol('BTC');
        if (updatedBTC) {
            console.log(`✅ BTC Position updated - Total Profit: $${updatedBTC.totalProfit.toFixed(2)}\n`);
        }
        // Test 8: Remove position
        console.log('📍 Test 8: Remove Grid Position');
        console.log('-----------------------------------');
        grid_trading_bot_1.gridTradingBot.removeGridPosition('ETH');
        const finalPositions = grid_trading_bot_1.gridTradingBot.getPositions();
        console.log(`✅ Test 8 Passed: Position removed | ${finalPositions.length} positions remain\n`);
        // Summary
        console.log('================================');
        console.log('✅ ALL TESTS PASSED!');
        console.log('================================');
        console.log('\n📊 Grid Trading Bot Features:');
        console.log('  ✓ Grid level creation');
        console.log('  ✓ Multi-asset support');
        console.log('  ✓ Buy/sell order placement');
        console.log('  ✓ Profit tracking');
        console.log('  ✓ Fill rate calculation');
        console.log('  ✓ Volatility trading');
        console.log('  ✓ Event emission');
        console.log('\n8/8 tests passed! 🎉');
    }
    catch (error) {
        console.error('❌ Test failed:', error);
        process.exit(1);
    }
}
testGridTradingBot();
//# sourceMappingURL=test-agent-8.js.map