/**
 * Agent Dashboard Server
 * Real-time monitoring and visualization of all agents
 * WebSocket streaming of live agent events and metrics
 */

import express from 'express'
import http from 'http'
import WebSocket from 'ws'
import path from 'path'
import { orchestrator } from './orchestrator'
import { Logger } from './logger'

const logger = new Logger('DashboardServer')

const app = express()
const server = http.createServer(app)
const wss = new WebSocket.Server({ server })

// Store for agent metrics and events
const agentMetrics = new Map()
const eventHistory: any[] = []
const maxHistoryLength = 500

// Middleware
app.use(express.json())

// CORS middleware - allow requests from any origin
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*')
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  res.header('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') {
    return res.sendStatus(200)
  }
  next()
})

// Request logging middleware
app.use((req, res, next) => {
  logger.info(`${req.method} ${req.path}`)
  next()
})

// Serve static files (dashboard frontend)
app.use(express.static(path.join(__dirname, '../public')))

// Serve index.html for root path
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'))
})

/**
 * API Endpoints
 */

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date() })
})

// Get orchestrator status
app.get('/api/status', (req, res) => {
  const status = orchestrator.getStatus()
  res.json(status)
})

// Get metrics for all agents
app.get('/api/metrics', async (req, res) => {
  const metrics = await orchestrator.getMetrics()
  res.json(metrics)
})

// Get dashboard data
app.get('/api/dashboard', async (req, res) => {
  const status = orchestrator.getStatus()
  const metrics = await orchestrator.getMetrics()
  const dashboardData = {
    status: status.isRunning ? 'online' : 'offline',
    agentCount: status.agentCount,
    agents: status.agents,
    metrics: metrics.agentMetrics,
    lastUpdated: new Date(),
  }
  res.json(dashboardData)
})

// Get all agent status
app.get('/api/agents/status', (req, res) => {
  const status = orchestrator.getStatus()
  res.json(status)
})

// Get agent metrics
app.get('/api/agents/metrics', async (req, res) => {
  const metrics = await orchestrator.getMetrics()
  res.json(metrics)
})

// Get event history
app.get('/api/events/history', (req, res) => {
  const limit = parseInt(req.query.limit as string) || 100
  res.json(eventHistory.slice(-limit))
})

// Get detailed agent metrics by ID
app.get('/api/metrics/:agentId', async (req, res) => {
  const metrics = await orchestrator.getMetrics()
  const agentMetric = metrics.agentMetrics.find(
    (m: any) => m.agentId === req.params.agentId
  )
  if (!agentMetric) {
    return res.status(404).json({ error: 'Agent not found' })
  }
  res.json(agentMetric)
})

// Get agent details
app.get('/api/agents/:agentId', (req, res) => {
  const status = orchestrator.getStatus()
  const agent = status.agents.find((a: any) => a.id === req.params.agentId)
  if (agent) {
    res.json({
      ...agent,
      metrics: agentMetrics.get(req.params.agentId) || {},
    })
  } else {
    res.status(404).json({ error: 'Agent not found' })
  }
})

// Trigger an agent immediately
app.post('/api/agents/:agentId/run', async (req, res) => {
  logger.info(`Manual trigger for agent: ${req.params.agentId}`)
  res.json({ success: true, message: 'Agent trigger queued' })
})

/**
 * WebSocket Connection Handler
 */

wss.on('connection', (ws: WebSocket) => {
  logger.info('Dashboard client connected')

  // Send initial state
  const initialState = {
    type: 'initial',
    orchestrator: orchestrator.getStatus(),
    events: eventHistory.slice(-50),
  }
  ws.send(JSON.stringify(initialState))

  // Send periodic updates (every 1 second)
  const interval = setInterval(() => {
    try {
      ws.send(
        JSON.stringify({
          type: 'status-update',
          timestamp: new Date(),
          orchestrator: orchestrator.getStatus(),
        })
      )
    } catch (error) {
      clearInterval(interval)
    }
  }, 1000)

  ws.on('close', () => {
    clearInterval(interval)
    logger.info('Dashboard client disconnected')
  })
})

/**
 * Event Listeners - Capture agent events
 */

// Listen to all agent events from orchestrator
orchestrator.on('agent-completed', (data: any) => {
  const event = {
    type: 'agent-completed',
    ...data,
    timestamp: new Date(),
  }
  eventHistory.push(event)
  if (eventHistory.length > maxHistoryLength) {
    eventHistory.shift()
  }
  broadcastEvent(event)
})

orchestrator.on('agent-failed', (data: any) => {
  const event = {
    type: 'agent-failed',
    ...data,
    timestamp: new Date(),
  }
  eventHistory.push(event)
  if (eventHistory.length > maxHistoryLength) {
    eventHistory.shift()
  }
  broadcastEvent(event)
})

orchestrator.on('bitcoin-price-alert', (data: any) => {
  broadcastEvent({
    type: 'bitcoin-price-alert',
    ...data,
    timestamp: new Date(),
  })
})

orchestrator.on('pump-dump-signal', (data: any) => {
  broadcastEvent({
    type: 'pump-dump-signal',
    ...data,
    timestamp: new Date(),
  })
})

orchestrator.on('dca-purchase', (data: any) => {
  broadcastEvent({
    type: 'dca-purchase',
    ...data,
    timestamp: new Date(),
  })
})

orchestrator.on('grid-buy-order', (data: any) => {
  broadcastEvent({
    type: 'grid-buy-order',
    ...data,
    timestamp: new Date(),
  })
})

orchestrator.on('momentum-entry', (data: any) => {
  broadcastEvent({
    type: 'momentum-entry',
    ...data,
    timestamp: new Date(),
  })
})

orchestrator.on('reversion-entry', (data: any) => {
  broadcastEvent({
    type: 'reversion-entry',
    ...data,
    timestamp: new Date(),
  })
})

/**
 * Broadcast event to all connected dashboard clients
 */
function broadcastEvent(event: any) {
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify(event))
    }
  })
}

/**
 * Start server
 */
export function startDashboardServer(port: number = 3001) {
  server.listen(port, () => {
    logger.info(`🎯 Dashboard Server running at http://localhost:${port}`)
    logger.info('📊 Streaming agent metrics and events in real-time')
  })
}

export { app, server, wss }
