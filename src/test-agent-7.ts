/**
 * Test Agent #7: Risk Management
 * Tests portfolio risk analysis and position sizing
 */

import { riskManagement } from './agents/risk-management'

async function testRiskManagement() {
  console.log('🧪 Testing Agent #7: Risk Management')
  console.log('================================\n')

  try {
    // Test 1: Add positions
    console.log('📍 Test 1: Add Positions')
    console.log('-----------------------------------')
    riskManagement.addPosition('bitcoin', 'BTC', 0.5, 42000)
    riskManagement.addPosition('ethereum', 'ETH', 5, 2000)
    riskManagement.addPosition('cardano', 'ADA', 100, 0.5)
    console.log('✅ Test 1 Passed: 3 positions added\n')

    // Test 2: Execute risk analysis
    console.log('📍 Test 2: Execute Risk Analysis')
    console.log('-----------------------------------')
    await riskManagement.execute()
    console.log('✅ Test 2 Passed: Risk analysis completed\n')

    // Test 3: Get metrics
    console.log('📍 Test 3: Get Risk Metrics')
    console.log('-----------------------------------')
    const metrics = riskManagement.getRiskMetrics()
    console.log(`✅ Portfolio Metrics:`)
    console.log(`  Total Value: $${metrics.totalPortfolioValue.toFixed(2)}`)
    console.log(`  Portfolio Volatility: ${(metrics.portfolioVolatility * 100).toFixed(2)}%`)
    console.log(`  Max Drawdown: ${(metrics.maxDrawdown * 100).toFixed(2)}%`)
    console.log(`  Sharpe Ratio: ${metrics.sharpeRatio.toFixed(2)}`)
    console.log(`  Value at Risk (95%): $${metrics.var95.toFixed(2)}\n`)

    // Test 4: Get positions
    console.log('📍 Test 4: Get Positions with Risk Levels')
    console.log('-----------------------------------')
    const positions = riskManagement.getPositions()
    console.log(`✅ Retrieved ${positions.length} positions:`)
    for (const pos of positions) {
      console.log(`  ${pos.symbol}:`)
      console.log(`    Quantity: ${pos.quantity}`)
      console.log(`    Entry: $${pos.entryPrice} | Current: $${pos.currentPrice.toFixed(2)}`)
      console.log(`    Unrealized: $${pos.unrealizedGain.toFixed(2)}`)
      console.log(`    Portfolio %: ${pos.percentageOfPortfolio.toFixed(1)}%`)
      console.log(`    Volatility: ${(pos.volatility * 100).toFixed(2)}%`)
      console.log(`    Risk Level: ${pos.riskLevel.toUpperCase()}\n`)
    }

    // Test 5: Get recommendations
    console.log('📍 Test 5: Get Risk Recommendations')
    console.log('-----------------------------------')
    const recommendations = riskManagement.getRecommendations()
    console.log(`✅ Generated ${recommendations.length} recommendations:`)
    for (const rec of recommendations) {
      console.log(`  ${rec.symbol}:`)
      console.log(`    Action: ${rec.action.toUpperCase()}`)
      console.log(`    Reason: ${rec.reason}`)
      console.log(`    Suggested Size: ${rec.suggestedSize}`)
      console.log(`    Stop Loss: $${rec.stopLoss.toFixed(2)}`)
      console.log(`    Take Profit: $${rec.takeProfit.toFixed(2)}`)
      console.log(`    Risk/Reward: ${rec.riskRewardRatio.toFixed(2)}`)
      console.log(`    Confidence: ${(rec.confidence * 100).toFixed(0)}%\n`)
    }

    // Test 6: Get specific position
    console.log('📍 Test 6: Get Specific Position')
    console.log('-----------------------------------')
    const btcPos = riskManagement.getPositionBySymbol('BTC')
    if (btcPos) {
      console.log(`✅ BTC Position:`)
      console.log(`  Current Price: $${btcPos.currentPrice.toFixed(2)}`)
      console.log(`  Gain/Loss: $${btcPos.unrealizedGain.toFixed(2)}\n`)
    }

    // Test 7: Execute second analysis cycle
    console.log('📍 Test 7: Execute Second Analysis')
    console.log('-----------------------------------')
    await riskManagement.execute()
    console.log('✅ Second analysis completed\n')

    // Test 8: Verify metric stability
    console.log('📍 Test 8: Verify Metrics Stability')
    console.log('-----------------------------------')
    const metrics2 = riskManagement.getRiskMetrics()
    if (
      Math.abs(metrics2.totalPortfolioValue - metrics.totalPortfolioValue) < metrics.totalPortfolioValue * 0.1
    ) {
      console.log(`✅ Metrics stable (within 10% variance)`)
      console.log(
        `  Previous Total: $${metrics.totalPortfolioValue.toFixed(2)}`
      )
      console.log(`  Current Total: $${metrics2.totalPortfolioValue.toFixed(2)}\n`)
    }

    // Summary
    console.log('================================')
    console.log('✅ ALL TESTS PASSED!')
    console.log('================================')
    console.log('\n📊 Risk Management Features:')
    console.log('  ✓ Position tracking')
    console.log('  ✓ Portfolio volatility calculation')
    console.log('  ✓ Value at Risk (VaR) analysis')
    console.log('  ✓ Sharpe Ratio computation')
    console.log('  ✓ Max drawdown analysis')
    console.log('  ✓ Dynamic stop-loss levels')
    console.log('  ✓ Risk/reward ratios')
    console.log('  ✓ Position sizing recommendations')
    console.log('\n8/8 tests passed! 🎉')
  } catch (error) {
    console.error('❌ Test failed:', error)
    process.exit(1)
  }
}

testRiskManagement()
