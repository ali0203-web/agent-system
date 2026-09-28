# AgentOS Trading System - Architecture

## System Overview

AgentOS is a distributed autonomous trading system consisting of 40 specialized agents that execute trading strategies on cryptocurrency exchanges. The system emphasizes reliability, real-time monitoring, and professional-grade security.

```
┌─────────────────────────────────────────────────────────────────┐
│                    Production Environment                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐      │
│  │   WebSocket  │    │   REST API   │    │  Dashboard   │      │
│  │  (Real-time) │    │(Authenticated)    │  (Browser)   │      │
│  └──────┬───────┘    └──────┬───────┘    └──────┬───────┘      │
│         │                   │                   │               │
│         └───────────────────┼───────────────────┘               │
│                             │                                   │
│                      ┌──────▼────────┐                          │
│                      │ Dashboard    │                          │
│                      │ Server       │                          │
│                      │ (port 3000)  │                          │
│                      └──────┬────────┘                          │
│                             │                                   │
│         ┌───────────────────┼───────────────────┐               │
│         │                   │                   │               │
│    ┌────▼──────┐     ┌──────▼──────┐    ┌──────▼────┐          │
│    │Orchestrator    │Alerting     │    │ Database │          │
│    │(40 agents)     │ Service     │    │(PostgreSQL)          │
│    └────┬──────┘    └──────┬──────┘    └──────┬────┘          │
│         │                  │                   │               │
│    ┌────▼──────────────────▼────────────────────▼──┐           │
│    │     Messaging & Event Bus                     │           │
│    │  (orchestrator events + alerts)               │           │
│    └──────────────────────────────────────────────┘           │
│         │                                                       │
│    ┌────▼──────────────────────────────────────────┐           │
│    │    External Services                          │           │
│    ├──────────────────────────────────────────────┤           │
│    │ • Binance API (Trading)                      │           │
│    │ • Slack Webhooks (Alerting)                  │           │
│    │ • Discord Webhooks (Alerting)                │           │
│    └──────────────────────────────────────────────┘           │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Core Components

### 1. Orchestrator
**File:** `src/orchestrator.ts`

Manages all 40 trading agents and their lifecycle.

**Responsibilities:**
- Register and initialize all agents
- Schedule agent execution (5-15 minute intervals)
- Emit events for agent lifecycle (completed, failed)
- Broadcast trading signals from agents
- Maintain agent status and metrics

**Event Types:**
- `agent-completed`: Agent finished execution successfully
- `agent-failed`: Agent execution error
- `signal-generated`: New trading signal produced
- `portfolio-updated`: P&L or position changed
- Plus 40+ domain-specific signals (bullish, bearish, etc.)

### 2. Dashboard Server
**File:** `src/dashboard-server.ts`

HTTP/WebSocket server for monitoring and API access.

**Responsibilities:**
- Serve real-time dashboard UI
- Handle WebSocket connections for live updates
- Provide REST API endpoints
- Apply authentication & rate limiting
- Broadcast events to connected clients
- Mount API routers

**Ports:**
- 3000 (production)
- 3001 (dashboard-specific, optional)

### 3. Alerting Service
**File:** `src/services/alerting-service.ts`

Event-driven alert system with Slack/Discord integration.

**Alert Rules (7 Total):**
1. **Agent Failed** (Critical) - Agent execution error
2. **High Error Rate** (Critical) - 5+ consecutive failures
3. **Low Signal Rate** (Warning) - No signals for 30+ minutes
4. **Portfolio Risk** (Warning) - Risk level: high/critical
5. **Large P&L Swing** (Warning) - P&L change > $1000
6. **Profitable Trade** (Info) - Win > $100
7. **High Confidence Signal** (Info) - Confidence ≥ 85%

**Features:**
- Rate limiting (1 alert per rule type per minute)
- Alert deduplication (5-second window)
- Slack webhook formatting
- Discord webhook formatting
- Graceful degradation (works without webhooks)

### 4. Authentication & Rate Limiting
**File:** `src/middleware/auth.ts`

Security layer for API access.

**Features:**
- API key validation
- 3 authentication methods (Bearer, X-API-Key, query param)
- Rate limiting (100 req/min per key)
- Security headers (HSTS, X-Frame-Options, etc.)
- CORS with API key support

### 5. Signal Storage
**File:** `src/services/signal-storage.ts`

Persists trading signals to database.

**Responsibilities:**
- Buffer signals (batch size: 100)
- Flush to database (30-second interval)
- Event-driven architecture
- Error recovery & logging

### 6. Agents (40 Total)
**Directory:** `src/agents/`

40 specialized trading strategy implementations.

**Categories:**
- **Basic Monitoring (5):** Price, portfolio, pump/dump detection
- **Technical Analysis (10):** Moving averages, MACD, RSI, Stochastic, Bollinger Bands, etc.
- **Advanced Strategies (10):** Grid trading, arbitrage, momentum, mean reversion
- **Risk Management (5):** Risk alerts, position sizing, portfolio tracking
- **Data Analysis (5):** Sentiment, correlation, market regime detection
- **Meta Strategies (4):** Trend strength, signal aggregation, volume analysis
- **Emerging Techniques (1):** ML prediction

**Agent Interface:**
```typescript
interface Agent extends EventEmitter {
  id: string
  name: string
  execute(): Promise<void>
  getStatus(): AgentStatus
  getMetrics(): AgentMetrics
}
```

---

## Data Flow

### Trading Signal Flow
```
Agent executes → Generates signal → Emits "signal-generated" event
         ↓
