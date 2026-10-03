import { BaseAgent, AgentConfig } from '../base-agent'

interface SentimentData {
  source: string
  symbol: string
  sentiment: 'positive' | 'negative' | 'neutral'
  score: number
  keywords: string[]
  timestamp: Date
}

interface SentimentSignal {
  symbol: string
  overallSentiment: number
  sources: number
  bullishCount: number
  bearishCount: number
  message: string
  timestamp: Date
}

interface NewsHeadline {
  title: string
  text: string
  publishedAt: Date
}

const FEAR_GREED_URL = 'https://api.alternative.me/fng/?limit=1'
const COINGECKO_COIN_URL = (id: string) =>
  `https://api.coingecko.com/api/v3/coins/${id}?localization=false&tickers=false&market_data=false&community_data=false&developer_data=false&sparkline=false`
const NEWS_FEEDS: { name: string; url: string }[] = [
  { name: 'cointelegraph', url: 'https://cointelegraph.com/rss' },
  { name: 'decrypt', url: 'https://decrypt.co/feed' },
]

// Only headlines published within this window count towards the news score.
const NEWS_MAX_AGE_MS = 24 * 60 * 60 * 1000
// Scores within +/- this band are labelled neutral.
const NEUTRAL_BAND = 0.1
// A signal is only emitted when the weighted score is stronger than this.
const SIGNAL_THRESHOLD = 0.3

/**
 * Sentiment from real, keyless sources:
 *  - news: crypto headlines (RSS), scored per symbol by keyword balance
 *  - coingecko-votes: CoinGecko's per-coin community bullish/bearish vote share
 *  - fear-greed: alternative.me Crypto Fear & Greed Index (market-wide)
 *
 * A source that fails is skipped. If every source fails the run throws rather
 * than inventing data.
 */
export class SentimentAnalyzer extends BaseAgent {
  config: AgentConfig = {
    name: 'sentiment-analyzer',
    category: 'trading',
    description: 'Analyze market sentiment from multiple sources',
    version: '2.0.0',
    schedule: '*/15 * * * *', // Every 15 minutes
    timeout: 20000,
  }

  private symbols = ['BTC', 'ETH', 'ADA', 'SOL', 'XRP']
  private sentimentHistory: Map<string, SentimentData[]> = new Map()

  private coingeckoIds: Record<string, string> = {
    BTC: 'bitcoin',
    ETH: 'ethereum',
    ADA: 'cardano',
    SOL: 'solana',
    XRP: 'ripple',
  }

  // Names matched case-insensitively; tickers matched case-sensitively.
  private assetNames: Record<string, string[]> = {
    BTC: ['bitcoin'],
    ETH: ['ethereum', 'ether'],
    ADA: ['cardano'],
    SOL: ['solana'],
    XRP: ['ripple'],
  }

  // The Fear & Greed Index is market-wide, so it counts for less than data
  // that is specific to the symbol.
  private sourceWeights: Record<string, number> = {
    news: 1,
    'coingecko-votes': 1,
    'fear-greed': 0.5,
  }

  // Matched as word prefixes, so "surge" also matches "surges" and "surged".
  private bullishKeywords = [
    'bullish',
    'breakout',
    'moon',
    'pump',
    'surge',
    'rally',
    'partnership',
    'adoption',
    'gains',
    'momentum',
    'approval',
    'approves',
    'launch',
    'upgrade',
    'record high',
    'all-time high',
  ]

  private bearishKeywords = [
    'bearish',
    'crash',
    'dump',
    'decline',
    'selloff',
    'sell-off',
    'regulation',
    'hack',
    'exploit',
    'fraud',
    'lawsuit',
    'correction',
    'plunge',
    'collapse',
  ]

  async execute(): Promise<any> {
    this.logger.info(`Analyzing sentiment for ${this.symbols.length} cryptocurrencies...`)

    try {
      const signals = await this.analyzeSentiment()

      for (const signal of signals) {
        const sentiment = signal.overallSentiment > 0 ? '📈 BULLISH' : '📉 BEARISH'
        this.logger.warn(`${sentiment}: ${signal.message}`)
        await this.publishEvent('sentiment-signal', signal)
      }

      this.logger.info(
        `✅ Sentiment analysis complete: ${signals.length} signal(s) across ${this.symbols.length} symbols`
      )

      return {
        success: true,
        signalCount: signals.length,
        signals,
        timestamp: new Date(),
      }
    } catch (error) {
      this.logger.error('Failed to analyze sentiment', error)
      throw error
    }
  }

