import { dbInit } from './database-init'
import { Logger } from '../logger'

const logger = new Logger('SignalStorage')

interface SignalBuffer {
  agentId: string
  agentName: string
  signalType: string
  confidence: number
  message: string
  data: any
  symbol?: string
}

class SignalStorageService {
  private buffer: SignalBuffer[] = []
  private readonly BATCH_SIZE = 100
  private readonly FLUSH_INTERVAL = 30000 // 30 seconds
  private flushTimer: NodeJS.Timeout | null = null

  constructor() {
    this.startPeriodicFlush()
  }

  private startPeriodicFlush() {
    this.flushTimer = setInterval(() => {
      if (this.buffer.length > 0) {
        this.flush().catch(err => logger.error('Failed to flush signals', err))
      }
    }, this.FLUSH_INTERVAL)
  }

  async addSignal(agentId: string, agentName: string, signalType: string, data: any): Promise<void> {
    try {
      const signal: SignalBuffer = {
        agentId,
        agentName,
        signalType,
        confidence: data.confidence || 0.5,
        message: data.message || '',
        data,
        symbol: data.symbol,
      }

      this.buffer.push(signal)

      // Flush if buffer reaches batch size
      if (this.buffer.length >= this.BATCH_SIZE) {
        await this.flush()
      }
    } catch (error) {
      logger.error(`Failed to buffer signal from ${agentId}`, error)
    }
  }

  async flush(): Promise<void> {
    if (this.buffer.length === 0) return

    try {
      const signals = [...this.buffer]
      this.buffer = []

      for (const signal of signals) {
        await dbInit.createSignal(signal.agentId, signal.agentName, signal.signalType, {
          ...signal.data,
          confidence: signal.confidence,
          message: signal.message,
          symbol: signal.symbol,
        })
      }

      logger.info(`✅ Flushed ${signals.length} signals to database`)
    } catch (error) {
      logger.error('Failed to flush signals to database', error)
      // Re-add to buffer on failure
      // Don't do this to avoid memory issues - just log and move on
    }
  }

  async shutdown(): Promise<void> {
    if (this.flushTimer) {
      clearInterval(this.flushTimer)
    }
    // Final flush
    await this.flush()
  }

  getBufferSize(): number {
    return this.buffer.length
  }
}

export const signalStorage = new SignalStorageService()
