/**
 * Unit tests for NewsMonitor
 * HTTP is stubbed. Verifies the monitor works from fetched data only, with no
 * mock/placeholder fallback, and that real headlines are classified sensibly.
 */

import { NewsMonitor } from '../src/agents/news-monitor'

const minutesAgo = (m: number) => new Date(Date.now() - m * 60 * 1000).toUTCString()

interface Story {
  title: string
  link?: string
  pubDate?: string
}

const rss = (stories: Story[]) =>
  `<?xml version="1.0"?><rss><channel>${stories
    .map(
      (s, i) =>
        `<item><title><![CDATA[${s.title}]]></title><link>${
          s.link ?? `https://example.com/story-${encodeURIComponent(s.title)}-${i}`
        }</link><pubDate>${s.pubDate ?? minutesAgo(10)}</pubDate></item>`
    )
    .join('')}</channel></rss>`

const MOCK_TITLES = [
  'Bitcoin Hits New All-Time High Amid Institutional Adoption',
  'Ethereum Technical Analysis Shows Bullish Breakout',
  'Regulatory Uncertainty Impacts Market',
]

type Feeds = { cointelegraph?: string | Error; decrypt?: string | Error; newsapi?: object | Error }

function stubHttp(agent: NewsMonitor, feeds: Feeds) {
  const calls: { url: string; headers?: any }[] = []
  jest.spyOn(agent as any, 'get').mockImplementation(async (...args: any[]) => {
    const [url, headers] = args as [string, any]
    calls.push({ url, headers })
    const key = url.includes('cointelegraph')
      ? 'cointelegraph'
      : url.includes('decrypt')
        ? 'decrypt'
        : 'newsapi'
    const value = feeds[key as keyof Feeds]
    if (value instanceof Error) throw value
    if (value === undefined) throw new Error(`no stub for ${key}`)
    return value
  })
  return calls
}

