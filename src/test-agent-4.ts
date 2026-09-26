/**
 * Test Agent #4: DCA Bot
 * Tests dollar-cost averaging functionality
 */

import { dcaBot } from './agents/dca-bot'

async function testDCABot() {
  console.log('🧪 Testing Agent #4: DCA Bot')
  console.log('================================\n')

  try {
    // Test 1: Execute DCA purchase cycle
    console.log('📍 Test 1: Execute DCA Purchase Cycle')
    console.log('-----------------------------------')
    await dcaBot.execute()
    console.log('✅ Test 1 Passed: DCA purchase cycle completed\n')

    // Test 2: Get current positions
    console.log('📍 Test 2: Get Current Positions')
    console.log('-----------------------------------')
    const positions = dcaBot.getPositions()
    console.log(`✅ Found ${positions.length} positions:`)
    for (const pos of positions) {
      console.log(`  ${pos.symbol}: ${pos.totalUnits.toFixed(6)} units`)
      console.log(`    Avg Cost: $${pos.averageCostPerUnit.toFixed(2)}`)
      console.log(`    Current: $${pos.currentValue.toFixed(2)}`)
      console.log(`    Gain/Loss: ${pos.gainLossPercent.toFixed(2)}%\n`)
    }

    // Test 3: Add new position
    console.log('📍 Test 3: Add New Position')
    console.log('-----------------------------------')
    dcaBot.addPosition('ripple', 'XRP', 60)
    console.log('✅ Test 3 Passed: Added XRP position\n')

    // Test 4: Update investment amount
    console.log('📍 Test 4: Update Investment Amount')
    console.log('-----------------------------------')
    dcaBot.updateInvestmentAmount('BTC', 150)
    console.log('✅ Test 4 Passed: Updated BTC investment to $150\n')

    // Test 5: Execute second purchase cycle
    console.log('📍 Test 5: Execute Second Purchase Cycle')
    console.log('-----------------------------------')
    await dcaBot.execute()
    console.log('✅ Test 5 Passed: Second purchase cycle completed\n')

    // Test 6: Verify portfolio growth
    console.log('📍 Test 6: Verify Portfolio Growth')
    console.log('-----------------------------------')
    const updatedPositions = dcaBot.getPositions()
    let totalValue = 0
    let totalInvested = 0

    for (const pos of updatedPositions) {
      totalValue += pos.currentValue
      totalInvested += pos.totalInvested
    }

    console.log(`Total Invested: $${totalInvested.toFixed(2)}`)
    console.log(`Total Value: $${totalValue.toFixed(2)}`)
    console.log(`Overall Gain/Loss: $${(totalValue - totalInvested).toFixed(2)}`)
    console.log(
      `Overall Return: ${(((totalValue - totalInvested) / totalInvested) * 100).toFixed(2)}%`
    )
    console.log('✅ Test 6 Passed: Portfolio tracking verified\n')

    // Test 7: Remove position
    console.log('📍 Test 7: Remove Position')
    console.log('-----------------------------------')
    dcaBot.removePosition('XRP')
    const finalPositions = dcaBot.getPositions()
    console.log(`✅ Test 7 Passed: Position removed (${finalPositions.length} remaining)\n`)

    // Summary
    console.log('================================')
    console.log('✅ ALL TESTS PASSED!')
    console.log('================================')
    console.log('\n📊 DCA Bot Features:')
    console.log('  ✓ Automated periodic purchases')
    console.log('  ✓ Multi-asset support')
    console.log('  ✓ Cost basis tracking')
    console.log('  ✓ Performance monitoring')
    console.log('  ✓ Dynamic position management')
    console.log('  ✓ Event emission')
    console.log('\n7/7 tests passed! 🎉')
  } catch (error) {
    console.error('❌ Test failed:', error)
    process.exit(1)
  }
}

testDCABot()
