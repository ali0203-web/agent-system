import { EventEmitter } from 'events'
import { v4 as uuidv4 } from 'uuid'
import axios from 'axios'
import { Logger } from './logger'
import { Database, DbUnavailableError, isConnectionError } from './database'
import { signalBus } from './signal-bus'

export interface AgentConfig {
  name: string
  category: string
  description: string
  version: string
  schedule?: string
  timeout?: number
  retries?: number
}

export interface AgentResult {
  agentId: string
  agentName: string
  success: boolean
  data?: any
  error?: string
  executedAt: Date
  executionTime: number
  nextRun?: Date
}

export abstract class BaseAgent extends EventEmitter {
  abstract config: AgentConfig
  id: string
  logger: Logger
  db: Database
  lastExecution?: Date
  lastError?: string

  constructor() {
    super()
    this.id = uuidv4()
    this.logger = new Logger('Agent')
    this.db = new Database()
  }

  /**
   * Main execution method - override in child classes
   */
  abstract execute(): Promise<any>

  /**
   * Health check - verify agent can run
   */
  async healthCheck(): Promise<boolean> {
    try {
      this.logger.debug('Running health check...')
      return true
    } catch (error) {
      this.logger.error('Health check failed', error)
      return false
    }
  }

  /**
   * Validate configuration
   */
  async validate(): Promise<boolean> {
    try {
      this.logger.debug('Validating agent configuration...')

      if (!this.config.name) {
        throw new Error('Agent name is required')
      }
      if (!this.config.category) {
        throw new Error('Agent category is required')
      }

      const isHealthy = await this.healthCheck()
      if (!isHealthy) {
        throw new Error('Health check failed')
      }

      this.logger.info('✅ Validation passed')
      return true
    } catch (error) {
      this.logger.error('❌ Validation failed:', error)
      return false
    }
  }

  /**
   * Run agent with error handling
   */
  async run(): Promise<AgentResult> {
    const startTime = Date.now()
    const executedAt = new Date()

    try {
      this.logger.info(`🚀 Starting execution...`)

      const data = await this.execute()

      const executionTime = Date.now() - startTime

      const result: AgentResult = {
        agentId: this.id,
        agentName: this.config.name,
        success: true,
        data,
        executedAt,
        executionTime,
      }

      this.lastExecution = executedAt
      this.lastError = undefined

      this.logger.info(`✅ Execution completed in ${executionTime}ms`)

      // Save to database
      await this.saveResult(result)

      // Emit event
      this.emit('execution-success', result)

      return result
    } catch (error) {
      const executionTime = Date.now() - startTime
      const errorMessage = error instanceof Error ? error.message : String(error)

      const result: AgentResult = {
        agentId: this.id,
        agentName: this.config.name,
        success: false,
        error: errorMessage,
        executedAt,
        executionTime,
      }

      this.lastExecution = executedAt
      this.lastError = errorMessage

      this.logger.error(`❌ Execution failed: ${errorMessage}`)

      // Save error to database
      await this.saveResult(result)

      // Emit event
      this.emit('execution-error', result)

      throw error
    }
  }

  /**
   * Call another agent
   */
  async callAgent(agentName: string, data?: any): Promise<any> {
    this.logger.debug(`Calling agent: ${agentName}`)

    try {
      const agent = await this.db.getAgent(agentName)
      if (!agent) {
        throw new Error(`Agent not found: ${agentName}`)
      }

      // In production, this would execute the agent
      // For now, we'll emit an event that the orchestrator listens to
      return new Promise((resolve) => {
        this.emit('call-agent', { agentName, data, resolve })
      })
    } catch (error) {
      this.logger.error(`Failed to call agent ${agentName}`, error)
      throw error
    }
  }

