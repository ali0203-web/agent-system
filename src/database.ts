import { Pool, QueryResult } from 'pg'
import { createClient, RedisClientType } from 'redis'
import { Logger } from './logger'

const logger = new Logger('Database')

/**
 * Circuit breaker shared by every Database instance (each agent creates its
 * own). When Postgres is unreachable, repeated writes would each block on the
 * connection timeout and flood the log with stack traces. After a few
 * connection failures we pause DB writes for a cooldown, log once, and skip
 * writes cheaply until the next attempt.
 */
const CIRCUIT_FAILURE_THRESHOLD = 3
const CIRCUIT_COOLDOWN_MS = 60_000

export class DbUnavailableError extends Error {
  constructor() {
    super('Database unavailable (circuit open)')
    this.name = 'DbUnavailableError'
  }
}

/** True for "can't reach / lost the server" errors, not for bad SQL etc. */
export function isConnectionError(error: any): boolean {
  const code = error?.code
  if (
    typeof code === 'string' &&
    (['ECONNREFUSED', 'ECONNRESET', 'ETIMEDOUT', 'ENOTFOUND', 'EAI_AGAIN', 'EPIPE'].includes(code) ||
      code.startsWith('08') || // PostgreSQL connection exception class
      code === '57P01' || // admin shutdown
      code === '57P03') // cannot connect now
  ) {
    return true
  }
  if (Array.isArray(error?.errors) && error.errors.length > 0) {
    return error.errors.some(isConnectionError) // AggregateError from multi-address connects
  }
  return /connection terminated|connection timeout|timeout exceeded when trying to connect/i.test(
    String(error?.message ?? '')
  )
}

const circuit = {
  failures: 0,
  openUntil: 0,
  skipped: 0,

  guard(): void {
    if (this.openUntil > Date.now()) {
      this.skipped++
      throw new DbUnavailableError()
    }
  },

  success(): void {
    if (this.failures >= CIRCUIT_FAILURE_THRESHOLD) {
      logger.info('✅ Database reachable again, resuming writes')
    }
    this.failures = 0
    this.openUntil = 0
  },

  failure(error: any): void {
    this.failures++
    if (this.failures === 1) {
      logger.warn(`⚠️ Database write failed (${error?.code ?? error?.message ?? 'unknown error'})`)
    }
    if (this.failures >= CIRCUIT_FAILURE_THRESHOLD) {
      const skipped = this.skipped
      this.skipped = 0
      this.openUntil = Date.now() + CIRCUIT_COOLDOWN_MS
      logger.warn(
        `⚠️ Database unreachable after ${this.failures} consecutive failures; ` +
          `pausing writes for ${CIRCUIT_COOLDOWN_MS / 1000}s` +
          (skipped > 0 ? ` (${skipped} writes skipped since last check)` : '') +
          '. Agents keep running; signals stay in memory.'
      )
    }
  },
}

export class Database {
  private pgPool: Pool
  private redisClient: RedisClientType
  private connected = false

  constructor() {
    // PostgreSQL connection - try multiple env var names for Railway compatibility
    const connectionString =
      process.env.DATABASE_URL ||
      process.env.POSTGRES_URL ||
      process.env.DATABASE_URL_NONPOOLING ||
      'postgresql://localhost/agents'

    this.pgPool = new Pool({
      connectionString,
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    })

    this.pgPool.on('error', (error: Error) => {
      logger.error('PostgreSQL pool error', error)
    })

    // Redis connection (optional)
    this.redisClient = createClient({
      url: process.env.REDIS_URL || 'redis://localhost:6379',
    })

    this.redisClient.on('error', (error) => {
      logger.warn('Redis connection error (non-critical)', error)
    })
  }

  /**
   * Connect to databases
   */
  async connect(): Promise<void> {
    try {
      // Debug: Log available environment variables
      const dbUrl = process.env.DATABASE_URL || process.env.POSTGRES_URL || 'NOT_SET'
      logger.info(`🔍 Connection string: ${dbUrl === 'NOT_SET' ? 'MISSING - falling back to localhost' : 'Using: ' + dbUrl.substring(0, 30) + '...'}`)

      // Test PostgreSQL connection
      const result = await this.pgPool.query('SELECT NOW()')
      logger.info('✅ PostgreSQL connected')

      // Try Redis connection
      try {
        await this.redisClient.connect()
        logger.info('✅ Redis connected')
      } catch (error) {
        logger.warn('Redis connection failed (will continue without cache)', error)
      }

      this.connected = true

      // Initialize tables if needed
      await this.initializeTables()
    } catch (error) {
      logger.error('Failed to connect to database', error)
      throw error
    }
  }