describe('NewsMonitor', () => {
  let agent: NewsMonitor
  let alerts: any[]
  let shifts: any[]

  beforeEach(() => {
    delete process.env.NEWS_API_KEY
    agent = new NewsMonitor()
    alerts = []
    shifts = []
    agent.on('news-alert', (a) => alerts.push(a))
    agent.on('news-sentiment-shift', (s) => shifts.push(s))
    jest.spyOn(agent.logger, 'warn').mockImplementation(() => undefined as any)
    jest.spyOn(agent.logger, 'error').mockImplementation(() => undefined as any)
  })

  afterEach(() => {
    jest.restoreAllMocks()
    delete process.env.NEWS_API_KEY
  })

  test('builds history from fetched headlines only', async () => {
    stubHttp(agent, {
      cointelegraph: rss([{ title: 'Bitcoin surges as ETF approval nears' }]),
      decrypt: rss([{ title: 'Solana outage prompts validator concern' }]),
    })

    await agent.execute()

    const titles = agent.getNewsHistory().map((n) => n.title)
    expect(titles).toHaveLength(2)
    expect(titles).toEqual(
      expect.arrayContaining(['Bitcoin surges as ETF approval nears', 'Solana outage prompts validator concern'])
    )
    const btc = agent.getNewsHistory().find((n) => n.title.startsWith('Bitcoin'))!
    expect(btc.sentiment).toBe('positive')
    expect(btc.source).toBe('Cointelegraph')
    expect(btc.relevantAssets).toEqual(['BTC'])
  })

  test('never produces the old hardcoded mock headlines', async () => {
    stubHttp(agent, { cointelegraph: new Error('down'), decrypt: new Error('down') })
    await expect(agent.execute()).rejects.toThrow()
    expect(agent.getNewsHistory().map((n) => n.title)).not.toEqual(expect.arrayContaining(MOCK_TITLES))
    expect(agent.getNewsHistory()).toHaveLength(0)
  })

  test('throws when every source is unavailable', async () => {
    stubHttp(agent, { cointelegraph: new Error('boom'), decrypt: new Error('boom') })
    await expect(agent.execute()).rejects.toThrow('All news sources are unavailable')
    expect(alerts).toHaveLength(0)
  })

  test('a feed that returns a non-RSS page counts as unavailable, not as "no news"', async () => {
    stubHttp(agent, {
      cointelegraph: '<html><body>Service unavailable</body></html>',
      decrypt: new Error('boom'),
    })
    await expect(agent.execute()).rejects.toThrow('All news sources are unavailable')
  })

  test('one failing source does not stop the others', async () => {
    stubHttp(agent, {
      cointelegraph: new Error('boom'),
      decrypt: rss([{ title: 'Cardano upgrade goes live' }]),
    })
    await agent.execute()
    expect(agent.getNewsHistory().map((n) => n.title)).toEqual(['Cardano upgrade goes live'])
  })

  test('a healthy feed with nothing new is not an error', async () => {
    stubHttp(agent, {
      cointelegraph: rss([{ title: 'Old story', pubDate: minutesAgo(600) }]),
      decrypt: rss([{ title: 'Another old story', pubDate: minutesAgo(900) }]),
    })
    await expect(agent.execute()).resolves.toBeUndefined()
    expect(agent.getNewsHistory()).toHaveLength(0)
  })

  test('stories seen on an earlier scan are not re-processed or re-alerted', async () => {
    const feed = rss([{ title: 'Exchange hacked for $40M, Bitcoin drops', link: 'https://example.com/hack' }])
    stubHttp(agent, { cointelegraph: feed, decrypt: rss([{ title: 'filler Ethereum rally' }]) })

    await agent.execute()
    const firstAlerts = alerts.length
    const firstHistory = agent.getNewsHistory().length
    expect(firstAlerts).toBe(1)

    await agent.execute()
    expect(alerts).toHaveLength(firstAlerts)
    expect(agent.getNewsHistory()).toHaveLength(firstHistory)
  })

  test('the same story from two sources is only counted once', async () => {
    const shared = 'https://example.com/shared'
    stubHttp(agent, {
      cointelegraph: rss([{ title: 'Bitcoin rallies', link: shared }]),
      decrypt: rss([{ title: 'Bitcoin rallies', link: shared }]),
    })
    await agent.execute()
    expect(agent.getNewsHistory()).toHaveLength(1)
  })

  test('stories older than the freshness window are ignored', async () => {
    stubHttp(agent, {
      cointelegraph: rss([
        { title: 'Fresh Bitcoin rally', pubDate: minutesAgo(30) },
        { title: 'Stale Ethereum hack', pubDate: minutesAgo(60 * 5) },
      ]),
      decrypt: rss([{ title: 'filler Solana upgrade' }]),
    })
    await agent.execute()
    const titles = agent.getNewsHistory().map((n) => n.title)
    expect(titles).toContain('Fresh Bitcoin rally')
    expect(titles).not.toContain('Stale Ethereum hack')
  })

  test('emits news-alert for high/critical items and news-sentiment-shift for the batch', async () => {
    stubHttp(agent, {
      cointelegraph: rss([
        { title: 'Ethereum bridge exploit drains $20M' }, // critical
        { title: 'SEC delays Bitcoin ETF ruling' }, // high
        { title: 'Solana quietly updates docs' }, // low
      ]),
      decrypt: rss([{ title: 'filler' }]),
    })

    await agent.execute()

    expect(alerts.map((a) => a.impact).sort()).toEqual(['critical', 'high'])
    expect(alerts.find((a) => a.impact === 'critical').assets).toEqual(['ETH'])
    expect(shifts).toHaveLength(1)
    expect(shifts[0].totalNewsItems).toBe(4)
    expect(shifts[0].criticalCount).toBe(1)
  })

  describe('classifies real headlines without substring false positives', () => {
    const classify = async (title: string) => {
      const a = new NewsMonitor()
      jest.spyOn(a.logger, 'warn').mockImplementation(() => undefined as any)
      stubHttp(a, { cointelegraph: rss([{ title }]), decrypt: rss([{ title: 'filler story' }]) })
      await a.execute()
      return a.getNewsHistory().find((n) => n.title === title)!
    }

    test('"Bank" / "Banking" are not the keyword "ban"', async () => {
      for (const title of [
        'Kraken parent adds 24/7 dollar settlement with Singapore Gulf Bank',
        'Community banks sue OCC over trust bank charters of crypto firms',
        'Banking Group Sues to Block Crypto Side Door Into the Banking System',
      ]) {
        const item = await classify(title)
        expect(item.sentiment).toBe('neutral')
      }
    })

    test('"Bang" is not "ban"', async () => {
      const item = await classify("'Uptober' Off With a Bang as Bitcoin Surges to $86K")
      expect(item.sentiment).toBe('positive')
    })

    test('"Security" is not the SEC', async () => {
      const item = await classify("MetaMask Exits Lido Validators Amid 'Security Incident'")
      expect(item.impact).not.toBe('high')
      expect(item.impact).not.toBe('critical')
    })

    test('the actual SEC still counts', async () => {
      const item = await classify('SEC sues crypto lender over unregistered offering')
      expect(item.impact).toBe('high')
    })

    test('"Canada" is not the ticker ADA', async () => {
      const item = await classify('Canada approves new stablecoin framework')
      expect(item.relevantAssets).not.toContain('ADA')
    })

    test('real keyword forms still count: banned, hacked, exploiter', async () => {
      expect((await classify('Regulators banned the token overnight')).sentiment).toBe('negative')
      expect((await classify('Protocol hacked for $3.8M')).impact).toBe('critical')
      expect((await classify('Funds recovered from exploiter')).impact).toBe('critical')
    })
  })

  describe('NewsAPI is optional', () => {
    const newsApi = (articles: object[]) => ({ status: 'ok', articles })

    test('is not called when NEWS_API_KEY is unset', async () => {
      const calls = stubHttp(agent, {
        cointelegraph: rss([{ title: 'Bitcoin rally' }]),
        decrypt: rss([{ title: 'Ethereum rally' }]),
      })
      await agent.execute()
      expect(calls.some((c) => c.url.includes('newsapi.org'))).toBe(false)
    })

    test('is called with the key in a header (not the URL) when set, and its articles are used', async () => {
      process.env.NEWS_API_KEY = 'secret-key'
      const calls = stubHttp(agent, {
        cointelegraph: new Error('down'),
        decrypt: new Error('down'),
        newsapi: newsApi([
          {
            title: 'Polkadot parachain upgrade ships',
            url: 'https://news.example/dot',
            source: { name: 'Example Wire' },
            publishedAt: new Date(Date.now() - 20 * 60 * 1000).toISOString(),
            description: 'details',
          },
          { title: null, url: 'https://news.example/bad', publishedAt: new Date().toISOString() },
        ]),
      })

      await agent.execute()

      const call = calls.find((c) => c.url.includes('newsapi.org'))!
      expect(call.url).not.toContain('secret-key')
      expect(call.headers).toEqual({ 'X-Api-Key': 'secret-key' })
      const history = agent.getNewsHistory()
      expect(history).toHaveLength(1)
      expect(history[0]).toMatchObject({ source: 'Example Wire', relevantAssets: ['DOT'] })
    })
  })
})
