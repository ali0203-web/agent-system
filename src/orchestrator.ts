/**
 * Orchestrator System
 * Manages all agents, coordinates event flow, and handles inter-agent communication
 */

import { EventEmitter } from 'events'
import { BitcoinPriceMonitor } from './agents/bitcoin-price-monitor'
import { PortfolioTracker } from './agents/portfolio-tracker'
import { PumpDumpDetector } from './agents/pump-dump-detector'
import { dcaBot } from './agents/dca-bot'
import { newsMonitor } from './agents/news-monitor'
import { technicalAnalysis } from './agents/technical-analysis'
import { riskManagement } from './agents/risk-management'
import { gridTradingBot } from './agents/grid-trading-bot'
import { momentumTrader } from './agents/momentum-trader'
import { meanReversionBot } from './agents/mean-reversion-bot'
import { arbitrageBot } from './agents/arbitrage-bot'
import { scalpingBot } from './agents/scalping-bot'
import { volatilityTrader } from './agents/volatility-trader'
import { supportResistanceBot } from './agents/support-resistance-bot'
import { correlationTrader } from './agents/correlation-trader'
import { BollingerBandsBot } from './agents/bollinger-bands-bot'
import { MACDTrader } from './agents/macd-trader'
import { RSIBot } from './agents/rsi-bot'
import { VolumeProfileBot } from './agents/volume-profile-bot'
import { SentimentAnalyzer } from './agents/sentiment-analyzer'
import { IchimokuBot } from './agents/ichimoku-bot'
import { StochasticBot } from './agents/stochastic-bot'
import { ATRBot } from './agents/atr-bot'
import { MovingAverageBot } from './agents/moving-average-bot'
import { FibonacciBot } from './agents/fibonacci-bot'
import { PatternRecognitionBot } from './agents/pattern-recognition-bot'
import { OrderFlowBot } from './agents/order-flow-bot'
import { MarketRegimeBot } from './agents/market-regime-bot'
import { WhaleWatchBot } from './agents/whale-watch-bot'
import { MLPredictorBot } from './agents/ml-predictor-bot'
import { BollingerSqueezeBot } from './agents/bollinger-squeeze-bot'
import { KeltnerChannelBot } from './agents/keltner-channel-bot'
import { VWAPBounceBot } from './agents/vwap-bounce-bot'
import { SupportResistanceDynamicBot } from './agents/support-resistance-dynamic-bot'
import { MeanReversionOscillatorBot } from './agents/mean-reversion-oscillator-bot'
import { TrendStrengthBot } from './agents/trend-strength-bot'
import { VolumeSurgeBot } from './agents/volume-surge-bot'
import { CorrelationMatrixBot } from './agents/correlation-matrix-bot'
import { PositionSizerBot } from './agents/position-sizer-bot'
import { SignalAggregatorBot } from './agents/signal-aggregator-bot'
import { Logger } from './logger'
import { dbInit } from './services/database-init'

interface AgentRegistry {
  id: string
  name: string
  instance: any
  schedule: string
  lastRun?: Date
  nextRun?: Date
  isRunning: boolean
}

export class Orchestrator extends EventEmitter {
  private agents: Map<string, AgentRegistry> = new Map()
  private logger = new Logger('Orchestrator')
  private timers: Map<string, NodeJS.Timer> = new Map()
  private running = false

  constructor() {
    super()
    this.registerAgents()
  }

