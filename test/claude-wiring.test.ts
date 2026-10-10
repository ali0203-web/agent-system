/**
 * Claude in the news monitor and sentiment analyzer: it improves classification when an
 * API key is set, and every failure falls back to the existing keyword scoring.
 * The Claude client is mocked; HTTP is stubbed like in the other agent tests.
 */

jest.mock('../src/claude-client', () => ({
  askClaudeJSON: jest.fn(),
  claudeConfigured: jest.fn(),
}))

import { askClaudeJSON, claudeConfigured } from '../src/claude-client'
import { NewsMonitor } from '../src/agents/news-monitor'
import { SentimentAnalyzer } from '../src/agents/sentiment-analyzer'

const ask = askClaudeJSON as jest.Mock
const configured = claudeConfigured as jest.Mock
const minutesAgo = (m: number) => new Date(Date.now() - m * 60 * 1000).toUTCString()

const rss = (titles: string[]) =>
  `<?xml version="1.0"?><rss><channel>${titles
    .map(
      (t, i) =>
        `<item><title><![CDATA[${t}]]></title><description><![CDATA[]]></description><link>https://example.com/${i}-${encodeURIComponent(t)}</link><pubDate>${minutesAgo(10 + i)}</pubDate></item>`
    )
    .join('')}</channel></rss>`

beforeEach(() => {
  ask.mockReset()
  configured.mockReset()
  delete process.env.NEWS_API_KEY
})
afterEach(() => jest.restoreAllMocks())

describe('SentimentAnalyzer with Claude', () => {
  const BTC = 'Bitcoin faces regulation concerns after exchange hack'
  const ETH = 'Ethereum upgrade launch drives surge in adoption'

  function setup(feedTitles: string[] = [BTC, ETH]) {
    const agent = new SentimentAnalyzer()
    jest.spyOn(agent.logger, 'warn').mockImplementation(() => undefined as any)
    jest.spyOn(agent as any, 'publishEvent').mockResolvedValue(undefined)
    jest.spyOn(agent as any, 'get').mockImplementation(async (...args: any[]) => {
      const url = args[0] as string
      if (url.includes('alternative.me')) return { data: [{ value: '50', value_classification: 'Neutral' }] }
      if (url.includes('coingecko.com')) return {}
      return rss(feedTitles)
    })
    return agent
  }
  const newsOf = (agent: any, symbol: string) =>
    (agent.sentimentHistory.get(symbol) as any[]).filter((d) => d.source === 'news').pop()

  test('without an API key Claude is never called and keyword scoring is used', async () => {
    configured.mockReturnValue(false)
    const agent = setup()
    await agent.execute()
    expect(ask).not.toHaveBeenCalled()
    expect(newsOf(agent, 'ETH').score).toBeGreaterThan(0) // keyword balance: upgrade/launch/surge/adoption
  })

  test('with a key, Claude\'s rating replaces the keyword score for symbols with headlines', async () => {
    configured.mockReturnValue(true)
    ask.mockResolvedValue({
      results: [
        { symbol: 'BTC', score: -0.7, keywords: ['hack', 'regulation'] },
        { symbol: 'ETH', score: 0.4, keywords: ['upgrade'] },
      ],
    })
    const agent = setup()
    await agent.execute()

    expect(ask).toHaveBeenCalledTimes(1)
    const prompt = ask.mock.calls[0][0] as string
    expect(prompt).toContain(BTC)
    expect(prompt).toContain(ETH)
    expect(newsOf(agent, 'BTC')).toMatchObject({ source: 'news', score: -0.7, sentiment: 'negative', keywords: ['hack', 'regulation'] })
    expect(newsOf(agent, 'ETH')).toMatchObject({ score: 0.4, sentiment: 'positive' })
  })

  test('only a symbol\'s own headlines are sent for it, and symbols with none are not asked about', async () => {
    configured.mockReturnValue(true)
    ask.mockResolvedValue({ results: [{ symbol: 'ETH', score: 0.2, keywords: [] }] })
    const agent = setup([ETH])
    await agent.execute()
    const prompt = ask.mock.calls[0][0] as string
    expect(prompt).toContain('ETH:')
    expect(prompt).not.toContain('BTC:')
    expect(newsOf(agent, 'BTC')).toBeUndefined()
  })

  test('scores are clamped and keywords capped; unknown symbols and non-finite scores are ignored', async () => {
    configured.mockReturnValue(true)
    ask.mockResolvedValue({
      results: [
        { symbol: 'BTC', score: 7, keywords: ['a', 'b', 'c', 'd', 'e'] },
        { symbol: 'DOGE', score: 0.9, keywords: [] },
        { symbol: 'ETH', score: Number.NaN, keywords: [] },
      ],
    })
    const agent = setup()
    await agent.execute()
    expect(newsOf(agent, 'BTC')).toMatchObject({ score: 1, keywords: ['a', 'b', 'c'] })
    expect(newsOf(agent, 'ETH').score).toBeGreaterThan(0) // NaN ignored: keyword scoring took over
    expect((agent as any).sentimentHistory.has('DOGE')).toBe(false)
  })

  test('a Claude failure falls back to keyword scoring and the run still succeeds', async () => {
    configured.mockReturnValue(true)
    ask.mockRejectedValue(new Error('401 invalid key'))
    const agent = setup()
    const result = await agent.execute()
    expect(result.success).toBe(true)
    expect(newsOf(agent, 'ETH').score).toBeGreaterThan(0)
    expect(newsOf(agent, 'BTC').score).toBeLessThan(0)
  })

  test('an unchanged headline set is not re-sent to Claude', async () => {
    configured.mockReturnValue(true)
    ask.mockResolvedValue({ results: [{ symbol: 'BTC', score: -0.5, keywords: [] }, { symbol: 'ETH', score: 0.5, keywords: [] }] })
    const agent = setup()
    await agent.execute()
    await agent.execute()
    expect(ask).toHaveBeenCalledTimes(1)
    expect(newsOf(agent, 'BTC').score).toBe(-0.5) // second run reused the rating
  })

  test('only the symbols whose headlines changed are re-asked', async () => {
    configured.mockReturnValue(true)
    ask.mockResolvedValue({ results: [{ symbol: 'BTC', score: -0.5, keywords: [] }, { symbol: 'ETH', score: 0.5, keywords: [] }] })
    const agent = setup()
    await agent.execute()

    jest.spyOn(agent as any, 'get').mockImplementation(async (...args: any[]) => {
      const url = args[0] as string
      if (url.includes('alternative.me')) return { data: [{ value: '50', value_classification: 'Neutral' }] }
      if (url.includes('coingecko.com')) return {}
      return rss([BTC, ETH, 'Ethereum network outage hits validators'])
    })
    ask.mockResolvedValueOnce({ results: [{ symbol: 'ETH', score: -0.2, keywords: [] }] })
    await agent.execute()
    expect(ask).toHaveBeenCalledTimes(2)
    expect(ask.mock.calls[1][0]).toContain('ETH:')
    expect(ask.mock.calls[1][0]).not.toContain('BTC:')
    expect(newsOf(agent, 'BTC').score).toBe(-0.5)
    expect(newsOf(agent, 'ETH').score).toBe(-0.2)
  })
})

describe('NewsMonitor with Claude', () => {
  const STORIES = ['Bitcoin ETF approval expected this week', 'Solana network hack drains exchange wallets']

  function setup() {
    const agent = new NewsMonitor()
    jest.spyOn(agent.logger, 'warn').mockImplementation(() => undefined as any)
    jest.spyOn(agent as any, 'get').mockImplementation(async (...args: any[]) => {
      const url = args[0] as string
      if (url.includes('cointelegraph')) return rss(STORIES)
      throw new Error('feed unavailable')
    })
    const alerts: any[] = []
    agent.on('news-alert', (a) => alerts.push(a))
    return { agent, alerts }
  }

  test('without a key: keyword classification, Claude not called', async () => {
    configured.mockReturnValue(false)
    const { agent } = setup()
    await agent.execute()
    expect(ask).not.toHaveBeenCalled()
    expect(agent.getNewsHistory().length).toBe(2)
  })

  test('with a key: Claude\'s sentiment, impact and assets are applied, and drive alerts', async () => {
    configured.mockReturnValue(true)
    // The monitor orders items as fetched; give a distinctive answer per item
    ask.mockImplementation(async (prompt: string) => {
      const lines = prompt.split('\n').filter((l) => /^\d+\./.test(l))
      return {
        results: lines.map((l) =>
          l.includes('Solana')
            ? { sentiment: 'negative', impact: 'critical', assets: ['SOL'] }
            : { sentiment: 'positive', impact: 'low', assets: ['BTC'] }
        ),
      }
    })
    const { agent, alerts } = setup()
    await agent.execute()

    expect(ask).toHaveBeenCalledTimes(1)
    const solana = agent.getNewsHistory().find((n) => n.title.includes('Solana'))!
    expect(solana).toMatchObject({ sentiment: 'negative', impact: 'critical', relevantAssets: ['SOL'] })
    expect(alerts.map((a) => a.title)).toEqual([solana.title]) // only the critical item alerts
  })

  test('a wrong number of results is rejected and keyword classification is used', async () => {
    configured.mockReturnValue(true)
    ask.mockResolvedValue({ results: [{ sentiment: 'positive', impact: 'low', assets: [] }] }) // 1 for 2 items
    const { agent } = setup()
    await agent.execute()
    const hack = agent.getNewsHistory().find((n) => n.title.includes('hack'))!
    expect(hack.sentiment).toBe('negative') // keyword rules: "hack"
    expect(hack.impact).toBe('critical')
  })

  test('a Claude failure falls back to keyword classification and the scan completes', async () => {
    configured.mockReturnValue(true)
    ask.mockRejectedValue(new Error('timeout'))
    const { agent, alerts } = setup()
    await expect(agent.execute()).resolves.toBeUndefined()
    expect(agent.getNewsHistory().length).toBe(2)
    expect(alerts.length).toBeGreaterThan(0)
  })
})
