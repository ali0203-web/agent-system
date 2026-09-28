# AgentOS Trading System - API Documentation

## Overview

The AgentOS Trading System provides a comprehensive REST API for monitoring and controlling a network of 40+ autonomous trading agents. All endpoints require authentication via API key.

**Base URL:** `https://agent-system-production-6667.up.railway.app`  
**Protocol:** HTTPS  
**Authentication:** Required (except `/health` and root `/`)

---

## Authentication

### API Key Methods

Provide your API key in one of three ways:

**1. Authorization Header (Recommended)**
```bash
curl -H "Authorization: Bearer YOUR_API_KEY" \
  https://agent-system-production-6667.up.railway.app/api/agents
```

**2. X-API-Key Header**
```bash
curl -H "X-API-Key: YOUR_API_KEY" \
  https://agent-system-production-6667.up.railway.app/api/agents
```

**3. Query Parameter (Least Secure)**
```bash
curl "https://agent-system-production-6667.up.railway.app/api/agents?api_key=YOUR_API_KEY"
```

### Rate Limits

- **Limit:** 100 requests per minute per API key
- **Status Code:** 429 Too Many Requests when exceeded
- **Check Status:** `GET /api/security/rate-limit`

---

## Endpoints

### Agent Management

#### GET /api/agents
List all agents in the fleet.

**Response:**
```json
{
  "total": 40,
  "agents": [
    {
      "id": "bitcoin-monitor",
      "name": "bitcoin-price-monitor",
      "status": "idle",
      "schedule": "*/5 * * * *",
      "isRunning": false,
      "lastRun": "2026-09-28T08:20:00.181Z"
    }
  ]
}
```

#### GET /api/agents/:agentId
Get details for a specific agent.

**Parameters:**
- `agentId` (string): Agent identifier

**Response:**
```json
{
  "id": "bitcoin-monitor",
  "name": "bitcoin-price-monitor",
  "status": "idle",
  "schedule": "*/5 * * * *"
}
```

#### POST /api/agents/:agentId/run
Manually trigger an agent to execute immediately.

**Parameters:**
- `agentId` (string): Agent identifier

**Response:**
```json
{
  "success": true,
  "message": "Agent trigger queued"
}
```

---

### Signal Management

#### GET /api/signals
Get latest signals from all agents.

**Query Parameters:**
- `limit` (integer, default: 100): Maximum number of signals to return
- `agentId` (string, optional): Filter by agent ID

**Response:**
```json
{
  "signals": [
    {
      "id": "sig-001",
      "agent_id": "momentum-trader",
      "agent_name": "momentum-trader",
      "symbol": "BTC/USDT",
      "signal_type": "bullish",
      "confidence": 0.85,
      "message": "Price momentum detected",
      "timestamp": "2026-09-28T12:00:00Z"
    }
  ]
}
```

#### GET /api/signals/:agentId
Get signals for a specific agent.

**Parameters:**
- `agentId` (string): Agent identifier

---

### Performance Metrics

#### GET /api/metrics
Get performance metrics for all agents.

**Response:**
```json
{
  "metrics": [
    {
      "agent_id": "bitcoin-monitor",
      "agent_name": "bitcoin-price-monitor",
      "total_trades": 45,
      "profit_loss": 1250.50,
      "win_rate": 0.62,
      "sharpe_ratio": 1.45,
      "avg_holding_time": 120
    }
  ]
}
```

#### GET /api/metrics/daily
Get daily aggregated metrics.

**Response:**
```json
{
  "date": "2026-09-28",
  "totalAgents": 40,
  "totalTrades": 847,
  "aggregatePnL": 12500.75,
  "avgWinRate": 0.58
}
```

#### GET /api/performance
Get top and worst performing agents.

**Response:**
```json
{
  "topPerformers": [
    {
      "agent_name": "momentum-trader",
      "profit_loss": 3500.00,
      "win_rate": 0.72
    }
  ],
  "needsAttention": [
    {
      "agent_name": "grid-trading-bot",
      "profit_loss": -500.00,
      "win_rate": 0.45
    }
  ]
}
```

---

### System Health

#### GET /api/health
System health status (no authentication required).

**Response:**
```json
{
  "status": "healthy",
  "timestamp": "2026-09-28T12:00:00.000Z",
  "agents": 40,
  "runningAgents": 0
}
```

---

### Monitoring & Alerts

#### GET /api/alerts/status
Get alert system status.

**Response:**
```json
{
  "alerts": {
    "totalAlerts": 0,
    "rules": 7,
    "slackConfigured": true,
    "discordConfigured": false
  },
  "configured": {
    "slack": true,
    "discord": false
  }
}
```

