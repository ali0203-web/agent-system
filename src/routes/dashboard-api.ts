/**
 * Dashboard API Routes
 * Provides real-time data for enhanced monitoring dashboard
 */

import { Router, Request, Response } from 'express'
import { dbInit } from '../services/database-init'
import { orchestrator } from '../orchestrator'

const router = Router()

/**
 * GET /api/dashboard/agents
 */
router.get('/agents', async (req: Request, res: Response) => {
  try {
    const status = orchestrator.getStatus()
    const agents = status.agents.map((agent: any) => ({
      id: agent.id,
      name: agent.name,
      status: agent.isRunning ? 'running' : 'idle',
      schedule: agent.schedule,
    }))
    res.json({ total: agents.length, agents })
  } catch (error: any) {
    res.status(500).json({ error: error.message })
  }
})

/**
 * GET /api/dashboard/signals
 */
router.get('/signals', async (req: Request, res: Response) => {
  try {
    const signals = await dbInit.getRecentSignals(100)
    res.json({ signals })
  } catch (error: any) {
    res.status(500).json({ error: error.message })
  }
})

/**
 * GET /api/dashboard/summary
 */
router.get('/summary', async (req: Request, res: Response) => {
  try {
    const summary = await dbInit.getAgentSummary()
    res.json({ summary })
  } catch (error: any) {
    res.status(500).json({ error: error.message })
  }
})

export default router
