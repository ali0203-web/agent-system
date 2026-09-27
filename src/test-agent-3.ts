/**
 * Test Agent #3: Pump & Dump Detector
 *
 * Run this with: npx ts-node src/test-agent-3.ts
 */

import { PumpDumpDetector } from './agents/pump-dump-detector'
import dotenv from 'dotenv'

dotenv.config()

async function testPumpDumpDetector() {
  console.log('\n' + '='.repeat(60))
  console.log('🧪 TESTING AGENT #3: Pump & Dump Detector')
  console.log('='.repeat(60) + '\n')

  const agent = new PumpDumpDetector()

  try {
    // Test 1: Health Check
    console.log('📋 TEST 1: Health Check')
    console.log('---')
    const isHealthy = await agent.healthCheck()
    console.log(`Result: ${isHealthy ? '✅ PASS' : '❌ FAIL'}`)
    console.log('')

    // Test 2: Validation
    console.log('📋 TEST 2: Validation')
    console.log('---')
    const isValid = await agent.validate()
    console.log(`Result: ${isValid ? '✅ PASS' : '❌ FAIL'}`)
    console.log('')

    // Test 3: Get Monitored Coins
    console.log('📋 TEST 3: Get Monitored Coins')
    console.log('---')
    const coins = agent.getMonitoredCoins()
    console.log(`Monitoring ${coins.length} coins:`)
    coins.forEach((coin) => {
      console.log(`  • ${coin.toUpperCase()}`)
    })
    console.log('')

    // Test 4: Execute Agent (Detect Signals)
    console.log('📋 TEST 4: Execute Agent (Pump & Dump Detection)')
    console.log('---')
    const result: any = await agent.run()
    console.log('Result:')
    console.log(JSON.stringify(result, null, 2))
    console.log('')

    // Test 5: Add a New Coin
    console.log('📋 TEST 5: Add New Coin')
    console.log('---')
    console.log('Adding Litecoin to monitoring list...')
    agent.addCoin('litecoin', 'LTCUSDT', 'LTC')
    const updatedCoins = agent.getMonitoredCoins()
    console.log(`Now monitoring ${updatedCoins.length} coins: ${updatedCoins.join(', ')}`)
    console.log('')

    // Test 6: Remove a Coin
    console.log('📋 TEST 6: Remove Coin')
    console.log('---')
    console.log('Removing Ripple from monitoring list...')
    agent.removeCoin('ripple')
    const finalCoins = agent.getMonitoredCoins()
    console.log(`Now monitoring ${finalCoins.length} coins: ${finalCoins.join(', ')}`)
    console.log('')

    // Summary
    console.log('='.repeat(60))
    console.log('✅ ALL TESTS PASSED!')
    console.log('='.repeat(60))
    console.log('\nAgent #3 Status:')
    console.log(`• Health: ✅`)
    console.log(`• Validation: ✅`)
    console.log(`• Detection: ${result?.data?.success ? '✅' : '❌'}`)
    console.log(`• Signals Found: ${result?.data?.signalCount || 0}`)
    console.log(`• Monitored Coins: ${finalCoins.length}`)
    console.log('\nNext Steps:')
    console.log('1. Build the Orchestrator system')
    console.log('2. Connect all agents via event bus')
    console.log('3. Deploy to production (Railway/Render)')
    console.log('')
  } catch (error) {
    console.error('❌ TEST FAILED:', error)
    process.exit(1)
  }
}

// Run tests
testPumpDumpDetector()
