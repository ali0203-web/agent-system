"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const database_init_1 = require("../services/database-init");
const orchestrator_1 = require("../orchestrator");
const router = (0, express_1.Router)();
// Signals endpoints
router.get('/signals', async (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 100;
        const signals = await database_init_1.dbInit.getRecentSignals(limit);
        res.json({ signals, count: signals.length });
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
router.get('/signals/:agentId', async (req, res) => {
    try {
        const { agentId } = req.params;
        const limit = parseInt(req.query.limit) || 50;
        const signals = await database_init_1.dbInit.getRecentSignals(limit);
        const filtered = signals.filter((s) => s.agent_id === agentId);
        res.json({ agentId, signals: filtered, count: filtered.length });
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
// Metrics endpoints
router.get('/metrics', async (req, res) => {
    try {
        const summary = await database_init_1.dbInit.getAgentSummary();
        const metrics = summary.map((agent) => ({
            agentId: agent.agent_id,
            agentName: agent.agent_name,
            totalTrades: agent.total_trades || 0,
            profitLoss: agent.profit_loss || 0,
            winRate: agent.win_rate || 0,
            executionCount: agent.execution_count || 0,
            successCount: agent.success_count || 0,
            errorCount: agent.error_count || 0,
        }));
        res.json({ metrics, count: metrics.length });
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
router.get('/metrics/daily', async (req, res) => {
    try {
        const summary = await database_init_1.dbInit.getAgentSummary();
        const dailyMetrics = {
            date: new Date().toISOString().split('T')[0],
            totalAgents: summary.length,
            totalTrades: summary.reduce((sum, a) => sum + (a.total_trades || 0), 0),
            aggregatePnL: summary.reduce((sum, a) => sum + (a.profit_loss || 0), 0),
            avgWinRate: (summary.reduce((sum, a) => sum + (a.win_rate || 0), 0) / summary.length).toFixed(2),
            agentMetrics: summary,
        };
        res.json(dailyMetrics);
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
// Agents endpoint
router.get('/agents', async (req, res) => {
    try {
        const status = orchestrator_1.orchestrator.getStatus();
        const agents = status.agents.map((agent) => ({
            id: agent.id,
            name: agent.name,
            status: agent.isRunning ? 'running' : 'idle',
            schedule: agent.schedule,
            lastExecution: agent.lastExecution,
            nextExecution: agent.nextExecution,
        }));
        res.json({ total: agents.length, agents });
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
router.get('/agents/:agentId', async (req, res) => {
    try {
        const { agentId } = req.params;
        const status = orchestrator_1.orchestrator.getStatus();
        const agent = status.agents.find((a) => a.id === agentId);
        if (!agent) {
            return res.status(404).json({ error: 'Agent not found' });
        }
        res.json({ agent });
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
// Performance endpoint
router.get('/performance', async (req, res) => {
    try {
        const summary = await database_init_1.dbInit.getAgentSummary();
        const sorted = summary.sort((a, b) => (b.profit_loss || 0) - (a.profit_loss || 0));
        const topPerformers = sorted.slice(0, 5).map((a) => ({
            agentId: a.agent_id,
            agentName: a.agent_name,
            profitLoss: a.profit_loss,
            winRate: a.win_rate,
        }));
        const needsAttention = sorted.slice(-5).map((a) => ({
            agentId: a.agent_id,
            agentName: a.agent_name,
            profitLoss: a.profit_loss,
            winRate: a.win_rate,
        }));
        res.json({
            topPerformers,
            needsAttention,
            totalAgents: summary.length,
        });
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
// Health check
router.get('/health', async (req, res) => {
    try {
        const status = orchestrator_1.orchestrator.getStatus();
        res.json({
            status: 'healthy',
            timestamp: new Date().toISOString(),
            agents: status.agents.length,
            runningAgents: status.agents.filter((a) => a.isRunning).length,
        });
    }
    catch (error) {
        res.status(500).json({ status: 'unhealthy', error: error.message });
    }
});
exports.default = router;
//# sourceMappingURL=api.js.map