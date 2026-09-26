# 🎯 QUICK-START AGENT TEMPLATES
## Copy-Paste Ready Code for 20+ Agent Types

---

## TEMPLATE 1: Simple Data Fetcher Agent

Use this for: Price monitors, weather, APIs, simple data collection

```typescript
// File: agents/simple-fetcher.ts

import axios from 'axios'
import { Agent } from './base'

export class SimpleFetcherAgent extends Agent {
  name = 'simple-fetcher'
  apiUrl: string
  updateInterval: number = 300000 // 5 minutes

  async execute() {
    try {
      const response = await axios.get(this.apiUrl)
      const data = response.data

      const result = {
        success: true,
        data,
        timestamp: new Date(),
        source: this.apiUrl,
      }

      // Save to database
      await this.db.insert('agent_results', result)
      
      // Emit event for other agents
      this.emit('data-fetched', result)

      return result
    } catch (error) {
      await this.handleError(error)
      return { success: false, error: error.message }
    }
  }

  async validate() {
    const response = await axios.get(this.apiUrl)
    return response.status === 200
  }
}

// Usage
const monitor = new SimpleFetcherAgent()
monitor.apiUrl = 'https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd'
await monitor.execute()
```

---

## TEMPLATE 2: Analysis Agent

Use this for: Processing data, generating insights, analytics

```typescript
// File: agents/analyzer.ts

export class AnalysisAgent extends Agent {
  name = 'analyzer'

  async execute(inputData: any) {
    // 1. Fetch raw data
    const rawData = await this.fetchData()

    // 2. Process & transform
    const processed = this.transformData(rawData)

    // 3. Analyze patterns
    const patterns = this.findPatterns(processed)

    // 4. Generate insights
    const insights = await this.generateInsights(patterns)

    // 5. Create alerts if needed
    const alerts = this.createAlerts(insights)

    return {
      rawDataPoints: rawData.length,
      patterns: patterns,
      insights: insights,
      alerts: alerts,
      timestamp: new Date(),
    }
  }

  private transformData(data: any[]) {
    return data
      .map(item => ({
        ...item,
        normalized: this.normalize(item.value),
        change: this.calculateChange(item),
      }))
      .filter(item => item.value !== null)
  }

  private findPatterns(data: any[]) {
    return {
      trend: this.detectTrend(data),
      anomalies: this.detectAnomalies(data),
      peaks: this.findPeaks(data),
      valleys: this.findValleys(data),
    }
  }

  private async generateInsights(patterns: any) {
    const prompt = `
    Analyze these patterns and provide 3 key insights:
    ${JSON.stringify(patterns)}
    `

    return await this.callClaude(prompt)
  }
}
```

---

## TEMPLATE 3: Alerting Agent

Use this for: Notifications, monitoring thresholds, triggers

```typescript
// File: agents/alerter.ts

export class AlertingAgent extends Agent {
  name = 'alerter'
  thresholds = {
    priceChange: 5,      // 5%
    volumeSpike: 2,      // 2x
    errorRate: 0.01,     // 1%
  }

  async execute(data: any) {
    const alerts = []

    // Check price changes
    if (Math.abs(data.priceChange) > this.thresholds.priceChange) {
      alerts.push({
        type: 'PRICE_ALERT',
        severity: 'high',
        message: `Price changed ${data.priceChange}%`,
        data,
      })
    }

    // Check volume spikes
    if (data.volumeRatio > this.thresholds.volumeSpike) {
      alerts.push({
        type: 'VOLUME_ALERT',
        severity: 'medium',
        message: `Volume spike detected: ${data.volumeRatio}x`,
        data,
      })
    }

    // Send alerts
    for (const alert of alerts) {
      await this.sendAlert(alert)
    }

    return alerts
  }

  private async sendAlert(alert: any) {
    // Option 1: Email
    await this.email.send({
      to: 'user@example.com',
      subject: `⚠️ ${alert.type}`,
      body: alert.message,
    })

    // Option 2: Webhook
    await axios.post('https://webhook.example.com', alert)

    // Option 3: Slack
    await this.slack.post({
      channel: '#alerts',
      text: `${alert.severity}: ${alert.message}`,
    })

    // Option 4: Database
    await this.db.insert('alerts', alert)
  }
}
```

---

## TEMPLATE 4: Data Processing Pipeline Agent

Use this for: ETL, data transformation, batch processing