  /**
   * Publish event for other agents
   */
  async publishEvent(eventName: string, data: any): Promise<void> {
    this.logger.debug(`Publishing event: ${eventName}`)

    // Record in the in-memory signal bus first so consumers (e.g. the Signal
    // Aggregator) still see it when the database is unavailable.
    signalBus.record(this.config.name, eventName, data)

    try {
      await this.db.publishEvent(eventName, data)
    } catch (error) {
      // Persisting the event is best-effort: a database problem must not abort
      // the agent's run (the signal bus above already has the event).
      if (!(error instanceof DbUnavailableError) && !isConnectionError(error)) {
        this.logger.warn(`Failed to persist event ${eventName}: ${(error as Error)?.message ?? error}`)
      }
    }

    this.emit('event-published', { eventName, data })
  }

  /**
   * Subscribe to event
   */
  async subscribeToEvent(eventName: string, callback: (data: any) => Promise<void>): Promise<void> {
    this.logger.debug(`Subscribing to event: ${eventName}`)

    try {
      await this.db.subscribeToEvent(eventName, callback)
      this.logger.info(`Subscribed to ${eventName}`)
    } catch (error) {
      this.logger.error(`Failed to subscribe to event ${eventName}`, error)
      throw error
    }
  }

  /**
   * Save result to database
   */
  protected async saveResult(result: AgentResult): Promise<void> {
    try {
      await this.db.insert('agent_results', {
        agent_id: result.agentId,
        agent_name: result.agentName,
        success: result.success,
        data: result.data,
        error: result.error,
        executed_at: result.executedAt.toISOString(),
        execution_time: result.executionTime,
      })
    } catch (error) {
      if (!(error instanceof DbUnavailableError) && !isConnectionError(error)) {
        this.logger.error('Failed to save result to database', error)
      }
    }
  }

  /**
   * Get metrics
   */
  async getMetrics() {
    try {
      const results = await this.db.query(
        `SELECT COUNT(*) as total,
                SUM(CASE WHEN success = true THEN 1 ELSE 0 END) as successful,
                AVG(execution_time) as avg_execution_time
         FROM agent_results
         WHERE agent_id = $1
         AND executed_at > NOW() - INTERVAL '24 hours'`,
        [this.id]
      )

      return {
        agentId: this.id,
        agentName: this.config.name,
        lastExecution: this.lastExecution,
        lastError: this.lastError,
        metrics: results.rows[0],
      }
    } catch (error) {
      this.logger.error('Failed to get metrics', error)
      return null
    }
  }

  /**
   * HTTP GET request helper with retry logic for rate limiting
   */
  protected async get<T = any>(url: string, headers?: any, retries = 3): Promise<T> {
    let lastError: any

    for (let attempt = 0; attempt < retries; attempt++) {
      try {
        this.logger.debug(`GET ${url}${attempt > 0 ? ` (attempt ${attempt + 1}/${retries})` : ''}`)
        const response = await axios.get<T>(url, {
          headers,
          timeout: this.config.timeout || 30000,
        })
        return response.data
      } catch (error: any) {
        lastError = error

        if (error.response?.status === 429 && attempt < retries - 1) {
          const delay = Math.pow(2, attempt) * 2000 + Math.random() * 1000
          this.logger.warn(`Rate limited (429). Retrying in ${Math.round(delay / 1000)}s...`)
          await new Promise(resolve => setTimeout(resolve, delay))
        } else {
          this.logger.error(`GET request failed: ${url}`, error)
          throw error
        }
      }
    }

    this.logger.error(`GET request failed after ${retries} attempts: ${url}`, lastError)
    throw lastError
  }

  /**
   * HTTP POST request helper
   */
  protected async post<T = any>(url: string, data: any, headers?: any): Promise<T> {
    try {
      this.logger.debug(`POST ${url}`)
      const response = await axios.post<T>(url, data, {
        headers,
        timeout: this.config.timeout || 30000,
      })
      return response.data
    } catch (error) {
      this.logger.error(`POST request failed: ${url}`, error)
      throw error
    }
  }

  /**
   * Log message
   */
  protected log(level: 'info' | 'warn' | 'error' | 'debug', message: string, data?: any) {
    this.logger[level](message, data)
  }
}