  /**
   * Register all agents
   */
  private registerAgents(): void {
    this.logger.info('📋 Registering agents...')

    // Agent #1: Bitcoin Price Monitor
    const bitcoinAgent = new BitcoinPriceMonitor()
    this.register('bitcoin-monitor', bitcoinAgent, bitcoinAgent.config.schedule || '*/5 * * * *')

    // Agent #2: Portfolio Tracker
    const portfolioAgent = new PortfolioTracker()
    this.register('portfolio-tracker', portfolioAgent, portfolioAgent.config.schedule || '*/15 * * * *')

    // Agent #3: Pump & Dump Detector
    const pumpDumpAgent = new PumpDumpDetector()
    this.register('pump-dump-detector', pumpDumpAgent, pumpDumpAgent.config.schedule || '*/5 * * * *')

    // Agent #4: DCA Bot
    this.register('dca-bot', dcaBot, '0 9 */7 * *')

    // Agent #5: News Monitor
    this.register('news-monitor', newsMonitor, '*/30 * * * *')

    // Agent #6: Technical Analysis
    this.register('technical-analysis', technicalAnalysis, '*/15 * * * *')

    // Agent #7: Risk Management
    this.register('risk-management', riskManagement, '*/20 * * * *')

    // Agent #8: Grid Trading Bot
    this.register('grid-trading-bot', gridTradingBot, '*/10 * * * *')

    // Agent #9: Momentum Trader
    this.register('momentum-trader', momentumTrader, '*/5 * * * *')

    // Agent #10: Mean Reversion Bot
    this.register('mean-reversion-bot', meanReversionBot, '*/10 * * * *')

    // Agent #11: Arbitrage Bot
    this.register('arbitrage-bot', arbitrageBot, '*/7 * * * *')

    // Agent #12: Scalping Bot
    this.register('scalping-bot', scalpingBot, '*/3 * * * *')

    // Agent #13: Volatility Trader
    this.register('volatility-trader', volatilityTrader, '*/8 * * * *')

    // Agent #14: Support/Resistance Bot
    this.register('support-resistance-bot', supportResistanceBot, '*/15 * * * *')

    // Agent #15: Correlation Trader
    this.register('correlation-trader', correlationTrader, '*/12 * * * *')

    // Agent #16: Bollinger Bands Bot
    const bollingerAgent = new BollingerBandsBot()
    this.register('bollinger-bands-bot', bollingerAgent, bollingerAgent.config.schedule || '*/5 * * * *')

    // Agent #17: MACD Trader
    const macdAgent = new MACDTrader()
    this.register('macd-trader', macdAgent, macdAgent.config.schedule || '*/5 * * * *')

    // Agent #18: RSI Bot
    const rsiAgent = new RSIBot()
    this.register('rsi-bot', rsiAgent, rsiAgent.config.schedule || '*/5 * * * *')

    // Agent #19: Volume Profile Bot
    const volumeAgent = new VolumeProfileBot()
    this.register('volume-profile-bot', volumeAgent, volumeAgent.config.schedule || '*/5 * * * *')

    // Agent #20: Sentiment Analyzer
    const sentimentAgent = new SentimentAnalyzer()
    this.register('sentiment-analyzer', sentimentAgent, sentimentAgent.config.schedule || '*/15 * * * *')

    // Agent #21: Ichimoku Cloud Bot
    const ichimokuAgent = new IchimokuBot()
    this.register('ichimoku-bot', ichimokuAgent, ichimokuAgent.config.schedule || '*/5 * * * *')

    // Agent #22: Stochastic Oscillator Bot
    const stochasticAgent = new StochasticBot()
    this.register('stochastic-bot', stochasticAgent, stochasticAgent.config.schedule || '*/5 * * * *')

    // Agent #23: ATR Bot
    const atrAgent = new ATRBot()
    this.register('atr-bot', atrAgent, atrAgent.config.schedule || '*/5 * * * *')

    // Agent #24: Moving Average Bot
    const maBot = new MovingAverageBot()
    this.register('moving-average-bot', maBot, maBot.config.schedule || '*/5 * * * *')

    // Agent #25: Fibonacci Bot
    const fibAgent = new FibonacciBot()
    this.register('fibonacci-bot', fibAgent, fibAgent.config.schedule || '*/10 * * * *')

    // Agent #26: Pattern Recognition Bot
    const patternAgent = new PatternRecognitionBot()
    this.register('pattern-recognition-bot', patternAgent, patternAgent.config.schedule || '*/10 * * * *')

    // Agent #27: Order Flow Bot
    const orderFlowAgent = new OrderFlowBot()
    this.register('order-flow-bot', orderFlowAgent, orderFlowAgent.config.schedule || '*/5 * * * *')

    // Agent #28: Market Regime Bot
    const regimeAgent = new MarketRegimeBot()
    this.register('market-regime-bot', regimeAgent, regimeAgent.config.schedule || '*/15 * * * *')

    // Agent #29: Whale Watch Bot
    const whaleAgent = new WhaleWatchBot()
    this.register('whale-watch-bot', whaleAgent, whaleAgent.config.schedule || '*/10 * * * *')

    // Agent #30: ML Predictor Bot
    const mlAgent = new MLPredictorBot()
    this.register('ml-predictor-bot', mlAgent, mlAgent.config.schedule || '*/15 * * * *')

    // Agent #31: Bollinger Bands Squeeze Bot
    const squeezeAgent = new BollingerSqueezeBot()
    this.register('bollinger-squeeze-bot', squeezeAgent, squeezeAgent.config.schedule || '*/5 * * * *')

    // Agent #32: Keltner Channel Bot
    const keltnerAgent = new KeltnerChannelBot()
    this.register('keltner-channel-bot', keltnerAgent, keltnerAgent.config.schedule || '*/5 * * * *')

    // Agent #33: VWAP Bounce Bot
    const vwapAgent = new VWAPBounceBot()
    this.register('vwap-bounce-bot', vwapAgent, vwapAgent.config.schedule || '*/5 * * * *')

    // Agent #34: Support/Resistance Dynamic Bot
    const srDynamicAgent = new SupportResistanceDynamicBot()
    this.register('support-resistance-dynamic-bot', srDynamicAgent, srDynamicAgent.config.schedule || '*/10 * * * *')

    // Agent #35: Mean Reversion Oscillator Bot
    const reversionOscAgent = new MeanReversionOscillatorBot()
    this.register('mean-reversion-oscillator-bot', reversionOscAgent, reversionOscAgent.config.schedule || '*/5 * * * *')

    // Agent #36: Trend Strength Bot
    const trendAgent = new TrendStrengthBot()
    this.register('trend-strength-bot', trendAgent, trendAgent.config.schedule || '*/15 * * * *')

    // Agent #37: Volume Surge Bot
    const volumeSurgeAgent = new VolumeSurgeBot()
    this.register('volume-surge-bot', volumeSurgeAgent, volumeSurgeAgent.config.schedule || '*/5 * * * *')

    // Agent #38: Correlation Matrix Bot
    const corrAgent = new CorrelationMatrixBot()
    this.register('correlation-matrix-bot', corrAgent, corrAgent.config.schedule || '*/15 * * * *')

    // Agent #39: Position Sizer Bot
    const positionAgent = new PositionSizerBot()
    this.register('position-sizer-bot', positionAgent, positionAgent.config.schedule || '*/10 * * * *')

    // Agent #40: Signal Aggregator Bot (Meta-Agent)
    const aggregatorAgent = new SignalAggregatorBot()
    this.register('signal-aggregator-bot', aggregatorAgent, aggregatorAgent.config.schedule || '*/15 * * * *')

    this.logger.info(`✅ Registered ${this.agents.size} agents`)
  }