```typescript
// File: agents/processor.ts

export class DataProcessingAgent extends Agent {
  name = 'data-processor'

  async execute() {
    const startTime = Date.now()

    try {
      // Extract
      const rawData = await this.extract()
      console.log(`Extracted ${rawData.length} records`)

      // Transform
      const transformed = await this.transform(rawData)
      console.log(`Transformed to ${transformed.length} records`)

      // Load
      const result = await this.load(transformed)
      console.log(`Loaded ${result.inserted} records`)

      return {
        status: 'success',
        extracted: rawData.length,
        transformed: transformed.length,
        loaded: result.inserted,
        duration: Date.now() - startTime,
      }
    } catch (error) {
      console.error('Pipeline error:', error)
      return { status: 'failed', error: error.message }
    }
  }

  private async extract() {
    // Get data from API, DB, or file
    const response = await axios.get('https://api.example.com/data')
    return response.data
  }

  private async transform(data: any[]) {
    return Promise.all(
      data.map(async (item) => ({
        id: item.id,
        name: item.name.trim().toLowerCase(),
        value: parseFloat(item.value),
        processed: new Date(),
        hash: this.generateHash(item),
      }))
    )
  }

  private async load(data: any[]) {
    // Batch insert for efficiency
    const batchSize = 1000
    let inserted = 0

    for (let i = 0; i < data.length; i += batchSize) {
      const batch = data.slice(i, i + batchSize)
      await this.db.insert('processed_data', batch)
      inserted += batch.length
    }

    return { inserted }
  }
}
```

---

## TEMPLATE 5: Machine Learning Prediction Agent

Use this for: Forecasting, anomaly detection, scoring

```typescript
// File: agents/ml-predictor.ts

export class MLPredictorAgent extends Agent {
  name = 'ml-predictor'
  model: any  // Loaded ML model

  async execute(inputData: any) {
    try {
      // Prepare features
      const features = this.extractFeatures(inputData)

      // Predict
      const prediction = this.model.predict([features])

      // Get confidence
      const confidence = this.getConfidence(prediction)

      // Generate explanation
      const explanation = await this.explainPrediction(prediction, inputData)

      return {
        prediction: prediction[0],
        confidence,
        explanation,
        features,
        timestamp: new Date(),
      }
    } catch (error) {
      return { error: error.message }
    }
  }

  private extractFeatures(data: any) {
    return [
      data.price,
      data.volume,
      data.marketCap,
      data.priceChange24h,
      data.volumeChange24h,
      // ... more features
    ]
  }

  private getConfidence(prediction: any) {
    // Returns 0-1 confidence score
    return Math.max(...prediction)
  }

  private async explainPrediction(prediction: any, inputData: any) {
    const prompt = `
    Given input: ${JSON.stringify(inputData)}
    Prediction: ${prediction}
    
    Explain in 1-2 sentences why this prediction was made.
    `

    return await this.callClaude(prompt)
  }
}
```

---

## TEMPLATE 6: Orchestration/Router Agent

Use this for: Coordinating multiple agents, workflows

```typescript
// File: agents/orchestrator.ts

export class OrchestratorAgent extends Agent {
  name = 'orchestrator'

  async execute(input: any) {
    const results = {}

    // Step 1: Get market data
    const marketData = await this.callAgent('market-analyzer', input)
    results.market = marketData

    // Step 2: Analyze sentiment
    const sentiment = await this.callAgent('sentiment-analyzer', {
      ticker: input.ticker,
    })
    results.sentiment = sentiment

    // Step 3: Run ML prediction
    const prediction = await this.callAgent('ml-predictor', {
      ...marketData,
      ...sentiment,
    })
    results.prediction = prediction

    // Step 4: Generate trading signal
    const signal = await this.synthesizeSignal(results)

    // Step 5: Execute if signal is strong
    if (signal.confidence > 0.8) {
      await this.callAgent('trade-executor', signal)
    }

    return {
      signal,
      allResults: results,
      executed: signal.confidence > 0.8,
    }
  }

  private async synthesizeSignal(results: any) {
    const prompt = `
    Based on these analyses:
    - Market: ${JSON.stringify(results.market)}
    - Sentiment: ${JSON.stringify(results.sentiment)}
    - Prediction: ${JSON.stringify(results.prediction)}
    
    Generate a trading signal (BUY, SELL, HOLD) with confidence 0-1.
    `

    const response = await this.callClaude(prompt)
    return this.parseSignal(response)
  }
}
```

---

## TEMPLATE 7: Content Generation Agent

Use this for: Writing, creation, generation tasks

