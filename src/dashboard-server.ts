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

// Serve static files (dashboard frontend)
app.use(express.static(path.join(__dirname, '../public')))
app.use(express.json())

/**
 * API Endpoints
 */

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
