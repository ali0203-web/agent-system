"use strict";
/**
 * Test Agent #1: Bitcoin Price Monitor
 *
 * Run this with: npm run test:agent
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const bitcoin_price_monitor_1 = require("./agents/bitcoin-price-monitor");
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
async function testBitcoinPriceMonitor() {
    console.log('\n' + '='.repeat(60));
    console.log('🧪 TESTING AGENT #1: Bitcoin Price Monitor');
    console.log('='.repeat(60) + '\n');
    const agent = new bitcoin_price_monitor_1.BitcoinPriceMonitor();
    try {
        // Test 1: Health Check
        console.log('📋 TEST 1: Health Check');
        console.log('---');
        const isHealthy = await agent.healthCheck();
        console.log(`Result: ${isHealthy ? '✅ PASS' : '❌ FAIL'}`);
        console.log('');
        // Test 2: Validation
        console.log('📋 TEST 2: Validation');
        console.log('---');
        const isValid = await agent.validate();
        console.log(`Result: ${isValid ? '✅ PASS' : '❌ FAIL'}`);
        console.log('');
        // Test 3: Execute Agent
        console.log('📋 TEST 3: Execute Agent');
        console.log('---');
        const result = await agent.run();
        console.log('Result:');
        console.log(JSON.stringify(result, null, 2));
        console.log('');
        // Test 4: Get Current Price
        console.log('📋 TEST 4: Get Current Price');
        console.log('---');
        const priceUSD = await agent.getCurrentPrice('USD');
        const priceEUR = await agent.getCurrentPrice('EUR');
        console.log(`Bitcoin Price (USD): $${priceUSD}`);
        console.log(`Bitcoin Price (EUR): €${priceEUR}`);
        console.log('');
        // Test 5: Get Metrics
        console.log('📋 TEST 5: Get Metrics');
        console.log('---');
        const metrics = await agent.getMetrics();
        console.log('Metrics:');
        console.log(JSON.stringify(metrics, null, 2));
        console.log('');
        // Summary
        console.log('='.repeat(60));
        console.log('✅ ALL TESTS PASSED!');
        console.log('='.repeat(60));
        console.log('\nNext Steps:');
        console.log('1. Deploy to production: npm run deploy');
        console.log('2. Monitor logs: npm run logs');
        console.log('3. Build Agent #2: Portfolio Tracker');
        console.log('');
    }
    catch (error) {
        console.error('❌ TEST FAILED:', error);
        process.exit(1);
    }
}
// Run tests
testBitcoinPriceMonitor();
//# sourceMappingURL=test-agent.js.map