#### POST /api/alerts/test
Send a test alert (for debugging).

**Request Body:**
```json
{
  "type": "high-confidence-signal",
  "severity": "warning"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Test alert sent"
}
```

---

### Security

#### GET /api/security/info
Get security configuration (requires authentication).

**Response:**
```json
{
  "authentication": {
    "required": true,
    "methods": [
      "Authorization: Bearer <api-key>",
      "X-API-Key: <api-key>",
      "Query: ?api_key=<api-key>"
    ]
  },
  "rateLimit": {
    "enabled": true,
    "maxRequests": 100,
    "windowSeconds": 60,
    "endpoint": "/api/security/rate-limit"
  }
}
```

#### GET /api/security/rate-limit
Get current rate limit status.

**Response:**
```json
{
  "apiKey": "default-ap...",
  "rateLimit": {
    "count": 5,
    "limit": 100,
    "resetTime": 1790600099486,
    "remaining": 95,
    "resetIn": 50992
  },
  "message": "95 requests remaining in current window (resets in 51.0s)"
}
```

---

### Dashboard API

#### GET /api/dashboard/agents
Get agent data formatted for dashboard.

**Response:**
```json
{
  "agents": [
    {
      "id": "bitcoin-monitor",
      "name": "bitcoin-price-monitor",
      "status": "idle"
    }
  ]
}
```

#### GET /api/dashboard/signals
Get signals formatted for dashboard real-time feed.

**Response:**
```json
{
  "signals": [
    {
      "agent_name": "momentum-trader",
      "signal_type": "bullish",
      "message": "Momentum detected",
      "timestamp": "2026-09-28T12:00:00Z"
    }
  ]
}
```

#### GET /api/dashboard/summary
Get portfolio summary for dashboard.

**Response:**
```json
{
  "summary": [
    {
      "agent_id": "bitcoin-monitor",
      "agent_name": "bitcoin-price-monitor",
      "total_trades": 45,
      "profit_loss": 1250.50,
      "win_rate": 0.62
    }
  ]
}
```

---

## Error Responses

### 401 Unauthorized
```json
{
  "error": "Unauthorized",
  "message": "API key required. Provide via Authorization header (Bearer), X-API-Key header, or api_key query parameter."
}
```

### 403 Forbidden
```json
{
  "error": "Forbidden",
  "message": "Invalid API key."
}
```

### 429 Too Many Requests
```json
{
  "error": "Too Many Requests",
  "message": "Rate limit exceeded: 100 requests per 60 seconds."
}
```

### 500 Internal Server Error
```json
{
  "error": "Internal Server Error",
  "message": "An unexpected error occurred."
}
```

---

## WebSocket Connection

The dashboard uses WebSocket for real-time updates (no API key required for dashboard root path).

**URL:** `ws://localhost:3000` or `wss://agent-system-production-6667.up.railway.app`

**Message Types:**
- `status-update`: Periodic agent status updates
- `agent-completed`: Agent execution completion
- `agent-failed`: Agent execution failure
- `signal-generated`: New signal from agent
- `trade-closed`: Trade execution completion

---

## Code Examples

### JavaScript / Node.js
```javascript
const apiKey = 'your-api-key-here';
const headers = {
  'X-API-Key': apiKey,
  'Content-Type': 'application/json'
};

// Get all agents
const response = await fetch('https://agent-system-production-6667.up.railway.app/api/agents', {
  headers
});
const data = await response.json();
console.log(`Found ${data.total} agents`);
```

### Python
```python
import requests

api_key = 'your-api-key-here'
headers = {'X-API-Key': api_key}

response = requests.get(
    'https://agent-system-production-6667.up.railway.app/api/agents',
    headers=headers
)
agents = response.json()
print(f"Found {agents['total']} agents")
```

### cURL
```bash
curl -H "X-API-Key: your-api-key-here" \
  https://agent-system-production-6667.up.railway.app/api/agents | jq .
```

---

## Best Practices

1. **Security:**
   - Never commit API keys to version control
   - Use environment variables for API key management
   - Rotate API keys regularly
   - Use Authorization header instead of query parameters

2. **Rate Limiting:**
   - Implement exponential backoff for 429 responses
   - Cache responses when possible
   - Use batch endpoints where available

3. **Reliability:**
   - Implement timeout handling
   - Retry failed requests with exponential backoff
   - Monitor rate limit status before making requests

4. **Monitoring:**
   - Check `/api/health` regularly for system status
   - Subscribe to WebSocket for real-time updates
   - Set up alerts for critical events

---

## Support

For API issues or questions, check:
- `/api/security/info` - Security configuration details
- `/api/security/rate-limit` - Current rate limit status
- `/api/health` - System health status