  /**
   * Register an agent
   */
  private register(id: string, instance: any, schedule: string): void {
    this.agents.set(id, {
      id,
      name: instance.config.name,
      instance,
      schedule,
      isRunning: false,
    })
    this.logger.info(`  ✓ ${instance.config.name}`)

    // Setup event listeners for inter-agent communication
    this.setupEventListeners(instance, id)
  }

  /**
   * Setup event listeners for agent communication
   */
  private setupEventListeners(agent: any, agentId: string): void {
    agent.on('bitcoin-price-alert', (data: any) => {
      this.logger.warn(`🚨 [${agentId}] Bitcoin price alert:`, data)
      this.emit('bitcoin-price-alert', data)
    })

    agent.on('pump-dump-signal', (data: any) => {
      this.logger.warn(`🚨 [${agentId}] Pump/Dump signal:`, data)
      this.emit('pump-dump-signal', data)
    })

    agent.on('portfolio-updated', (data: any) => {
      this.logger.info(`💼 [${agentId}] Portfolio updated`, data)
      this.emit('portfolio-updated', data)
    })

    agent.on('portfolio-alert', (data: any) => {
      this.logger.warn(`⚠️  [${agentId}] Portfolio alert:`, data)
      this.emit('portfolio-alert', data)
    })

    agent.on('dca-purchase', (data: any) => {
      this.logger.info(`💰 [${agentId}] DCA purchase:`, data)
      this.emit('dca-purchase', data)
    })

    agent.on('dca-portfolio-updated', (data: any) => {
      this.logger.info(`📊 [${agentId}] DCA portfolio updated`, data)
      this.emit('dca-portfolio-updated', data)
    })

    agent.on('news-alert', (data: any) => {
      this.logger.warn(`📰 [${agentId}] News alert:`, data)
      this.emit('news-alert', data)
    })

    agent.on('news-sentiment-shift', (data: any) => {
      this.logger.info(`📊 [${agentId}] News sentiment shift`, data)
      this.emit('news-sentiment-shift', data)
    })

    agent.on('technical-signal', (data: any) => {
      this.logger.info(`📈 [${agentId}] Technical signal:`, data)
      this.emit('technical-signal', data)
    })

    agent.on('risk-alert', (data: any) => {
      this.logger.warn(`⚠️  [${agentId}] Risk alert:`, data)
      this.emit('risk-alert', data)
    })

    agent.on('portfolio-risk-update', (data: any) => {
      this.logger.info(`🎯 [${agentId}] Portfolio risk update`, data)
      this.emit('portfolio-risk-update', data)
    })

    agent.on('grid-buy-order', (data: any) => {
      this.logger.info(`📊 [${agentId}] Grid buy order:`, data)
      this.emit('grid-buy-order', data)
    })

    agent.on('grid-sell-order', (data: any) => {
      this.logger.info(`💰 [${agentId}] Grid sell order:`, data)
      this.emit('grid-sell-order', data)
    })

    agent.on('grid-summary', (data: any) => {
      this.logger.info(`📈 [${agentId}] Grid summary:`, data)
      this.emit('grid-summary', data)
    })

    agent.on('momentum-entry', (data: any) => {
      this.logger.info(`🚀 [${agentId}] Momentum entry:`, data)
      this.emit('momentum-entry', data)
    })

    agent.on('momentum-exit', (data: any) => {
      this.logger.info(`💰 [${agentId}] Momentum exit:`, data)
      this.emit('momentum-exit', data)
    })

    agent.on('reversion-entry', (data: any) => {
      this.logger.info(`🔄 [${agentId}] Reversion entry:`, data)
      this.emit('reversion-entry', data)
    })

    agent.on('reversion-exit', (data: any) => {
      this.logger.info(`💰 [${agentId}] Reversion exit:`, data)
      this.emit('reversion-exit', data)
    })
  }