```typescript
// File: agents/content-generator.ts

export class ContentGeneratorAgent extends Agent {
  name = 'content-generator'

  async execute(params: any) {
    const { contentType, topic, audience, tone } = params

    const prompt = this.buildPrompt(contentType, topic, audience, tone)

    const content = await this.callClaude(prompt)

    // Improve content with iteration
    const improved = await this.improveContent(content, audience)

    // Add metadata
    const enriched = {
      content: improved,
      wordCount: improved.split(' ').length,
      readingTime: Math.ceil(improved.split(' ').length / 200),
      generatedAt: new Date(),
      model: 'claude-sonnet',
    }

    return enriched
  }

  private buildPrompt(
    contentType: string,
    topic: string,
    audience: string,
    tone: string
  ) {
    return `
    Create a ${contentType} about ${topic}.
    
    Audience: ${audience}
    Tone: ${tone}
    
    Requirements:
    - Clear and engaging
    - Well-structured
    - Actionable if applicable
    - SEO-friendly if applicable
    `
  }

  private async improveContent(content: string, audience: string) {
    const improvementPrompt = `
    Improve this content for ${audience}:
    ${content}
    
    Focus on clarity, engagement, and value.
    `

    return await this.callClaude(improvementPrompt)
  }
}
```

---

## TEMPLATE 8: Real-Time Monitoring Agent

Use this for: Health checks, monitoring, continuous watching

```typescript
// File: agents/monitor.ts

export class MonitoringAgent extends Agent {
  name = 'monitor'
  targets = [
    'https://api.example.com/health',
    'https://app.example.com',
    'https://db.example.com:5432',
  ]

  async execute() {
    const results = await Promise.all(
      this.targets.map(target => this.checkTarget(target))
    )

    const summary = {
      totalTargets: this.targets.length,
      healthy: results.filter(r => r.healthy).length,
      unhealthy: results.filter(r => !r.healthy).length,
      uptime: (results.filter(r => r.healthy).length / results.length) * 100,
      details: results,
      timestamp: new Date(),
    }

    // Alert if issues
    if (summary.unhealthy > 0) {
      await this.alertOnFailure(summary)
    }

    return summary
  }

  private async checkTarget(url: string) {
    const startTime = Date.now()

    try {
      const response = await axios.get(url, { timeout: 5000 })
      return {
        url,
        healthy: response.status < 400,
        status: response.status,
        responseTime: Date.now() - startTime,
        error: null,
      }
    } catch (error) {
      return {
        url,
        healthy: false,
        status: null,
        responseTime: Date.now() - startTime,
        error: error.message,
      }
    }
  }

  private async alertOnFailure(summary: any) {
    const unhealthy = summary.details.filter((r: any) => !r.healthy)
    
    await this.email.send({
      subject: `⚠️ ${unhealthy.length} targets down!`,
      body: JSON.stringify(unhealthy, null, 2),
    })
  }
}
```

---

## QUICK-START: Use These Templates

```bash
# 1. Create new agent from template
cp templates/simple-fetcher.ts agents/my-price-monitor.ts

# 2. Customize
# - Change apiUrl
# - Change updateInterval
# - Change alert thresholds

# 3. Test locally
npm run test agents/my-price-monitor.ts

# 4. Deploy
npm run deploy

# 5. Monitor
npm run logs agents/my-price-monitor
```

---

## BASE AGENT CLASS

```typescript
// File: agents/base.ts

import { EventEmitter } from 'events'

export abstract class Agent extends EventEmitter {
  abstract name: string
  db: Database
  logger: Logger
  claude: ClaudeAPI

  constructor() {
    super()
    this.db = new Database()
    this.logger = new Logger(this.name)
    this.claude = new ClaudeAPI()
  }

  abstract execute(...args: any[]): Promise<any>

  async validate(): Promise<boolean> {
    return true
  }

  async healthCheck(): Promise<boolean> {
    return true
  }

  protected async callClaude(prompt: string) {
    return this.claude.complete(prompt)
  }

  protected async callAgent(agentName: string, data: any) {
    const agent = await this.db.getAgent(agentName)
    return agent.execute(data)
  }

  protected async handleError(error: any) {
    this.logger.error(error)
    await this.db.insert('errors', {
      agent: this.name,
      error: error.message,
      stack: error.stack,
      timestamp: new Date(),
    })
  }
}
```

---

## NEXT: Pick a Template!

Which agent type resonates most?
1. **Simple Fetcher** ← Start here (easiest)
2. **Data Processor**
3. **Alerting**
4. **Content Generator**
5. **ML Predictor**

Let's build your first agent! 🚀

