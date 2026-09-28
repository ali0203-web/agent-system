# Deployment Guide

## Production Deployment (Railway)

### Prerequisites
- Railway account with project created
- GitHub repository connected
- Node.js 20+ environment
- PostgreSQL database (optional)

### Environment Setup

1. **Set API Keys:**
```bash
railway variables set API_KEYS=default-api-key-demo,sk-your-key-1,sk-your-key-2
railway variables set ADMIN_API_KEY=sk-admin-key-here
```

2. **Configure Alerting (Optional):**
```bash
# Slack
railway variables set SLACK_WEBHOOK_URL=https://hooks.slack.com/services/YOUR/WEBHOOK/URL

# Discord
railway variables set DISCORD_WEBHOOK_URL=https://discordapp.com/api/webhooks/YOUR/WEBHOOK/URL
```

3. **Allowed Origins (CORS):**
```bash
railway variables set ALLOWED_ORIGINS=https://yourapp.com,https://api.yourapp.com
```

### Deployment Steps

1. **Push to GitHub:**
```bash
git add .
git commit -m "Production deployment"
git push origin main
```

2. **Deploy to Railway:**
```bash
railway up
```

3. **Monitor Deployment:**
```bash
railway logs --follow
```

4. **Verify Health:**
```bash
curl https://agent-system-production-6667.up.railway.app/health
```

### Database Setup

If using Railway PostgreSQL:

1. **Create Database:**
```sql
CREATE DATABASE agent_system;
```

2. **Initialize Schema:**
```sql
-- Run src/db-schema.sql
```

3. **Connect Application:**
```bash
railway variables set DATABASE_URL=postgresql://user:password@host:5432/agent_system
```

---

## Local Development

### Quick Start

1. **Install Dependencies:**
```bash
npm install
```

2. **Build TypeScript:**
```bash
npm run build
```

3. **Run Development Server:**
```bash
npm run dev
```

4. **Access Dashboard:**
```
http://localhost:3000
```

### Environment Variables (Local)

Create `.env.local`:
```
API_KEYS=default-api-key-demo,dev-key-123
USE_TESTNET=true
LOG_LEVEL=debug
```

### Docker Setup (Optional)

1. **Build Image:**
```bash
docker build -t agent-system:latest .
```

2. **Run Container:**
```bash
docker run -p 3000:3000 \
  -e API_KEYS=default-api-key-demo \
  -e USE_TESTNET=true \
  agent-system:latest
```

---

## Configuration Options

### API Security
- `API_KEYS` - Comma-separated valid API keys
- `ADMIN_API_KEY` - Key for sensitive operations
- `ALLOWED_ORIGINS` - CORS allowed origins (comma-separated, or *)

### Binance Trading
- `USE_TESTNET` - true for testnet, false for mainnet (default: true)
- `BINANCE_TESTNET_KEY` - Testnet API key
- `BINANCE_TESTNET_SECRET` - Testnet API secret
- `BINANCE_MAINNET_KEY` - Mainnet API key (use carefully!)
- `BINANCE_MAINNET_SECRET` - Mainnet API secret

### Database
- `DATABASE_URL` - PostgreSQL connection string
- `POSTGRES_HOST` - Database host
- `POSTGRES_PORT` - Database port
- `POSTGRES_USER` - Database user
- `POSTGRES_PASSWORD` - Database password
- `POSTGRES_DB` - Database name

### Application
- `NODE_ENV` - development, production (default: production)
- `LOG_LEVEL` - debug, info, warn, error (default: info)
- `PORT` - Server port (default: 3000)

### Monitoring
- `SLACK_WEBHOOK_URL` - Slack alert webhook
- `DISCORD_WEBHOOK_URL` - Discord alert webhook

---

## Testing Deployment

### Health Check
```bash
curl https://your-app.railway.app/health
```

### API Test
```bash
curl -H "X-API-Key: your-api-key" \
  https://your-app.railway.app/api/agents | jq .
```

### Dashboard Access
```
https://your-app.railway.app
# (No authentication required for dashboard root)
```

### Rate Limit Test
```bash
# This should succeed (within limit)
curl -H "X-API-Key: your-api-key" \
  https://your-app.railway.app/api/security/rate-limit | jq .

# Make 101 requests quickly to test limit (returns 429)
for i in {1..101}; do
  curl -s -H "X-API-Key: your-api-key" \
    https://your-app.railway.app/api/agents > /dev/null
done
```

---

## Rollback Procedure

### If Deployment Fails

1. **Check Logs:**
```bash
railway logs --follow
```

2. **Rollback to Previous:**
```bash
railway deployments
railway rollback <deployment-id>
```

3. **Alternative: Force Rebuild:**
```bash
# Force rebuild from GitHub
railway up --force
```

---

## Performance Optimization

### Database
- Enable indexes on frequently queried columns
- Implement read replicas for scaling
- Archive old signals after 30 days
- Optimize query patterns

### API
- Implement response caching
- Use query parameter limits
- Batch signal requests when possible
- Monitor rate limit patterns

### Dashboard
- Use WebSocket instead of polling for real-time
- Implement incremental signal loading
- Cache agent list (updates every 5 min)
- Compress static assets

---

## Security Checklist

- [ ] Change all default API keys
- [ ] Set up CORS whitelist
- [ ] Enable HTTPS only (enforced by Railway)
- [ ] Rotate API keys regularly
- [ ] Monitor rate limit anomalies
- [ ] Enable database backups
- [ ] Set up alert notifications
- [ ] Review security headers
- [ ] Audit access logs weekly
- [ ] Test authentication flows

---

## Monitoring Production

### Key Metrics to Track
- API request rate
- Rate limit violations
- Agent execution success rate
- Database connection pool usage
- Dashboard WebSocket connections
- Alert delivery success rate
- System CPU & memory usage

### Alert Thresholds
- CPU > 80% for 5 minutes
- Memory > 90% for 5 minutes
- API 5xx errors > 1% of requests
- Database connection errors
- Agent error rate > 10%
- Alert delivery failures

### Log Analysis
```bash
# Watch for errors
railway logs --follow | grep ERROR

# Count API requests
railway logs | grep "GET /api" | wc -l

# Monitor rate limit hits
railway logs | grep "429"
```

---

## Backup & Recovery

### Database Backup
```bash
# Manual backup
pg_dump postgresql://user:pass@host/db > backup.sql

# Restore from backup
psql postgresql://user:pass@host/db < backup.sql
```

### Code Rollback
```bash
# View deployment history
railway deployments

# Rollback to specific deployment
railway rollback <deployment-id>
```

---

## Support

For deployment issues:
1. Check `railway logs --follow`
2. Verify environment variables are set
3. Test API endpoints manually
4. Check health endpoint
5. Review system resource usage

For more info: https://railway.app/docs