  /**
   * Initialize database tables
   */
  private async initializeTables(): Promise<void> {
    try {
      // Create agent_results table
      await this.pgPool.query(`
        CREATE TABLE IF NOT EXISTS agent_results (
          id SERIAL PRIMARY KEY,
          agent_id UUID NOT NULL,
          agent_name VARCHAR(255) NOT NULL,
          success BOOLEAN NOT NULL,
          data JSONB,
          error TEXT,
          executed_at TIMESTAMP NOT NULL,
          execution_time INTEGER NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `)

      // Create indexes for agent_results
      await this.pgPool.query(`
        CREATE INDEX IF NOT EXISTS idx_agent_results_agent_id ON agent_results(agent_id)
      `)
      await this.pgPool.query(`
        CREATE INDEX IF NOT EXISTS idx_agent_results_executed_at ON agent_results(executed_at)
      `)

      // Create agent_registry table
      await this.pgPool.query(`
        CREATE TABLE IF NOT EXISTS agent_registry (
          id SERIAL PRIMARY KEY,
          agent_id UUID UNIQUE NOT NULL,
          agent_name VARCHAR(255) UNIQUE NOT NULL,
          category VARCHAR(100) NOT NULL,
          description TEXT,
          version VARCHAR(50),
          status VARCHAR(50) DEFAULT 'inactive',
          config JSONB,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `)

      // Create events table
      await this.pgPool.query(`
        CREATE TABLE IF NOT EXISTS events (
          id SERIAL PRIMARY KEY,
          event_name VARCHAR(255) NOT NULL,
          data JSONB NOT NULL,
          emitted_by UUID,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `)

      // Create indexes for events
      await this.pgPool.query(`
        CREATE INDEX IF NOT EXISTS idx_events_event_name ON events(event_name)
      `)
      await this.pgPool.query(`
        CREATE INDEX IF NOT EXISTS idx_events_created_at ON events(created_at)
      `)

      logger.info('✅ Database tables initialized')
    } catch (error) {
      logger.warn('Table initialization warning (may already exist)', error)
    }
  }

  /**
   * Run query
   */
  async query(text: string, values?: any[]): Promise<QueryResult> {
    try {
      const result = await this.pgPool.query(text, values)
      return result
    } catch (error) {
      logger.error('Database query error', error)
      throw error
    }
  }

  /**
   * Insert data
   */
  async insert(table: string, data: Record<string, any>): Promise<any> {
    circuit.guard()
    try {
      const columns = Object.keys(data)
      const values = Object.values(data)
      const placeholders = columns.map((_, i) => `$${i + 1}`).join(', ')

      const query = `
        INSERT INTO ${table} (${columns.join(', ')})
        VALUES (${placeholders})
        RETURNING *
      `

      const result = await this.pgPool.query(query, values)
      circuit.success()
      return result.rows[0]
    } catch (error) {
      if (isConnectionError(error)) {
        circuit.failure(error) // logs once / on open; avoids a stack dump per write
      } else {
        logger.error(`Insert into ${table} failed`, error)
      }
      throw error
    }
  }

  /**
   * Get agent from registry
   */
  async getAgent(agentName: string): Promise<any> {
    try {
      const result = await this.pgPool.query(
        'SELECT * FROM agent_registry WHERE agent_name = $1',
        [agentName]
      )
      return result.rows[0]
    } catch (error) {
      logger.error('Get agent failed', error)
      return null
    }
  }

  /**
   * Publish event
   */
  async publishEvent(eventName: string, data: any, emittedBy?: string): Promise<void> {
    try {
      await this.insert('events', {
        event_name: eventName,
        data,
        emitted_by: emittedBy,
      })
    } catch (error) {
      // Connection problems are already reported by the circuit breaker
      if (!(error instanceof DbUnavailableError) && !isConnectionError(error)) {
        logger.error('Publish event failed', error)
      }
    }
  }

  /**
   * Subscribe to event (listener pattern)
   */
  async subscribeToEvent(eventName: string, callback: (data: any) => Promise<void>): Promise<void> {
    // In production, this would use proper pub/sub
    // For now, we poll the database
    setInterval(async () => {
      try {
        const result = await this.pgPool.query(
          `SELECT * FROM events
           WHERE event_name = $1
           AND created_at > NOW() - INTERVAL '1 minute'
           ORDER BY created_at DESC LIMIT 1`,
          [eventName]
        )

        if (result.rows.length > 0) {
          await callback(result.rows[0].data)
        }
      } catch (error) {
        logger.error('Event subscription error', error)
      }
    }, 5000) // Check every 5 seconds
  }

  /**
   * Cache get
   */
  async cacheGet(key: string): Promise<string | null> {
    try {
      if (!this.redisClient.isOpen) return null
      return await this.redisClient.get(key)
    } catch (error) {
      logger.debug('Cache get failed', error)
      return null
    }
  }

  /**
   * Cache set
   */
  async cacheSet(key: string, value: string, expirationSeconds?: number): Promise<void> {
    try {
      if (!this.redisClient.isOpen) return
      await this.redisClient.set(key, value, {
        EX: expirationSeconds || 300,
      })
    } catch (error) {
      logger.debug('Cache set failed', error)
    }
  }

  /**
   * Close connections
   */
  async close(): Promise<void> {
    try {
      await this.pgPool.end()
      if (this.redisClient.isOpen) {
        await this.redisClient.disconnect()
      }
      logger.info('Database connections closed')
    } catch (error) {
      logger.error('Error closing database connections', error)
    }
  }
}
