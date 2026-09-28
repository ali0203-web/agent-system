import { Router, Request, Response } from 'express'
import { dbInit } from '../services/database-init'
import { orchestrator } from '../orchestrator'

const router = Router()

// Signals endpoints
router.get('/signals', async (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 100
    const signals = await dbInit.getRecentSignals(limit)
    res.json({ signals, count: signals.length })
  } catch (error: any) {
    res.status(500).json({ error: error.message })
  }
})

router.get('/signals/:agentId', async (req: Request, res: Response) => {
  try {
    const { agentId } = req.params
    const limit = parseInt(req.query.limit as string) || 50
    const signals = await dbInit.getRecentSignals(limit)
    const filtered = signals.filter((s: any) => s.agent_id === agentId)
    res.json({ agentId, signals: filtered, count: filtered.length })
  } catch (error: any) {
    res.status(500).json({ error: error.message })
  }
})

// Metrics endpoints
router.get('/metrics', async (req: Request, res: Response) => {
  try {
    const summary = await dbInit.getAgentSummary()
    const metrics = summary.map((agent: any) => ({
      agentId: agent.agent_id,
      agentName: agent.agent_name,
      totalTrades: agent.total_trades || 0,
      profitLoss: agent.profit_loss || 0,
      winRate: agent.win_rate || 0,
      executionCount: agent.execution_count || 0,
      successCount: agent.success_count || 0,
      errorCount: agent.error_count || 0,
    }))
    res.json({ metrics, count: metrics.length })
  } catch (error: any) {
    res.status(500).json({ error: error.message })
  }
})

router.get('/metrics/daily', async (req: Request, res: Response) => {
  try {
    const summary = await dbInit.getAgentSummary()
    const dailyMetrics = {
      date: new Date().toISOString().split('T')[0],
      totalAgents: summary.length,
      totalTrades: summary.reduce((sum: number, a: any) => sum + (a.total_trades || 0), 0),
      aggregatePnL: summary.reduce((sum: number, a: any) => sum + (a.profit_loss || 0), 0),
      avgWinRate: (
        summary.reduce((sum: number, a: any) => sum + (a.win_rate || 0), 0) / summary.length
      ).toFixed(2),
      agentMetrics: summary,
    }
    res.json(dailyMetrics)
  } catch (error: any) {
    res.status(500).json({ error: error.message })
  }
})

// Agents endpoint
router.get('/agents', async (req: Request, res: Response) => {
  try {
    const status = orchestrator.getStatus()
    const agents = status.agents.map((agent: any) => ({
      id: agent.id,
      name: agent.name,
      status: agent.isRunning ? 'running' : 'idle',
      schedule: agent.schedule,
      lastExecution: agent.lastExecution,
      nextExecution: agent.nextExecution,
    }))
    res.json({ total: agents.length, agents })
  } catch (error: any) {
    res.status(500).json({ error: error.message })
  }
})

router.get('/agents/:agentId', async (req: Request, res: Response) => {
  try {
    const { agentId } = req.params
    const status = orchestrator.getStatus()
    const agent = status.agents.find((a: any) => a.id === agentId)

    if (!agent) {
      return res.status(404).json({ error: 'Agent not found' })
    }

    res.json({ agent })
  } catch (error: any) {
    res.status(500).json({ error: error.message })
  }
})

// Performance endpoint
router.get('/performance', async (req: Request, res: Response) => {
  try {
    const summary = await dbInit.getAgentSummary()
    const sorted = summary.sort((a: any, b: any) => (b.profit_loss || 0) - (a.profit_loss || 0))

    const topPerformers = sorted.slice(0, 5).map((a: any) => ({
      agentId: a.agent_id,
      agentName: a.agent_name,
      profitLoss: a.profit_loss,
      winRate: a.win_rate,
    }))

    const needsAttention = sorted.slice(-5).map((a: any) => ({
      agentId: a.agent_id,
      agentName: a.agent_name,
      profitLoss: a.profit_loss,
      winRate: a.win_rate,
    }))

    res.json({
      topPerformers,
      needsAttention,
      totalAgents: summary.length,
    })
  } catch (error: any) {
    res.status(500).json({ error: error.message })
  }
})

// Health check
router.get('/health', async (req: Request, res: Response) => {
  try {
    const status = orchestrator.getStatus()
    res.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      agents: status.agents.length,
      runningAgents: status.agents.filter((a: any) => a.isRunning).length,
    })
  } catch (error: any) {
    res.status(500).json({ status: 'unhealthy', error: error.message })
  }
})

export default router
