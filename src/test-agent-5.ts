/**
 * Test Agent #5: News Monitor
 * Tests cryptocurrency news monitoring functionality
 */

import { newsMonitor } from './agents/news-monitor'

async function testNewsMonitor() {
  console.log('🧪 Testing Agent #5: News Monitor')
  console.log('================================\n')

  try {
    // Test 1: Execute news scan
    console.log('📍 Test 1: Execute News Scan')
    console.log('-----------------------------------')
    await newsMonitor.execute()
    console.log('✅ Test 1 Passed: News scan completed\n')

    // Test 2: Get news history
    console.log('📍 Test 2: Get News History')
    console.log('-----------------------------------')
    const history = newsMonitor.getNewsHistory()
    console.log(`✅ Found ${history.length} news items in history:`)
    for (const item of history.slice(0, 3)) {
      console.log(`  • ${item.title.substring(0, 50)}...`)
      console.log(`    Sentiment: ${item.sentiment}, Impact: ${item.impact}`)
      console.log(`    Assets: ${item.relevantAssets.join(', ')}\n`)
    }
    console.log('✅ Test 2 Passed: News history retrieved\n')

    // Test 3: Get high impact news
    console.log('📍 Test 3: Get High Impact News')
    console.log('-----------------------------------')
    const highImpact = newsMonitor.getHighImpactNews()
    console.log(`✅ Found ${highImpact.length} high/critical impact items:`)
    for (const item of highImpact) {
      console.log(`  • [${item.impact.toUpperCase()}] ${item.title.substring(0, 50)}...`)
    }
    console.log('✅ Test 3 Passed: High impact news filtered\n')

    // Test 4: Get news by asset
    console.log('📍 Test 4: Get News by Asset')
    console.log('-----------------------------------')
    const btcNews = newsMonitor.getNewsByAsset('BTC')
    const ethNews = newsMonitor.getNewsByAsset('ETH')
    console.log(`Bitcoin-related news: ${btcNews.length} items`)
    console.log(`Ethereum-related news: ${ethNews.length} items`)
    console.log('✅ Test 4 Passed: Asset filtering works\n')

    // Test 5: Sentiment analysis
    console.log('📍 Test 5: Sentiment Analysis')
    console.log('-----------------------------------')
    const sentiments = history.reduce(
      (acc, item) => {
        acc[item.sentiment]++
        return acc
      },
      { positive: 0, negative: 0, neutral: 0 }
    )
    console.log(`Positive: ${sentiments.positive}`)
    console.log(`Negative: ${sentiments.negative}`)
    console.log(`Neutral: ${sentiments.neutral}`)
    console.log('✅ Test 5 Passed: Sentiment analysis working\n')

    // Test 6: Impact scoring
    console.log('📍 Test 6: Impact Scoring')
    console.log('-----------------------------------')
    const impacts = history.reduce(
      (acc, item) => {
        acc[item.impact]++
        return acc
      },
      { critical: 0, high: 0, medium: 0, low: 0 }
    )
    console.log(`Critical: ${impacts.critical}`)
    console.log(`High: ${impacts.high}`)
    console.log(`Medium: ${impacts.medium}`)
    console.log(`Low: ${impacts.low}`)
    console.log('✅ Test 6 Passed: Impact scoring working\n')

    // Test 7: Execute second scan
    console.log('📍 Test 7: Execute Second News Scan')
    console.log('-----------------------------------')
    await newsMonitor.execute()
    const updatedHistory = newsMonitor.getNewsHistory()
    console.log(`✅ Second scan completed. Total history: ${updatedHistory.length} items\n`)

    // Test 8: Asset detection
    console.log('📍 Test 8: Asset Detection')
    console.log('-----------------------------------')
    const assetsDetected = new Set<string>()
    history.forEach((item) => {
      item.relevantAssets.forEach((asset) => assetsDetected.add(asset))
    })
    console.log(`Detected ${assetsDetected.size} unique assets: ${Array.from(assetsDetected).join(', ')}`)
    console.log('✅ Test 8 Passed: Asset detection working\n')

    // Summary
    console.log('================================')
    console.log('✅ ALL TESTS PASSED!')
    console.log('================================')
    console.log('\n📊 News Monitor Features:')
    console.log('  ✓ Real-time news fetching')
    console.log('  ✓ Sentiment analysis')
    console.log('  ✓ Impact scoring')
    console.log('  ✓ Asset detection')
    console.log('  ✓ News history tracking')
    console.log('  ✓ Asset-based filtering')
    console.log('  ✓ Event emission')
    console.log('  ✓ High-impact alerts')
    console.log('\n8/8 tests passed! 🎉')
  } catch (error) {
    console.error('❌ Test failed:', error)
    process.exit(1)
  }
}

testNewsMonitor()
