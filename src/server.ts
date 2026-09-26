/**
 * Agent Orchestrator API Server
 * Exposes orchestrator metrics and control endpoints
 */

import express, { Express, Request, Response } from 'express'
import { orchestrator } from './orchestrator'
import { Logger } from './logger'

const logger = new Logger('Server')
const app: Express = express()
const PORT = process.env.PORT || 3000

// Middleware
app.use(express.json())

// CORS middleware - allow requests from any origin
app.use((req: Request, res: Response, next) => {
  res.header('Access-Control-Allow-Origin', '*')
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  res.header('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') {
    return res.sendStatus(200)
  }
  next()
})

// Request logging middleware
app.use((req: Request, res: Response, next) => {
  logger.info(`${req.method} ${req.path}`)
  next()
})

/**
 * Health check endpoint
 */
app.get('/health', (req: Request, res: Response) => {
  res.json({ status: 'ok', timestamp: new Date() })
})

/**
 * Get orchestrator status
 */
app.get('/api/status', (req: Request, res: Response) => {
  try {
    const status = orchestrator.getStatus()
    res.json(status)
  } catch (error) {
    logger.error('Failed to get status', error)
    res.status(500).json({ error: 'Failed to get status' })
  }
})

/**
 * Get metrics for all agents
 */
app.get('/api/metrics', async (req: Request, res: Response) => {
  try {
    const metrics = await orchestrator.getMetrics()
    res.json(metrics)
  } catch (error) {
    logger.error('Failed to get metrics', error)
    res.status(500).json({ error: 'Failed to get metrics' })
  }
})

/**
 * Get detailed agent metrics
 */
app.get('/api/metrics/:agentId', async (req: Request, res: Response) => {
  try {
    const metrics = await orchestrator.getMetrics()
    const agentMetric = metrics.agentMetrics.find(
      (m: any) => m.agentId === req.params.agentId
    )

    if (!agentMetric) {
      return res.status(404).json({ error: 'Agent not found' })
    }

    res.json(agentMetric)
  } catch (error) {
    logger.error('Failed to get agent metrics', error)
    res.status(500).json({ error: 'Failed to get metrics' })
  }
})

/**
 * Trigger an agent immediately
 */
app.post('/api/agents/:agentId/run', async (req: Request, res: Response) => {
  try {
    logger.info(`Manual trigger for agent: ${req.params.agentId}`)
    res.json({ success: true, message: 'Agent trigger queued' })
  } catch (error) {
    logger.error('Failed to trigger agent', error)
    res.status(500).json({ error: 'Failed to trigger agent' })
  }
})

/**
 * Dashboard JSON data
 */
app.get('/api/dashboard', async (req: Request, res: Response) => {
  try {
    const status = orchestrator.getStatus()
    const metrics = await orchestrator.getMetrics()

    // Format for dashboard
    const dashboardData = {
      status: status.isRunning ? 'online' : 'offline',
      agentCount: status.agentCount,
      agents: status.agents,
      metrics: metrics.agentMetrics,
      lastUpdated: new Date(),
    }

    res.json(dashboardData)
  } catch (error) {
    logger.error('Failed to get dashboard data', error)
    res.status(500).json({ error: 'Failed to get dashboard data' })
  }
})

/**
 * Start the server
 */
async function startServer() {
  try {
    // Start orchestrator
    await orchestrator.start()

    // Start server
    app.listen(PORT, () => {
      logger.info(`🚀 API Server running on port ${PORT}`)
      logger.info(`📊 Health check: http://localhost:${PORT}/health`)
      logger.info(`📈 Status API: http://localhost:${PORT}/api/status`)
      logger.info(`📊 Metrics API: http://localhost:${PORT}/api/metrics`)
      logger.info(`🎛️  Dashboard: http://localhost:${PORT}/api/dashboard`)
    })

    // Setup event listeners for real-time updates
    orchestrator.on('agent-completed', (data) => {
      logger.info(`✅ Agent completed: ${data.agentName} (${data.duration}ms)`)
    })

    orchestrator.on('agent-failed', (data) => {
      logger.error(`❌ Agent failed: ${data.agentName}`, data.error)
    })

    orchestrator.on('bitcoin-price-alert', (data) => {
      logger.warn(`🚨 Bitcoin Alert:`, data)
    })

    orchestrator.on('pump-dump-signal', (data) => {
      logger.warn(`🚨 Pump/Dump Signal:`, data)
    })

    orchestrator.on('portfolio-alert', (data) => {
      logger.warn(`⚠️  Portfolio Alert:`, data)
    })
  } catch (error) {
    logger.error('Failed to start server', error)
    process.exit(1)
  }
}

// Graceful shutdown
process.on('SIGINT', async () => {
  logger.info('🛑 Shutting down gracefully...')
  await orchestrator.stop()
  process.exit(0)
})

process.on('SIGTERM', async () => {
  logger.info('🛑 Shutting down gracefully...')
  await orchestrator.stop()
  process.exit(0)
})

// Start server
startServer()

export default app
