"use strict";
/**
 * Dashboard API Routes
 * Provides real-time data for enhanced monitoring dashboard
 */
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const database_init_1 = require("../services/database-init");
const orchestrator_1 = require("../orchestrator");
const router = (0, express_1.Router)();
/**
 * GET /api/dashboard/agents
 */
router.get('/agents', async (req, res) => {
    try {
        const status = orchestrator_1.orchestrator.getStatus();
        const agents = status.agents.map((agent) => ({
            id: agent.id,
            name: agent.name,
            status: agent.isRunning ? 'running' : 'idle',
            schedule: agent.schedule,
        }));
        res.json({ total: agents.length, agents });
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
/**
 * GET /api/dashboard/signals
 */
router.get('/signals', async (req, res) => {
    try {
        const signals = await database_init_1.dbInit.getRecentSignals(100);
        res.json({ signals });
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
/**
 * GET /api/dashboard/summary
 */
router.get('/summary', async (req, res) => {
    try {
        const summary = await database_init_1.dbInit.getAgentSummary();
        res.json({ summary });
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
exports.default = router;
//# sourceMappingURL=dashboard-api.js.map