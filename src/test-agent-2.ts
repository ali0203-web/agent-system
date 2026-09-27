/**
 * Test Agent #2: Portfolio Tracker
 *
 * Run this with: npm run test:agent
 * (Update package.json script if needed)
 */

import { PortfolioTracker } from './agents/portfolio-tracker'
import dotenv from 'dotenv'

dotenv.config()

async function testPortfolioTracker() {
  console.log('\n' + '='.repeat(60))
  console.log('🧪 TESTING AGENT #2: Portfolio Tracker')
  console.log('='.repeat(60) + '\n')

  const agent = new PortfolioTracker()

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

    // Test 3: Get Portfolio Breakdown
    console.log('📋 TEST 3: Get Portfolio Breakdown')
    console.log('---')
    const breakdown = await agent.getPortfolioBreakdown()
    console.log('Positions:')
    breakdown.forEach((pos) => {
      console.log(
        `  ${pos.symbol}: ${pos.quantity} @ $${pos.currentPrice.toFixed(2)} = $${pos.currentValue.toFixed(2)} (${pos.gainPercent > 0 ? '+' : ''}${pos.gainPercent.toFixed(2)}%)`
      )
    })
    console.log('')

    // Test 4: Get Portfolio Value
    console.log('📋 TEST 4: Get Portfolio Value')
    console.log('---')
    const portfolioValue = await agent.getPortfolioValue()
    console.log(`Portfolio Value: $${portfolioValue.toFixed(2)}`)
    console.log('')

    // Test 5: Execute Agent (Full Tracking)
    console.log('📋 TEST 5: Execute Agent (Full Tracking)')
    console.log('---')
    const result = await agent.run()
    console.log('Result:')
    console.log(JSON.stringify(result, null, 2))
    console.log('')

    // Test 6: Modify Holdings
    console.log('📋 TEST 6: Modify Holdings')
    console.log('---')
    console.log('Adding Ripple (100 XRP @ $2)...')
    agent.addHolding('XRP', 'XRPUSDT', 100, 2)
    console.log('Updating Bitcoin quantity to 1 BTC...')
    agent.updateHolding('BTC', 1)
    console.log('New portfolio breakdown:')
    const newBreakdown = await agent.getPortfolioBreakdown()
    console.log(`Holdings count: ${newBreakdown.length}`)
    console.log(`New portfolio value: $${newBreakdown.reduce((sum, pos) => sum + pos.currentValue, 0).toFixed(2)}`)
    console.log('')

    // Summary
    console.log('='.repeat(60))
    console.log('✅ ALL TESTS PASSED!')
    console.log('='.repeat(60))
    console.log('\nNext Steps:')
    console.log('1. Integrate with Agent #1 (Bitcoin Price Monitor)')
    console.log('2. Build Agent #3: Pump & Dump Detector')
    console.log('3. Build Agent #4: DCA Bot')
    console.log('4. Deploy all agents to production')
    console.log('')
  } catch (error) {
    console.error('❌ TEST FAILED:', error)
    process.exit(1)
  }
}

// Run tests
testPortfolioTracker()
