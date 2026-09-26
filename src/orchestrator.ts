/**
 * Orchestrator System
 * Manages all agents, coordinates event flow, and handles inter-agent communication
 */

import { EventEmitter } from 'events'
import { BitcoinPriceMonitor } from './agents/bitcoin-price-monitor'
import { PortfolioTracker } from './agents/portfolio-tracker'
import { PumpDumpDetector } from './agents/pump-dump-detector'
import { dcaBot } from './agents/dca-bot'
import { Logger } from './logger'

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
    this.register('dca-bot', dcaBot, dcaBot.config.schedule || '0 9 */7 * *')

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