  private async analyzeSentiment(): Promise<SentimentSignal[]> {
    const [fearGreed, headlines] = await Promise.all([
      this.fetchFearGreed(),
      this.fetchHeadlines(),
    ])

    const signals: SentimentSignal[] = []
    let dataPoints = 0
    let coingeckoAttempts = 0
    let coingeckoFailures = 0

    for (const symbol of this.symbols) {
      if (!this.sentimentHistory.has(symbol)) {
        this.sentimentHistory.set(symbol, [])
      }

      const current: SentimentData[] = []

      const news = this.scoreNews(symbol, headlines)
      if (news) current.push(news)

      coingeckoAttempts++
      const votes = await this.fetchCoinGeckoVotes(symbol)
      if (votes) current.push(votes)
      else coingeckoFailures++

      if (fearGreed) {
        current.push({ ...fearGreed, symbol, timestamp: new Date() })
      }

      dataPoints += current.length

      const history = this.sentimentHistory.get(symbol)!
      history.push(...current)
      if (history.length > 50) {
        history.splice(0, history.length - 50)
      }

      const signal = this.calculateAggregateSentiment(symbol, current)
      if (signal) {
        signals.push(signal)
      }
    }

    if (dataPoints === 0) {
      throw new Error('All sentiment sources are unavailable')
    }
    if (coingeckoFailures === coingeckoAttempts) {
      this.logger.warn('CoinGecko community votes unavailable this run')
    }

    return signals
  }

  /** Market-wide Fear & Greed Index mapped from 0..100 to -1..1. */
  private async fetchFearGreed(): Promise<SentimentData | null> {
    try {
      const response = await this.get(FEAR_GREED_URL)
      const value = Number(response?.data?.[0]?.value)
      if (!Number.isFinite(value) || value < 0 || value > 100) {
        throw new Error(`Unexpected Fear & Greed payload`)
      }
      return this.toSentimentData('fear-greed', '', (value - 50) / 50, [
        String(response.data[0].value_classification || '').toLowerCase(),
      ])
    } catch (error: any) {
      this.logger.warn(`Fear & Greed Index unavailable: ${error?.message || error}`)
      return null
    }
  }

  /** CoinGecko community vote share (percent bullish) mapped to -1..1. */
  private async fetchCoinGeckoVotes(symbol: string): Promise<SentimentData | null> {
    const id = this.coingeckoIds[symbol]
    if (!id) return null

    try {
      const response = await this.get(COINGECKO_COIN_URL(id), undefined, 1)
      const up = Number(response?.sentiment_votes_up_percentage)
      if (!Number.isFinite(up) || up < 0 || up > 100) {
        // CoinGecko omits votes for coins without enough of them.
        return null
      }
      return this.toSentimentData('coingecko-votes', symbol, (up - 50) / 50, [])
    } catch (error: any) {
      this.logger.warn(`CoinGecko votes unavailable for ${symbol}: ${error?.message || error}`)
      return null
    }
  }

  private async fetchHeadlines(): Promise<NewsHeadline[]> {
    const results = await Promise.all(
      NEWS_FEEDS.map(async (feed) => {
        try {
          const xml = await this.get<string>(feed.url, { 'User-Agent': 'Mozilla/5.0' }, 1)
          return this.parseRss(typeof xml === 'string' ? xml : '')
        } catch (error: any) {
          this.logger.warn(`News feed ${feed.name} unavailable: ${error?.message || error}`)
          return []
        }
      })
    )

    const cutoff = Date.now() - NEWS_MAX_AGE_MS
    return results.flat().filter((h) => h.publishedAt.getTime() >= cutoff)
  }

  /** Minimal RSS 2.0 item extraction; avoids adding an XML dependency. */
  private parseRss(xml: string): NewsHeadline[] {
    const headlines: NewsHeadline[] = []
    const items = xml.match(/<item[\s>][\s\S]*?<\/item>/g) || []

    for (const item of items) {
      const title = this.cleanText(this.extractTag(item, 'title'))
      const description = this.cleanText(this.extractTag(item, 'description'))
      const pubDate = new Date(this.extractTag(item, 'pubDate'))

      if (!title || Number.isNaN(pubDate.getTime())) continue

      headlines.push({ title, text: `${title}. ${description}`, publishedAt: pubDate })
    }

    return headlines
  }

