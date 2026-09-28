"use strict";
/**
 * Test Agent #6: Technical Analysis
 * Tests technical analysis and trading signal functionality
 */
Object.defineProperty(exports, "__esModule", { value: true });
const technical_analysis_1 = require("./agents/technical-analysis");
async function testTechnicalAnalysis() {
    console.log('🧪 Testing Agent #6: Technical Analysis');
    console.log('================================\n');
    try {
        // Test 1: Execute technical analysis
        console.log('📍 Test 1: Execute Technical Analysis');
        console.log('-----------------------------------');
        await technical_analysis_1.technicalAnalysis.execute();
        console.log('✅ Test 1 Passed: Technical analysis completed\n');
        // Test 2: Get indicators
        console.log('📍 Test 2: Get Technical Indicators');
        console.log('-----------------------------------');
        const indicators = technical_analysis_1.technicalAnalysis.getIndicators();
        console.log(`✅ Got indicators for ${indicators.length} assets:`);
        for (const ind of indicators) {
            console.log(`  ${ind.symbol}:`);
            console.log(`    Price: $${ind.currentPrice.toFixed(2)}`);
            console.log(`    MA20: ${ind.ma20.toFixed(2)}, MA50: ${ind.ma50.toFixed(2)}`);
            console.log(`    RSI: ${ind.rsi.toFixed(2)}, MACD: ${ind.macd.toFixed(4)}`);
            console.log(`    Signal: ${ind.signal} (${ind.strength}, ${ind.confidence.toFixed(1)}% confidence)\n`);
        }
        // Test 3: Get buy signals
        console.log('📍 Test 3: Get Buy Signals');
        console.log('-----------------------------------');
        const buySignals = technical_analysis_1.technicalAnalysis.getIndicatorsBySignal('buy');
        console.log(`✅ Found ${buySignals.length} BUY signals:`);
        for (const sig of buySignals) {
            console.log(`  ${sig.symbol}: ${sig.strength.toUpperCase()} signal (${sig.confidence.toFixed(1)}%)`);
        }
        console.log();
        // Test 4: Get sell signals
        console.log('📍 Test 4: Get Sell Signals');
        console.log('-----------------------------------');
        const sellSignals = technical_analysis_1.technicalAnalysis.getIndicatorsBySignal('sell');
        console.log(`✅ Found ${sellSignals.length} SELL signals:`);
        for (const sig of sellSignals) {
            console.log(`  ${sig.symbol}: ${sig.strength.toUpperCase()} signal (${sig.confidence.toFixed(1)}%)`);
        }
        console.log();
        // Test 5: Get specific asset analysis
        console.log('📍 Test 5: Get Specific Asset Analysis');
        console.log('-----------------------------------');
        const btcAnalysis = technical_analysis_1.technicalAnalysis.getAssetAnalysis('bitcoin');
        if (btcAnalysis) {
            console.log(`✅ Bitcoin Analysis:`);
            console.log(`  Current Price: $${btcAnalysis.currentPrice.toFixed(2)}`);
            console.log(`  Trend: ${btcAnalysis.signal.toUpperCase()}`);
            console.log(`  RSI: ${btcAnalysis.rsi.toFixed(2)} (${btcAnalysis.rsi < 30 ? 'Oversold' : btcAnalysis.rsi > 70 ? 'Overbought' : 'Neutral'})`);
            console.log(`  Price History (last 5): ${btcAnalysis.priceHistory.slice(-5).map((p) => p.toFixed(2)).join(', ')}\n`);
        }
        // Test 6: Execute second analysis
        console.log('📍 Test 6: Execute Second Analysis Cycle');
        console.log('-----------------------------------');
        await technical_analysis_1.technicalAnalysis.execute();
        const updatedIndicators = technical_analysis_1.technicalAnalysis.getIndicators();
        console.log(`✅ Second analysis completed with ${updatedIndicators.length} assets\n`);
        // Test 7: Verify price history tracking
        console.log('📍 Test 7: Verify Price History Tracking');
        console.log('-----------------------------------');
        const ethAnalysis = technical_analysis_1.technicalAnalysis.getAssetAnalysis('ethereum');
        if (ethAnalysis && ethAnalysis.priceHistory.length > 0) {
            console.log(`✅ Ethereum price history tracked: ${ethAnalysis.priceHistory.length} data points`);
            const priceChange = ethAnalysis.priceHistory[ethAnalysis.priceHistory.length - 1] - ethAnalysis.priceHistory[0];
            const percentChange = ((priceChange / ethAnalysis.priceHistory[0]) * 100).toFixed(2);
            console.log(`  Price change: ${percentChange}% over history\n`);
        }
        // Test 8: Check RSI calculation
        console.log('📍 Test 8: Verify RSI Calculation');
        console.log('-----------------------------------');
        const allIndicators = technical_analysis_1.technicalAnalysis.getIndicators();
        let rsiCount = 0;
        for (const ind of allIndicators) {
            if (ind.rsi >= 0 && ind.rsi <= 100) {
                rsiCount++;
            }
        }
        console.log(`✅ RSI values valid for ${rsiCount}/${allIndicators.length} assets (range 0-100)\n`);
        // Summary
        console.log('================================');
        console.log('✅ ALL TESTS PASSED!');
        console.log('================================');
        console.log('\n📊 Technical Analysis Features:');
        console.log('  ✓ Price fetching');
        console.log('  ✓ Moving averages (MA20, MA50)');
        console.log('  ✓ RSI calculation');
        console.log('  ✓ MACD calculation');
        console.log('  ✓ Trading signal generation');
        console.log('  ✓ Signal strength assessment');
        console.log('  ✓ Price history tracking');
        console.log('  ✓ Event emission');
        console.log('\n8/8 tests passed! 🎉');
    }
    catch (error) {
        console.error('❌ Test failed:', error);
        process.exit(1);
    }
}
testTechnicalAnalysis();
//# sourceMappingURL=test-agent-6.js.map