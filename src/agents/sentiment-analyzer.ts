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

export class SentimentAnalyzer extends BaseAgent {
  config: AgentConfig = {
    name: 'sentiment-analyzer',
    category: 'trading',
    description: 'Analyze market sentiment from multiple sources',
    version: '1.0.0',
    schedule: '*/15 * * * *', // Every 15 minutes
    timeout: 20000,
  }

  private symbols = ['BTC', 'ETH', 'ADA', 'SOL', 'XRP']
  private sentimentHistory: Map<string, SentimentData[]> = new Map()

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
  ]

  private bearishKeywords = [
    'bearish',
    'crash',
    'dump',
    'decline',
    'selloff',
    'regulation',
    'hack',
    'fraud',
    'bearish',
    'correction',
  ]

  async execute(): Promise<any> {
    this.logger.info(`Analyzing sentiment for ${this.symbols.length} cryptocurrencies...`)

    try {
      // Analyze sentiment from multiple sources
      const signals = await this.analyzeSentiment()

      // Publish signals
      if (signals.length > 0) {
        for (const signal of signals) {
          const sentiment = signal.overallSentiment > 0 ? '📈 BULLISH' : '📉 BEARISH'
          this.logger.warn(`${sentiment}: ${signal.message}`)
          await this.publishEvent('sentiment-signal', signal)
        }
      }

      this.logger.info(
        `✅ Sentiment analysis complete: Analyzed ${signals.length} symbols`
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
    const signals: SentimentSignal[] = []

    for (const symbol of this.symbols) {
      // Initialize sentiment history
      if (!this.sentimentHistory.has(symbol)) {
        this.sentimentHistory.set(symbol, [])
      }

      // Simulate sentiment data from multiple sources
      const sentimentDataList = this.generateSentimentData(symbol)

      // Store in history
      const history = this.sentimentHistory.get(symbol)!
      sentimentDataList.forEach((data) => history.push(data))

      // Keep last 50 records
      if (history.length > 50) {
        history.splice(0, history.length - 50)
      }

      // Calculate aggregate sentiment
      const signal = this.calculateAggregateSentiment(symbol, history)
      if (signal) {
        signals.push(signal)
      }
    }

    return signals
  }

  private generateSentimentData(symbol: string): SentimentData[] {
    const sources = ['twitter', 'reddit', 'news', 'telegram']
    const data: SentimentData[] = []

    for (const source of sources) {
      // Simulate sentiment analysis (in production would parse real data)
      const sentiment = this.simulateSentiment()
      const keywords = this.extractKeywords(sentiment)

      data.push({
        source,
        symbol,
        sentiment,
        score: this.calculateSentimentScore(sentiment),
        keywords,
        timestamp: new Date(),
      })
    }

    return data
  }

  private simulateSentiment(): 'positive' | 'negative' | 'neutral' {
    const rand = Math.random()
    if (rand < 0.4) return 'positive'
    if (rand < 0.7) return 'neutral'
    return 'negative'
  }

  private calculateSentimentScore(sentiment: string): number {
    switch (sentiment) {
      case 'positive':
        return Math.random() * 0.5 + 0.5 // 0.5 to 1.0
      case 'negative':
        return Math.random() * 0.5 - 1.0 // -1.0 to -0.5
      default:
        return (Math.random() - 0.5) * 0.2 // -0.1 to 0.1
    }
  }

  private extractKeywords(
    sentiment: string
  ): string[] {
    const keywords: string[] = []

    if (sentiment === 'positive') {
      keywords.push(
        this.bullishKeywords[Math.floor(Math.random() * this.bullishKeywords.length)]
      )
    } else if (sentiment === 'negative') {
      keywords.push(
        this.bearishKeywords[Math.floor(Math.random() * this.bearishKeywords.length)]
      )
    }

    return keywords
  }

  private calculateAggregateSentiment(
    symbol: string,
    history: SentimentData[]
  ): SentimentSignal | null {
    if (history.length === 0) return null

    // Get recent sentiment (last 4 sources worth of data)
    const recent = history.slice(-4)

    const scores = recent.map((s) => s.score)
    const avgScore = scores.reduce((a, b) => a + b, 0) / scores.length

    const bullishCount = recent.filter((s) => s.sentiment === 'positive').length
    const bearishCount = recent.filter((s) => s.sentiment === 'negative').length

    // Generate signal if sentiment is strong
    if (Math.abs(avgScore) > 0.3) {
      const sentiment = avgScore > 0 ? 'bullish' : 'bearish'
      const strength = Math.min(Math.abs(avgScore), 1)

      return {
        symbol,
        overallSentiment: avgScore,
        sources: recent.length,
        bullishCount,
        bearishCount,
        message: `${symbol}: ${sentiment.toUpperCase()} sentiment (${(
          strength * 100
        ).toFixed(0)}% confidence, ${bullishCount} bullish, ${bearishCount} bearish)`,
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

      const testSentiment = this.simulateSentiment()
      if (!testSentiment) {
        throw new Error('Failed to generate sentiment data')
      }

      this.logger.info(`✅ Validation successful. Monitoring ${this.symbols.length} symbols`)
      return true
    } catch (error) {
      this.logger.error('Validation failed', error)
      return false
    }
  }

  async healthCheck(): Promise<boolean> {
    try {
      const sentiment = this.simulateSentiment()
      return !!sentiment
    } catch (error) {
      this.logger.error('Health check failed', error)
      return false
    }
  }
}
