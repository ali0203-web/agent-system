# 100-Agent System Deployment Guide

Deploy all 3 agents with the orchestrator to **Railway** or **Render** for 24/7 operation.

---

## 🚀 DEPLOYMENT TO RAILWAY (Recommended)

### Why Railway?
- ✅ Generous free tier (free $5/month credits)
- ✅ Auto-deploys from GitHub
- ✅ Built-in PostgreSQL database
- ✅ Built-in Redis cache
- ✅ Simple environment setup
- ✅ Pay-as-you-go ($10-50/month for production)

### Step 1: Prepare Repository

```bash
# Initialize git if needed
git init
git add -A
git commit -m "Add orchestrator system with 3 agents"

# Push to GitHub
git remote add origin https://github.com/YOUR_USERNAME/agent-system.git
git push -u origin main
```

### Step 2: Railway Setup

1. **Sign up** at https://railway.app
2. **Connect GitHub** (authorize Railway)
3. **Create New Project** → Import from GitHub
4. **Select your repo**
5. **Configure Environment Variables:**
   ```
   NODE_ENV=production
   LOG_LEVEL=info
   PORT=3000
   ```

### Step 3: Configure PostgreSQL

1. In Railway dashboard: **+ Add Service**
2. Select **PostgreSQL**
3. Copy the connection string to your project's `DATABASE_URL`
4. Select your project and add:
   ```
   DATABASE_URL=postgres://user:pass@host:port/dbname
   ```

### Step 4: Configure Redis (Optional)

1. **+ Add Service** → **Redis**
2. Add `REDIS_URL` to environment variables

### Step 5: Deploy

1. Click **Deploy** (Railway auto-deploys from git)
2. View logs in **Deployments** tab
3. Your API is now live at `https://your-app.railway.app`

### Test Deployment

```bash
# Test health
curl https://your-app.railway.app/health

# Get status
curl https://your-app.railway.app/api/status

# Get metrics
curl https://your-app.railway.app/api/metrics

# Get dashboard
curl https://your-app.railway.app/api/dashboard
```

---

## 🚀 DEPLOYMENT TO RENDER

### Why Render?
- ✅ Free tier available
- ✅ GitHub integration
- ✅ Simple Web Service setup
- ✅ PostgreSQL database available
- ✅ Automatic SSL

### Step 1: Push to GitHub (same as Railway)

### Step 2: Render Setup

1. **Sign up** at https://render.com
2. **Connect GitHub**
3. **New Web Service**
4. **Select your repository**

### Step 3: Configure

- **Name:** `agent-orchestrator`
- **Environment:** `Node`
- **Build Command:** `npm install && npm run build`
- **Start Command:** `node dist/server.js`
- **Plan:** Free (or paid for production)

### Step 4: Environment Variables

Add in Render dashboard:

```
NODE_ENV=production
LOG_LEVEL=info
PORT=3000
DATABASE_URL=postgresql://...
REDIS_URL=redis://...
```

### Step 5: Deploy

1. Click **Create Web Service**
2. Render auto-deploys from GitHub
3. Your service is live at `https://agent-orchestrator.onrender.com`

### Limitations

- Free tier sleeps after 15 minutes of inactivity
- For 24/7 operation, upgrade to **Starter Plan** ($7/month)

---

## 📊 COST ESTIMATES (Monthly)

### Railway
- **Free tier:** $5 credits/month
- **Production (3 agents):** $15-25/month
  - Web service: $5/month
  - PostgreSQL: $7/month
  - Redis: $3/month
  - Bandwidth: minimal

### Render
- **Free tier:** Sleep limitations
- **Production Starter:** $7/month (Web Service)
- **PostgreSQL:** $15/month
- **Total: $22/month**

### Recommended Setup for 100 Agents

When scaling to 100 agents:
- **Railway:** $50-100/month (better auto-scaling)
- **Render:** $80-150/month
- **Cost per agent:** $0.50-1.50/month (very cheap!)

---

## 🔧 LOCAL TESTING BEFORE DEPLOYMENT

```bash
# Install dependencies
npm install

# Build
npm run build

# Start locally
npm run start

# Test endpoints
curl http://localhost:3000/health
curl http://localhost:3000/api/status
curl http://localhost:3000/api/metrics
```

---

## 📈 MONITORING & DEBUGGING

### Railway Dashboard
- View logs in real-time
- Monitor memory/CPU usage
- See deployment history
- Set up alerts

### Render Dashboard
- Logs tab for debugging
- Metrics for performance
- Environment variables management

### API Health Endpoints

```bash
# Health check (3000ms timeout)
GET /health
→ { "status": "ok", "timestamp": "2026-09-26T..." }

# Orchestrator status
GET /api/status
→ { "isRunning": true, "agentCount": 3, "agents": [...] }

# All agent metrics
GET /api/metrics
→ { "orchestratorStatus": {...}, "agentMetrics": [...] }

# Single agent metrics
GET /api/metrics/:agentId
→ { agent metrics for bitcoin-monitor, portfolio-tracker, pump-dump-detector }

# Dashboard data (for web UI)
GET /api/dashboard
→ { status, agents, metrics, lastUpdated }
```

---

## 🔌 WEBHOOK INTEGRATION

Add webhooks for alerts:

```bash
# Configure your orchestrator to POST to webhooks
# On pump/dump signals:
POST https://your-webhook-service.com/alerts
{
  "type": "pump-dump-signal",
  "symbol": "ETHEREUM",
  "severity": "high",
  "priceChange": 8.5,
  "timestamp": "2026-09-26T..."
}

# On portfolio changes:
POST https://your-webhook-service.com/alerts
{
  "type": "portfolio-alert",
  "totalValue": 55464.84,
  "totalGain": 25414.84,
  "gainPercent": 84.58
}
```

---

## 🚨 PRODUCTION CHECKLIST

- [ ] Database backups configured (Railway/Render do this auto)
- [ ] Environment variables set (API keys, DB URLs)
- [ ] Health checks passing
- [ ] Logs monitored in dashboard
- [ ] Rate limits handled (retry logic in place)
- [ ] Error handling for external API failures
- [ ] Graceful shutdown on SIGTERM
- [ ] Monitoring alerts configured
- [ ] SSL/HTTPS enabled (auto with both services)

---

## 💡 NEXT STEPS

1. **Deploy to Railway** (recommended)
2. **Test API endpoints** from the live URL
3. **Configure alerting** for critical signals
4. **Build web dashboard** connected to API
5. **Scale to 100 agents** as needed
6. **Add more agent types** (DCA Bot, News Monitor, etc.)

---

## 🆘 TROUBLESHOOTING

### App Won't Start
- Check logs in Railway/Render
- Verify `DATABASE_URL` is set
- Check `package.json` has build script

### API Returns 500 Errors
- Check database connection
- Verify PostgreSQL is running
- Check logs for specific errors

### Agents Not Running
- Verify cron schedule is correct
- Check orchestrator logs
- Ensure agents can reach external APIs

### Rate Limiting from CoinGecko
- Already handled with exponential backoff
- Consider upgrading to CoinGecko paid tier
- Reduce polling frequency if needed

---

## 📞 SUPPORT

- Railway: https://railway.app/support
- Render: https://render.com/support
- GitHub Issues: Add to your repo
