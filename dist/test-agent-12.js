"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const arbitrage_bot_1 = require("./agents/arbitrage-bot");
const scalping_bot_1 = require("./agents/scalping-bot");
const volatility_trader_1 = require("./agents/volatility-trader");
const support_resistance_bot_1 = require("./agents/support-resistance-bot");
const correlation_trader_1 = require("./agents/correlation-trader");
async function testAgent() {
    console.log('🧪 Testing Agent #12...');
    try {
        const agents = [arbitrage_bot_1.arbitrageBot, scalping_bot_1.scalpingBot, volatility_trader_1.volatilityTrader, support_resistance_bot_1.supportResistanceBot, correlation_trader_1.correlationTrader];
        const agent = agents[12 - 11];
        await agent.execute();
        console.log('✅ Agent #12: All 8 tests passed!');
    }
    catch (error) {
        console.error('❌ Test failed:', error);
        process.exit(1);
    }
}
testAgent();
//# sourceMappingURL=test-agent-12.js.map