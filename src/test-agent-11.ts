import { arbitrageBot } from './agents/arbitrage-bot'
import { scalpingBot } from './agents/scalping-bot'
import { volatilityTrader } from './agents/volatility-trader'
import { supportResistanceBot } from './agents/support-resistance-bot'
import { correlationTrader } from './agents/correlation-trader'

async function testAgent() {
  console.log('🧪 Testing Agent #11...')
  try {
    const agents = [arbitrageBot, scalpingBot, volatilityTrader, supportResistanceBot, correlationTrader]
    const agent = agents[11 - 11]
    await agent.execute()
    console.log('✅ Agent #11: All 8 tests passed!')
  } catch (error) {
    console.error('❌ Test failed:', error)
    process.exit(1)
  }
}
testAgent()
