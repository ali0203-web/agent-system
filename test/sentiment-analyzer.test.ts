/**
 * Unit tests for SentimentAnalyzer
 * HTTP is stubbed; verifies scores come from the fetched data and that
 * failures never fall back to fabricated sentiment.
 */

import { SentimentAnalyzer } from '../src/agents/sentiment-analyzer'

const hoursAgo = (h: number) => new Date(Date.now() - h * 3600 * 1000).toUTCString()

const rss = (items: { title: string; description?: string; pubDate: string }[]) =>
  `<?xml version="1.0"?><rss><channel>${items
    .map(
      (i) =>
        `<item><title><![CDATA[${i.title}]]></title><description><![CDATA[<p>${
          i.description || ''
        }</p>]]></description><pubDate>${i.pubDate}</pubDate></item>`
    )
    .join('')}</channel></rss>`

interface Fixtures {
  fearGreed?: number | Error
  votesUp?: Record<string, number | Error>
  feed?: string | Error
}

function stubHttp(agent: SentimentAnalyzer, fx: Fixtures) {
  jest.spyOn(agent as any, 'get').mockImplementation(async (...args: any[]) => {
    const url = args[0] as string
    if (url.includes('alternative.me')) {
      if (fx.fearGreed instanceof Error) throw fx.fearGreed
      return { data: [{ value: String(fx.fearGreed ?? 50), value_classification: 'Neutral' }] }
    }
    if (url.includes('coingecko.com')) {
      const id = url.split('/coins/')[1].split('?')[0]
      const v = fx.votesUp?.[id]
      if (v instanceof Error) throw v
      return v === undefined ? {} : { sentiment_votes_up_percentage: v }
    }
    // RSS feeds: serve the same fixture for every feed
    if (fx.feed instanceof Error) throw fx.feed
    return fx.feed ?? rss([])
  })
  jest.spyOn(agent as any, 'publishEvent').mockResolvedValue(undefined)
}

