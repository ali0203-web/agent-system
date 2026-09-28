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
const api_1 = __importDefault(require("./routes/api"));
const dashboard_api_1 = __importDefault(require("./routes/dashboard-api"));
const alerting_service_1 = require("./services/alerting-service");
const auth_1 = require("./middleware/auth");
const database_init_1 = require("./services/database-init");
const logger = new logger_1.Logger('DashboardServer');
const alertingService = (0, alerting_service_1.getAlertingService)();
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
// Security headers middleware
app.use((req, res, next) => {
    res.header('X-Content-Type-Options', 'nosniff');
    res.header('X-Frame-Options', 'DENY');
    res.header('X-XSS-Protection', '1; mode=block');
    res.header('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    next();
});
// CORS middleware - allow requests from any origin (can be restricted by API key)
app.use((req, res, next) => {
    const allowedOrigins = process.env.ALLOWED_ORIGINS || '*';
    const origin = req.headers.origin || '*';
    if (allowedOrigins === '*' || allowedOrigins.includes(origin)) {
        res.header('Access-Control-Allow-Origin', origin);
    }
    res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-API-Key');
    res.header('Access-Control-Max-Age', '3600');
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
// Authentication middleware - protects all /api/* routes
app.use('/api', auth_1.authMiddleware);
app.use('/api/dashboard', auth_1.authMiddleware);
// API Routes (mount after auth)
app.use('/api', api_1.default);
app.use('/api/dashboard', dashboard_api_1.default);
// Serve WebSocket dashboard for root path (must come BEFORE static files)
app.get('/', (req, res) => {
    res.sendFile(path_1.default.join(__dirname, '../public/dashboard-websocket.html'));
});
// Keep REST dashboard available at alternate route
app.get('/dashboard-rest', (req, res) => {
    res.sendFile(path_1.default.join(__dirname, '../public/dashboard-enhanced.html'));
});
// Serve static files (dashboard frontend) - fallback for other routes
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
// Alert system endpoints
app.get('/api/alerts/status', (req, res) => {
    res.json({
        alerts: alertingService.getStats(),
        configured: {
            slack: !!process.env.SLACK_WEBHOOK_URL,
            discord: !!process.env.DISCORD_WEBHOOK_URL,
        },
    });
});
// Test alert endpoint (for debugging)
app.post('/api/alerts/test', async (req, res) => {
    const testAlert = {
        severity: req.body.severity || 'warning',
        agentName: 'test-agent',
        symbol: 'BTC/USD',
        message: 'This is a test alert',
        confidence: 0.85,
    };
    await alertingService.checkAndAlert(req.body.type || 'high-confidence-signal', testAlert);
    res.json({ success: true, message: 'Test alert sent' });
});
// Rate limit and API key info endpoint
app.get('/api/security/rate-limit', (req, res) => {
    const { getRateLimitStatus } = require('./middleware/auth');
    const apiKey = req.apiKey;
    if (!apiKey) {
        return res.status(401).json({ error: 'API key required' });
    }
    const status = getRateLimitStatus(apiKey);
    res.json({
        apiKey: req.clientId,
        rateLimit: status,
        message: `${status.remaining} requests remaining in current window (resets in ${(status.resetIn / 1000).toFixed(1)}s)`,
    });
});
// Security info endpoint
app.get('/api/security/info', (req, res) => {
    res.json({
        authentication: {
            required: true,
            methods: ['Authorization: Bearer <api-key>', 'X-API-Key: <api-key>', 'Query: ?api_key=<api-key>'],
        },
        rateLimit: {
            enabled: true,
            maxRequests: 100,
            windowSeconds: 60,
            endpoint: '/api/security/rate-limit',
        },
        headers: {
            cors: 'Enabled with X-API-Key support',
            security: 'HSTS, X-Frame-Options, X-Content-Type-Options enabled',
        },
    });
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
            const status = orchestrator_1.orchestrator.getStatus();
            ws.send(JSON.stringify({
                type: 'status-update',
                timestamp: new Date().toISOString(),
                orchestrator: status,
                agentsOnline: status.agentCount,
                runningAgents: status.agents?.filter((a) => a.isRunning).length || 0,
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
    alertingService.checkAndAlert('agent-failed', data);
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
// Generic signal event listener
orchestrator_1.orchestrator.on('signal-generated', (data) => {
    const signal = {
        type: 'signal-generated',
        agentId: data.agentId,
        agentName: data.agentName,
        symbol: data.symbol,
        message: data.message,
        timestamp: new Date().toISOString(),
        ...data,
    };
    broadcastEvent(signal);
    logger.info(`Signal: ${data.agentName} - ${data.message}`);
    if (data.confidence && data.confidence >= 0.85) {
        alertingService.checkAndAlert('high-confidence-signal', {
            ...data,
            agentWinRate: 0.6, // Would be fetched from metrics in production
        });
    }
});
// Portfolio risk alerts
orchestrator_1.orchestrator.on('portfolio-risk-update', (data) => {
    if (data.riskLevel === 'high' || data.riskLevel === 'critical') {
        alertingService.checkAndAlert('portfolio-risk-update', data);
    }
});
// Trade completion alerts
orchestrator_1.orchestrator.on('trade-closed', (data) => {
    if (data.pnl > 0) {
        alertingService.checkAndAlert('trade-closed', data);
    }
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
async function startDashboardServer(port = 3001) {
    return new Promise((resolve, reject) => {
        try {
            database_init_1.dbInit.initialize().then(() => {
                logger.info('');
                server.listen(port, () => {
                    logger.info(`🎯 Dashboard Server running at http://localhost:${port}`);
                    logger.info('📊 Streaming agent metrics and events in real-time');
                    resolve();
                });
            }).catch(reject);
        }
        catch (error) {
            logger.error('Failed to start dashboard server', error);
            reject(error);
        }
    });
}
//# sourceMappingURL=dashboard-server.js.map