Orchestrator broadcasts → Dashboard receives (WebSocket/REST)
         ↓
AlertingService receives → Checks alert rules → Sends to Slack/Discord
         ↓
SignalStorageService receives → Buffers (max 100) → Flushes to DB
```

### Real-time Updates (WebSocket)
```
Client connects → Browser sends WebSocket upgrade request
         ↓
DashboardServer accepts → Opens WebSocket connection
         ↓
Orchestrator emits events → Server broadcasts to all clients
         ↓
Browser receives in real-time → Dashboard updates instantly
```

### REST API Request
```
Client sends API request with key → AuthMiddleware validates
         ↓
Rate limit check → Passes: continue, Fails: return 429
         ↓
Route handler executes → Queries data (in-memory or DB)
         ↓
Response sent with security headers
```

---

## Database Schema

### Tables

**signals**
```sql
id UUID PRIMARY KEY
agent_id VARCHAR
symbol VARCHAR
signal_type VARCHAR (bullish, bearish, neutral)
confidence FLOAT
data JSONB
timestamp TIMESTAMP
```

**trades**
```sql
id UUID PRIMARY KEY
symbol VARCHAR
entry_price FLOAT
exit_price FLOAT
position_size FLOAT
profit_loss FLOAT
agent_id VARCHAR
status VARCHAR (open, closed)
created_at TIMESTAMP
closed_at TIMESTAMP
```

**agent_metrics**
```sql
id UUID PRIMARY KEY
agent_id VARCHAR
win_rate FLOAT
total_trades INT
profit_loss FLOAT
avg_holding_time INT
sharpe_ratio FLOAT
date DATE
```

**agent_status**
```sql
agent_id VARCHAR PRIMARY KEY
status VARCHAR (idle, running, error)
last_run TIMESTAMP
next_run TIMESTAMP
error_count INT
```

**dashboard_events**
```sql
id UUID PRIMARY KEY
type VARCHAR
agent_id VARCHAR
data JSONB
timestamp TIMESTAMP
```

---

## Security Architecture

### Authentication
- 3 methods: Bearer token, X-API-Key header, query parameter
- Configurable API keys via environment variable
- Admin key support for sensitive operations

### Rate Limiting
- 100 requests per minute per API key
- Per-key tracking with sliding window
- Automatic cleanup on window expiration
- Rate limit status endpoint for client visibility

### Security Headers
- **HSTS:** Force HTTPS
- **X-Frame-Options:** Prevent clickjacking
- **X-Content-Type-Options:** Prevent MIME sniffing
- **X-XSS-Protection:** XSS filter activation
- **CORS:** Configurable origin support

### Credential Management
- Environment variables for sensitive data
- No secrets in code or config files
- Support for production vs testnet keys
- Graceful fallback to testnet mode

---

## Deployment Architecture

### Production Environment (Railway)
```
┌─────────────────────────────┐
│   Railway Deployment        │
├─────────────────────────────┤
│                             │
│  ┌──────────────────────┐   │
│  │  Node.js Container   │   │
│  │  - Dashboard Server  │   │
│  │  - 40 Agents         │   │
│  │  - Alerting Service  │   │
│  └──────────────────────┘   │
│           │                 │
│           ↓                 │
│  ┌──────────────────────┐   │
│  │  PostgreSQL Database │   │
│  │  - Signal Storage    │   │
│  │  - Trade Logging     │   │
│  │  - Metrics           │   │
│  └──────────────────────┘   │
│                             │
└─────────────────────────────┘
```

**Environment Variables:**
```
API_KEYS=key1,key2,key3
ADMIN_API_KEY=admin-key
SLACK_WEBHOOK_URL=https://...
DISCORD_WEBHOOK_URL=https://...
DATABASE_URL=postgresql://...
USE_TESTNET=true
PORT=3000
LOG_LEVEL=info
```

---

## Scaling Considerations

### Current Capacity
- 40 agents executing on 5-15 minute schedules
- ~3,000-5,000 signals per day
- ~500-1,000 API requests per hour
- Rate limit: 100 req/min per key

### Horizontal Scaling
1. **Multiple Dashboard Servers:** Load balance with sticky sessions for WebSocket
2. **Message Queue:** Replace in-memory orchestrator events with Redis/RabbitMQ
3. **Database Replication:** Read replicas for metrics queries
4. **Caching Layer:** Redis for frequently accessed data

### Vertical Scaling
1. Increase rate limit per key
2. Optimize database indexes
3. Cache expensive calculations
4. Implement request batching

---

## Error Handling & Recovery

### Agent Failures
- Automatic retry with exponential backoff (not implemented yet)
- Error count tracking
- Alert on high error rate (5+ failures)
- Graceful degradation (other agents continue)

### Database Failures
- In-memory fallback for signal storage
- Automatic reconnection with backoff
- Signal buffering with replay on reconnect
- Metrics recalculation on recovery

### API Failures
- Request timeout handling (not implemented yet)
- Graceful 500 responses
- Error logging with context
- Health check endpoint for monitoring

---

## Monitoring & Observability

### Metrics Exposed
- 40 agents status (idle/running/error)
- Total trades and P&L
- Win rate and Sharpe ratio
- Signal count (24-hour)
- Alert statistics

### Logging
- Structured logging with context
- Log levels: info, warn, error
- Request logging for API access
- Alert audit trail

### Real-time Monitoring
- WebSocket connection status
- Agent execution events
- Signal generation in real-time
- Trade completion notifications
- Alert delivery tracking

---

## Technology Stack

| Component | Technology | Purpose |
|-----------|-----------|---------|
| Runtime | Node.js 20 | JavaScript execution |
| Language | TypeScript | Type safety |
| Framework | Express.js | HTTP server |
| Database | PostgreSQL | Signal & trade persistence |
| WebSocket | ws library | Real-time updates |
| Exchange | Binance API | Trading execution |
| Alerts | Webhooks | Slack/Discord integration |
| Deployment | Railway | Cloud hosting |

---

## Future Enhancements

1. **Machine Learning:** Improve signal confidence with ML models
2. **Options Trading:** Extend to options strategies
3. **Multi-exchange:** Support multiple exchanges
4. **Advanced Analytics:** Backtesting & simulation engine
5. **Mobile App:** Native iOS/Android client
6. **Smart Contracts:** Autonomous execution on blockchain
7. **Team Collaboration:** Multi-user support with permissions
8. **Advanced Alerting:** SMS, email, in-app notifications
