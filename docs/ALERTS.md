# Alerts Configuration & Setup Guide

## Overview

The AgentOS alerting system monitors agent execution, trading performance, and portfolio risk in real-time. Alerts are triggered by configurable rules and delivered to Slack and Discord webhooks.

---

## Alert System Architecture

### Event Flow
```
Agent Event → AlertingService → Rules Engine → Deduplication → Webhook Delivery
     ↓                              ↓              ↓               ↓
agent-failed          7 alert rules   5-sec       Slack/Discord
signal-generated      configured      window       Console log
trade-closed          thresholds      for dups    Email (future)
```

### Features
- **Rate Limiting:** Max 1 alert per rule per 60 seconds
- **Deduplication:** Prevents duplicate alerts within 5-second window
- **Graceful Degradation:** Works without webhooks configured (logs to console)
- **Color-Coded:** Slack/Discord alerts with severity indicators
- **Rich Formatting:** Structured data fields for easy reading

---

## Alert Rules (7 Total)

### Rule 1: Agent Failed (Critical)
**When Triggered:** Agent execution crashes or returns error  
**Severity:** Critical (Red)  
**Rate Limit:** 1 per 60 seconds per agent  
**Example Message:**
```
🚨 Agent Failed: momentum-trader
Error: Connection timeout to Binance API
```

**Slack Format:**
```json
{
  "title": "🚨 Agent Failed",
  "severity": "critical",
  "agentName": "momentum-trader",
  "error": "Connection timeout",
  "timestamp": "2026-09-28T12:00:00Z"
}
```

---

### Rule 2: High Error Rate (Critical)
**When Triggered:** 5+ consecutive agent failures  
**Severity:** Critical (Red)  
**Rate Limit:** 1 per 60 seconds  
**Example Message:**
```
🚨 High Error Rate: grid-trading-bot
Errors: 7 consecutive failures in last 15 minutes
Action: Agent has been disabled, review Binance API status
```

---

### Rule 3: Low Signal Rate (Warning)
**When Triggered:** No signals generated for 30+ minutes  
**Severity:** Warning (Yellow)  
**Rate Limit:** 1 per 60 seconds  
**Example Message:**
```
⚠️ Low Signal Rate
No signals generated in last 30 minutes
Possible causes: Market sideways, agents idle, API rate limits
```

---

### Rule 4: Portfolio Risk (Warning)
**When Triggered:** Risk level changes to "high" or "critical"  
**Severity:** Warning (Yellow) / Critical (Red)  
**Rate Limit:** 1 per 60 seconds  
**Example Message:**
```
⚠️ Portfolio Risk: CRITICAL
Current Exposure: 127% of account
Recommendation: Reduce position size immediately
```

---

### Rule 5: Large P&L Swing (Warning)
**When Triggered:** P&L change > $1000  
**Severity:** Warning (Yellow)  
**Rate Limit:** 1 per 60 seconds  
**Example Message:**
```
⚠️ Large P&L Swing
Change: -$1,250 (1.25% of portfolio)
Agent: mean-reversion-oracle
```

---

### Rule 6: Profitable Trade (Info)
**When Triggered:** Trade closed with profit > $100  
**Severity:** Info (Green)  
**Rate Limit:** 1 per 60 seconds  
**Example Message:**
```
✅ Profitable Trade Closed
Symbol: BTC/USDT
Profit: +$250 (5% ROI)
Agent: scalping-bot
```

---

### Rule 7: High Confidence Signal (Info)
**When Triggered:** Signal with confidence ≥ 85%  
**Severity:** Info (Green)  
**Rate Limit:** 1 per 60 seconds  
**Example Message:**
```
📊 High Confidence Signal
Agent: ichimoku-bot
Signal: BULLISH
Confidence: 87%
Symbol: ETH/USDT
```

---

## Setup Instructions

### Step 1: Get Webhook URLs