  private extractTag(xml: string, tag: string): string {
    const match = xml.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`))
    return match ? match[1] : ''
  }

  private cleanText(raw: string): string {
    return raw
      .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
      .replace(/<[^>]*>/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#0?39;|&apos;/g, "'")
      .replace(/\s+/g, ' ')
      .trim()
  }

  /**
   * Average the keyword balance of every recent headline that mentions the
   * symbol. Headlines with no sentiment keywords carry no signal and are
   * skipped rather than counted as neutral.
   */
  private scoreNews(symbol: string, headlines: NewsHeadline[]): SentimentData | null {
    const scores: number[] = []
    const keywords = new Set<string>()

    for (const headline of headlines) {
      if (!this.mentionsSymbol(headline.text, symbol)) continue

      const bullish = this.matchKeywords(headline.text, this.bullishKeywords)
      const bearish = this.matchKeywords(headline.text, this.bearishKeywords)
      const hits = bullish.length + bearish.length
      if (hits === 0) continue

      scores.push((bullish.length - bearish.length) / hits)
      bullish.concat(bearish).forEach((k) => keywords.add(k))
    }

    if (scores.length === 0) return null

    const average = scores.reduce((a, b) => a + b, 0) / scores.length
    return this.toSentimentData('news', symbol, average, [...keywords])
  }

  private mentionsSymbol(text: string, symbol: string): boolean {
    if (new RegExp(`\\b${symbol}\\b`).test(text)) return true
    const lower = text.toLowerCase()
    return (this.assetNames[symbol] || []).some((name) =>
      new RegExp(`\\b${name}\\b`).test(lower)
    )
  }

  private matchKeywords(text: string, keywords: string[]): string[] {
    const lower = text.toLowerCase()
    return keywords.filter((k) => new RegExp(`\\b${k.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')}`).test(lower))
  }

  private toSentimentData(
    source: string,
    symbol: string,
    score: number,
    keywords: string[]
  ): SentimentData {
    const clamped = Math.max(-1, Math.min(1, score))
    return {
      source,
      symbol,
      sentiment:
        clamped > NEUTRAL_BAND ? 'positive' : clamped < -NEUTRAL_BAND ? 'negative' : 'neutral',
      score: clamped,
      keywords: keywords.filter(Boolean),
      timestamp: new Date(),
    }
  }

  private calculateAggregateSentiment(
    symbol: string,
    current: SentimentData[]
  ): SentimentSignal | null {
    // Fear & Greed alone is one market reading, not per-symbol sentiment; it
    // only adjusts a signal that news or community votes already support.
    if (!current.some((d) => d.source !== 'fear-greed')) return null

    let weightedSum = 0
    let totalWeight = 0
    for (const data of current) {
      const weight = this.sourceWeights[data.source] ?? 1
      weightedSum += data.score * weight
      totalWeight += weight
    }
    const avgScore = weightedSum / totalWeight

    const bullishCount = current.filter((s) => s.sentiment === 'positive').length
    const bearishCount = current.filter((s) => s.sentiment === 'negative').length

    if (Math.abs(avgScore) > SIGNAL_THRESHOLD) {
      const sentiment = avgScore > 0 ? 'bullish' : 'bearish'
      const strength = Math.min(Math.abs(avgScore), 1)

      return {
        symbol,
        overallSentiment: avgScore,
        sources: current.length,
        bullishCount,
        bearishCount,
        message: `${symbol}: ${sentiment.toUpperCase()} sentiment (${(
          strength * 100
        ).toFixed(0)}% strength, ${bullishCount} bullish, ${bearishCount} bearish of ${
          current.length
        } sources: ${current.map((s) => s.source).join(', ')})`,
        timestamp: new Date(),
      }
    }

    return null
  }

  async validate(): Promise<boolean> {
    this.logger.info('Validating SentimentAnalyzer...')

    try {
      if (this.symbols.length === 0) {
        throw new Error('No symbols configured')
      }

      const unmapped = this.symbols.filter((s) => !this.coingeckoIds[s])
      if (unmapped.length > 0) {
        throw new Error(`No CoinGecko id configured for: ${unmapped.join(', ')}`)
      }

      this.logger.info(`✅ Validation successful. Monitoring ${this.symbols.length} symbols`)
      return true
    } catch (error) {
      this.logger.error('Validation failed', error)
      return false
    }
  }

  /** Healthy when at least one sentiment source is reachable. */
  async healthCheck(): Promise<boolean> {
    try {
      const [fearGreed, headlines] = await Promise.all([
        this.fetchFearGreed(),
        this.fetchHeadlines(),
      ])
      return fearGreed !== null || headlines.length > 0
    } catch (error) {
      this.logger.error('Health check failed', error)
      return false
    }
  }
}