  /**
   * Start the orchestrator
   */
  async start(): Promise<void> {
    if (this.running) {
      this.logger.warn('Orchestrator is already running')
      return
    }

    this.running = true
    this.logger.info('🚀 Starting Orchestrator...')

    // Run all agents immediately on start
    await this.runAllAgents()

    // Schedule agents
    this.scheduleAgents()

    this.logger.info(`✅ Orchestrator started with ${this.agents.size} agents`)
    this.emit('started')
  }

  /**
   * Run all agents once immediately
   */
  private async runAllAgents(): Promise<void> {
    const promises: Promise<void>[] = []

    for (const [id, registry] of this.agents) {
      promises.push(this.runAgent(id))
    }

    await Promise.allSettled(promises)
  }

  /**
   * Run a single agent
   */
  private async runAgent(agentId: string): Promise<void> {
    const registry = this.agents.get(agentId)
    if (!registry) {
      this.logger.error(`Agent not found: ${agentId}`)
      return
    }

    if (registry.isRunning) {
      this.logger.debug(`Agent already running: ${registry.name}`)
      return
    }

    try {
      registry.isRunning = true
      registry.lastRun = new Date()

      this.logger.info(`▶️  Running: ${registry.name}`)

      const startTime = Date.now()
      const result = await registry.instance.run()
      const duration = Date.now() - startTime

      this.logger.info(`✅ ${registry.name} completed in ${duration}ms`)

      // Save signal to database if agent generated one
      if (result.data && result.data.success) {
        try {
          await dbInit.createSignal(
            agentId,
            registry.name,
            result.data.signal || 'execution',
            {
              message: result.data.message || `${registry.name} executed successfully`,
              confidence: result.data.confidence || 0.5,
              symbol: result.data.symbol,
              data: result.data
            }
          )
        } catch (dbError) {
          this.logger.error(`Failed to save signal for ${registry.name}`, dbError)
        }
      }

      this.emit('agent-completed', {
        agentId,
        agentName: registry.name,
        success: result.data?.success !== false,
        duration,
        timestamp: new Date(),
      })
    } catch (error) {
      this.logger.error(`❌ ${registry.name} failed`, error)
      this.emit('agent-failed', {
        agentId,
        agentName: registry.name,
        error: error instanceof Error ? error.message : String(error),
        timestamp: new Date(),
      })
    } finally {
      registry.isRunning = false
    }
  }

  /**
   * Schedule agents based on cron expressions
   */
  private scheduleAgents(): void {
    const schedule = require('node-schedule')

    for (const [id, registry] of this.agents) {
      const job = schedule.scheduleJob(registry.schedule, async () => {
        await this.runAgent(id)
      })

      this.timers.set(id, job as any)
      this.logger.info(`📅 Scheduled ${registry.name}: ${registry.schedule}`)
    }
  }

  /**
   * Get orchestrator status
   */
  getStatus(): any {
    const agents: any[] = []

    for (const [id, registry] of this.agents) {
      agents.push({
        id: registry.id,
        name: registry.name,
        schedule: registry.schedule,
        isRunning: registry.isRunning,
        lastRun: registry.lastRun,
        nextRun: registry.nextRun,
      })
    }

    return {
      isRunning: this.running,
      agentCount: this.agents.size,
      agents,
      timestamp: new Date(),
    }
  }

  /**
   * Get metrics for all agents
   */
  async getMetrics(): Promise<any> {
    const metrics: any[] = []

    for (const [id, registry] of this.agents) {
      const agentMetrics = await registry.instance.getMetrics()
      metrics.push({
        agentId: id,
        agentName: registry.name,
        ...agentMetrics,
      })
    }

    return {
      orchestratorStatus: this.getStatus(),
      agentMetrics: metrics,
      timestamp: new Date(),
    }
  }

  /**
   * Stop the orchestrator
   */
  async stop(): Promise<void> {
    this.logger.info('🛑 Stopping Orchestrator...')

    // Clear all timers
    for (const timer of this.timers.values()) {
      if (timer) {
        clearInterval(timer as any)
      }
    }
    this.timers.clear()

    this.running = false
    this.logger.info('✅ Orchestrator stopped')
    this.emit('stopped')
  }
}

// Export singleton
export const orchestrator = new Orchestrator()