#### Slack Webhook
1. Go to https://api.slack.com/apps
2. Create New App → From scratch
3. Set app name: "AgentOS Trading Alerts"
4. Select workspace
5. Navigate to "Incoming Webhooks"
6. Click "Create New Webhook for Workspace"
7. Select channel (e.g., #trading-alerts)
8. Copy webhook URL

#### Discord Webhook
1. Open Discord server settings
2. Go to Integrations → Webhooks
3. Click "Create Webhook"
4. Name: "AgentOS Trading Alerts"
5. Copy webhook URL

### Step 2: Set Environment Variables

**Option A: Railway (Production)**
```bash
# Go to Railway project settings
railway variables set SLACK_WEBHOOK_URL="https://hooks.slack.com/services/YOUR/WEBHOOK/URL"
railway variables set DISCORD_WEBHOOK_URL="https://discordapp.com/api/webhooks/YOUR/WEBHOOK"
```

**Option B: Local Development**
```bash
# Create .env.local
SLACK_WEBHOOK_URL="https://hooks.slack.com/services/YOUR/WEBHOOK/URL"
DISCORD_WEBHOOK_URL="https://discordapp.com/api/webhooks/YOUR/WEBHOOK"
```

**Option C: Docker**
```bash
docker run -e SLACK_WEBHOOK_URL="..." -e DISCORD_WEBHOOK_URL="..." agent-system:latest
```

### Step 3: Verify Configuration

```bash
# Test alerts with API endpoint
curl -X POST http://localhost:3000/api/alerts/test \
  -H "Content-Type: application/json" \
  -H "X-API-Key: default-api-key-demo" \
  -d '{
    "type": "high-confidence-signal",
    "severity": "info"
  }'
```

**Expected Response:**
```json
{
  "success": true,
  "message": "Test alert sent"
}
```

Check Slack/Discord channels for test message (green info alert).

---

## Alert Endpoints

### GET /api/alerts/status
Returns alert system configuration and statistics.

**Response:**
```json
{
  "alerts": {
    "totalAlerts": 42,
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

### POST /api/alerts/test
Send a test alert to all configured webhooks.

**Request Body:**
```json
{
  "type": "agent-failed",
  "severity": "critical"
}
```

**Type Options:**
- `agent-failed`
- `agent-error-spike`
- `low-signal-rate`
- `portfolio-risk-update`
- `large-pnl-swing`
- `trade-closed`
- `high-confidence-signal`

---

## Customizing Alert Rules

### Modifying Thresholds

**File:** `src/services/alerting-service.ts`

```typescript
// Example: Change large P&L swing threshold from $1000 to $500
case 'large-pnl-swing':
  if (eventData.pnlChange >= 500) {  // Changed from 1000
    return this.createAlert('Large P&L Swing', eventData.pnlChange, 'warning')
  }
  break
```

### Adding a New Alert Rule

1. **Add to switch statement** in `setupAlertRules()`:
```typescript
case 'my-new-rule':
  if (myCondition) {
    return this.createAlert('My New Rule', details, 'warning')
  }
  break
```

2. **Listen for event** in `src/dashboard-server.ts`:
```typescript
orchestrator.on('my-event', (data) => {
  alertingService.checkAndAlert('my-new-rule', data)
})
```

3. **Test it**:
```bash
curl -X POST http://localhost:3000/api/alerts/test \
  -H "X-API-Key: default-api-key-demo" \
  -d '{"type": "my-new-rule"}'
```

---

## Alert Delivery

### Slack Message Format

**High Severity Alert (Critical):**
```
🚨 Agent Failed
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Agent: momentum-trader
Error: Connection timeout
Time: 2026-09-28 12:00:00 UTC
Status: CRITICAL
```

**Info Alert (Green):**
```
✅ Profitable Trade Closed
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Symbol: BTC/USDT
Profit: +$250
ROI: 5%
Agent: scalping-bot
```

### Discord Message Format

**Embedded Message:**
- Color indicator (red/yellow/green)
- Title with emoji
- Structured fields
- Timestamp

---

## Troubleshooting

### Alerts Not Arriving

1. **Check webhook URL:**
```bash
curl -X POST $SLACK_WEBHOOK_URL -H "Content-Type: application/json" \
  -d '{"text": "Test message"}'
```

2. **Verify environment variables:**
```bash
# In Railway
railway variables list | grep WEBHOOK

# Locally
env | grep WEBHOOK
```

3. **Check logs:**
```bash
# View dashboard server logs
npm run dev 2>&1 | grep "alert"

# Production (Railway)
railway logs --follow | grep "alert"
```

4. **Test endpoint:**
```bash
curl http://localhost:3000/api/alerts/test \
  -X POST \
  -H "X-API-Key: default-api-key-demo" \
  -H "Content-Type: application/json" \
  -d '{"type": "agent-failed"}'
```

### Rate Limiting Too Aggressive

If alerts are getting suppressed (same rule fires 2+ times):
1. Check 5-second deduplication window
2. Modify in `src/services/alerting-service.ts`:
```typescript
const DEDUP_WINDOW = 10000  // Increase from 5000 (5s) to 10000 (10s)
```

### Webhook Rejecting Alerts

**Slack Issues:**
- Webhook URL is invalid or expired
- Workspace deleted the app
- Solution: Re-create webhook and update environment variable

**Discord Issues:**
- Webhook was deleted from server
- Channel permissions changed
- Solution: Re-create webhook in server settings

---

## Alert Monitoring & Analytics

### View Recent Alerts
```bash
# Via API (if implemented)
curl http://localhost:3000/api/alerts/history \
  -H "X-API-Key: default-api-key-demo"
```

### Count Alerts by Type
```bash
# View dashboard logs for alert summary
grep "alert" logs/combined.log | wc -l

# Filter by severity
grep "CRITICAL" logs/combined.log | wc -l
```

### Alert Performance Metrics
- **Total Alerts:** Track monthly volume
- **True Positives:** Alerts that led to actions
- **False Positives:** Alerts that didn't matter
- **Response Time:** How fast team acts on alerts

---

## Best Practices

1. **Channel Organization:**
   - #trading-alerts: All alerts
   - #trading-critical: Critical only (use Slack filter)
   - #trading-daily: Info/success alerts only

2. **Notification Settings:**
   - Slack: Set notifications to high priority for critical alerts
   - Discord: Use @mentions for critical severity

3. **Escalation Rules:**
   - Critical alert → immediate notification
   - Warning alert → check within 10 minutes
   - Info alert → check in daily review

4. **Alert Tuning:**
   - Start with defaults, then adjust thresholds
   - Disable noisy rules (e.g., high-confidence-signal)
   - Increase rate limits on low-importance rules

5. **Backup Notifications:**
   - Set up email or SMS for critical alerts (future)
   - Have manual monitoring as fallback
   - Test webhooks weekly

---

## Future Enhancements

1. **SMS Alerts:** Critical alerts via Twilio
2. **Email Digests:** Daily summary emails
3. **PagerDuty Integration:** On-call escalation
4. **Alert Dashboard:** View/acknowledge alerts in-app
5. **Custom Rules:** User-defined alert conditions
6. **Audit Log:** Track all alert deliveries

---

## Support & Questions

For alert issues:
1. Check `/api/alerts/status` endpoint
2. Review `src/services/alerting-service.ts` for rule logic
3. Test with `/api/alerts/test` endpoint
4. Monitor webhook delivery in Slack/Discord audit logs
5. Review production logs via `railway logs`
