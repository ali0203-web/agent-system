"use strict";
/**
 * Agent Dashboard Server
 * Real-time monitoring and visualization of all agents
 * WebSocket streaming of live agent events and metrics
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.wss = exports.server = exports.app = void 0;
exports.startDashboardServer = startDashboardServer;
const express_1 = __importDefault(require("express"));
const http_1 = __importDefault(require("http"));
const ws_1 = __importDefault(require("ws"));
const path_1 = __importDefault(require("path"));
const orchestrator_1 = require("./orchestrator");
const logger_1 = require("./logger");
const logger = new logger_1.Logger('DashboardServer');
const app = (0, express_1.default)();
exports.app = app;
const server = http_1.default.createServer(app);
exports.server = server;
const wss = new ws_1.default.Server({ server });
exports.wss = wss;
// Store for agent metrics and events
const agentMetrics = new Map();
const eventHistory = [];
const maxHistoryLength = 500;
// Middleware
app.use(express_1.default.json());
// CORS middleware - allow requests from any origin
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') {
        return res.sendStatus(200);
    }
    next();
});
// Request logging middleware
app.use((req, res, next) => {
    logger.info(`${req.method} ${req.path}`);
    next();
});
// Serve static files (dashboard frontend)
app.use(express_1.default.static(path_1.default.join(__dirname, '../public')));
/**
 * API Endpoints
 */
// Health check
app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date() });
});
// Get orchestrator status
app.get('/api/status', (req, res) => {
    const status = orchestrator_1.orchestrator.getStatus();
    res.json(status);
});
// Get metrics for all agents
app.get('/api/metrics', async (req, res) => {
    const metrics = await orchestrator_1.orchestrator.getMetrics();
    res.json(metrics);
});
// Get dashboard data
app.get('/api/dashboard', async (req, res) => {
    const status = orchestrator_1.orchestrator.getStatus();
    const metrics = await orchestrator_1.orchestrator.getMetrics();
    const dashboardData = {
        status: status.isRunning ? 'online' : 'offline',
        agentCount: status.agentCount,
        agents: status.agents,
        metrics: metrics.agentMetrics,
        lastUpdated: new Date(),
    };
    res.json(dashboardData);
});
// Get all agent status
app.get('/api/agents/status', (req, res) => {
    const status = orchestrator_1.orchestrator.getStatus();
    res.json(status);
});
// Get agent metrics
app.get('/api/agents/metrics', async (req, res) => {
    const metrics = await orchestrator_1.orchestrator.getMetrics();
    res.json(metrics);
});
// Get event history
app.get('/api/events/history', (req, res) => {
    const limit = parseInt(req.query.limit) || 100;
    res.json(eventHistory.slice(-limit));
});
// Get detailed agent metrics by ID
app.get('/api/metrics/:agentId', async (req, res) => {
    const metrics = await orchestrator_1.orchestrator.getMetrics();
    const agentMetric = metrics.agentMetrics.find((m) => m.agentId === req.params.agentId);
    if (!agentMetric) {
        return res.status(404).json({ error: 'Agent not found' });
    }
    res.json(agentMetric);
});
// Get agent details
app.get('/api/agents/:agentId', (req, res) => {
    const status = orchestrator_1.orchestrator.getStatus();
    const agent = status.agents.find((a) => a.id === req.params.agentId);
    if (agent) {
        res.json({
            ...agent,
            metrics: agentMetrics.get(req.params.agentId) || {},
        });
    }
    else {
        res.status(404).json({ error: 'Agent not found' });
    }
});
// Trigger an agent immediately
app.post('/api/agents/:agentId/run', async (req, res) => {
    logger.info(`Manual trigger for agent: ${req.params.agentId}`);
    res.json({ success: true, message: 'Agent trigger queued' });
});
/**
 * WebSocket Connection Handler
 */
wss.on('connection', (ws) => {
    logger.info('Dashboard client connected');
    // Send initial state
    const initialState = {
        type: 'initial',
        orchestrator: orchestrator_1.orchestrator.getStatus(),
        events: eventHistory.slice(-50),
    };
    ws.send(JSON.stringify(initialState));
    // Send periodic updates (every 1 second)
    const interval = setInterval(() => {
        try {
            ws.send(JSON.stringify({
                type: 'status-update',
                timestamp: new Date(),
                orchestrator: orchestrator_1.orchestrator.getStatus(),
            }));
        }
        catch (error) {
            clearInterval(interval);
        }
    }, 1000);
    ws.on('close', () => {
        clearInterval(interval);
        logger.info('Dashboard client disconnected');
    });
});
/**
 * Event Listeners - Capture agent events
 */
// Listen to all agent events from orchestrator
orchestrator_1.orchestrator.on('agent-completed', (data) => {
    const event = {
        type: 'agent-completed',
        ...data,
        timestamp: new Date(),
    };
    eventHistory.push(event);
    if (eventHistory.length > maxHistoryLength) {
        eventHistory.shift();
    }
    broadcastEvent(event);
});
orchestrator_1.orchestrator.on('agent-failed', (data) => {
    const event = {
        type: 'agent-failed',
        ...data,
        timestamp: new Date(),
    };
    eventHistory.push(event);
    if (eventHistory.length > maxHistoryLength) {
        eventHistory.shift();
    }
    broadcastEvent(event);
});
orchestrator_1.orchestrator.on('bitcoin-price-alert', (data) => {
    broadcastEvent({
        type: 'bitcoin-price-alert',
        ...data,
        timestamp: new Date(),
    });
});
orchestrator_1.orchestrator.on('pump-dump-signal', (data) => {
    broadcastEvent({
        type: 'pump-dump-signal',
        ...data,
        timestamp: new Date(),
    });
});
orchestrator_1.orchestrator.on('dca-purchase', (data) => {
    broadcastEvent({
        type: 'dca-purchase',
        ...data,
        timestamp: new Date(),
    });
});
orchestrator_1.orchestrator.on('grid-buy-order', (data) => {
    broadcastEvent({
        type: 'grid-buy-order',
        ...data,
        timestamp: new Date(),
    });
});
orchestrator_1.orchestrator.on('momentum-entry', (data) => {
    broadcastEvent({
        type: 'momentum-entry',
        ...data,
        timestamp: new Date(),
    });
});
orchestrator_1.orchestrator.on('reversion-entry', (data) => {
    broadcastEvent({
        type: 'reversion-entry',
        ...data,
        timestamp: new Date(),
    });
});
/**
 * Broadcast event to all connected dashboard clients
 */
function broadcastEvent(event) {
    wss.clients.forEach((client) => {
        if (client.readyState === ws_1.default.OPEN) {
            client.send(JSON.stringify(event));
        }
    });
}
/**
 * Start server
 */
function startDashboardServer(port = 3001) {
    server.listen(port, () => {
        logger.info(`🎯 Dashboard Server running at http://localhost:${port}`);
        logger.info('📊 Streaming agent metrics and events in real-time');
    });
}
//# sourceMappingURL=dashboard-server.js.map