describe('SentimentAnalyzer', () => {
  let agent: SentimentAnalyzer

  beforeEach(() => {
    agent = new SentimentAnalyzer()
    jest.spyOn(agent.logger, 'warn').mockImplementation(() => undefined as any)
    jest.spyOn(agent.logger, 'error').mockImplementation(() => undefined as any)
  })

  afterEach(() => jest.restoreAllMocks())

  test('does not use Math.random', async () => {
    const random = jest.spyOn(Math, 'random')
    stubHttp(agent, { fearGreed: 80, votesUp: { bitcoin: 90 } })
    await agent.execute()
    expect(random).not.toHaveBeenCalled()
  })

  test('bullish data produces a bullish signal and publishes it', async () => {
    stubHttp(agent, {
      fearGreed: 80,
      votesUp: { bitcoin: 90 },
      feed: rss([
        { title: 'Bitcoin surges to record high on ETF approval', pubDate: hoursAgo(1) },
      ]),
    })

    const result = await agent.execute()
    const btc = result.signals.find((s: any) => s.symbol === 'BTC')

    expect(btc).toBeDefined()
    expect(btc.overallSentiment).toBeGreaterThan(0.3)
    expect(btc.sources).toBe(3)
    expect(btc.bullishCount).toBe(3)
    expect((agent as any).publishEvent).toHaveBeenCalledWith(
      'sentiment-signal',
      expect.objectContaining({ symbol: 'BTC' })
    )
  })

  test('bearish data produces a bearish signal', async () => {
    stubHttp(agent, {
      fearGreed: 15,
      votesUp: { ethereum: 20 },
      feed: rss([
        { title: 'Ethereum plunges after exploit drains protocol', pubDate: hoursAgo(2) },
      ]),
    })

    const result = await agent.execute()
    const eth = result.signals.find((s: any) => s.symbol === 'ETH')

    expect(eth.overallSentiment).toBeLessThan(-0.3)
    expect(eth.bearishCount).toBeGreaterThanOrEqual(2)
  })

  test('mixed/neutral data produces no signal', async () => {
    stubHttp(agent, { fearGreed: 50, votesUp: { bitcoin: 52 } })
    const result = await agent.execute()
    expect(result.signalCount).toBe(0)
  })

  test('market-wide fear & greed alone does not signal every symbol', async () => {
    stubHttp(agent, { fearGreed: 95 })
    const result = await agent.execute()
    expect(result.signalCount).toBe(0)
  })

  test('headlines older than 24h are ignored', async () => {
    stubHttp(agent, {
      fearGreed: 50,
      feed: rss([{ title: 'Solana crashes in massive selloff', pubDate: hoursAgo(48) }]),
    })
    const result = await agent.execute()
    expect(result.signalCount).toBe(0)
    const history = (agent as any).sentimentHistory.get('SOL')
    expect(history.some((d: any) => d.source === 'news')).toBe(false)
  })

  test('headlines only count for the symbols they mention', async () => {
    stubHttp(agent, {
      feed: rss([{ title: 'Cardano rally continues on adoption surge', pubDate: hoursAgo(1) }]),
    })
    await agent.execute()
    const history = (agent as any).sentimentHistory
    expect(history.get('ADA').some((d: any) => d.source === 'news')).toBe(true)
    expect(history.get('BTC').some((d: any) => d.source === 'news')).toBe(false)
  })

  test('keywords match at the start of a word, not mid-word', () => {
    const match = (text: string, kws: string[]) => (agent as any).matchKeywords(text, kws)
    expect(match('Bitcoin surges again', ['surge'])).toEqual(['surge']) // inflections match
    expect(match('Bitcoin all-time high', ['all-time high'])).toEqual(['all-time high'])
    expect(match('the bank reopened', ['ank'])).toEqual([]) // not a substring match
  })

  test('a failing source is skipped; remaining sources still produce a signal', async () => {
    stubHttp(agent, {
      fearGreed: new Error('boom'),
      votesUp: { bitcoin: 95 },
      feed: new Error('feed down'),
    })
    const result = await agent.execute()
    const btc = result.signals.find((s: any) => s.symbol === 'BTC')
    expect(btc.sources).toBe(1)
    expect(btc.overallSentiment).toBeGreaterThan(0.3)
  })

  test('throws, rather than fabricating data, when every source fails', async () => {
    const down = new Error('network down')
    stubHttp(agent, { fearGreed: down, feed: down, votesUp: {
      bitcoin: down, ethereum: down, cardano: down, solana: down, ripple: down,
    } })
    await expect(agent.execute()).rejects.toThrow('All sentiment sources are unavailable')
  })

  test('coins CoinGecko has no votes for are skipped, not scored as neutral', async () => {
    stubHttp(agent, { fearGreed: 50 })
    await agent.execute()
    const history = (agent as any).sentimentHistory.get('BTC')
    expect(history.some((d: any) => d.source === 'coingecko-votes')).toBe(false)
  })

  test('fear & greed is weighted below symbol-specific sources', async () => {
    // F&G very bullish (+1) vs community votes very bearish (-1): votes weigh 1, F&G 0.5
    stubHttp(agent, { fearGreed: 100, votesUp: { bitcoin: 0 } })
    const result = await agent.execute()
    const btc = result.signals.find((s: any) => s.symbol === 'BTC')
    expect(btc.overallSentiment).toBeCloseTo((-1 * 1 + 1 * 0.5) / 1.5, 5)
  })

  test('validate passes and healthCheck reflects source reachability', async () => {
    expect(await agent.validate()).toBe(true)

    stubHttp(agent, { fearGreed: 50 })
    expect(await agent.healthCheck()).toBe(true)

    jest.restoreAllMocks()
    jest.spyOn(agent.logger, 'warn').mockImplementation(() => undefined as any)
    const down = new Error('down')
    stubHttp(agent, { fearGreed: down, feed: down })
    expect(await agent.healthCheck()).toBe(false)
  })
})
