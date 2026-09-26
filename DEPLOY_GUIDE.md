# 🚀 AGENT #1 DEPLOYMENT GUIDE
## Bitcoin Price Monitor - From Local to Production

---

## 📋 QUICK START (5 MINUTES)

### Step 1: Install Dependencies
```bash
npm install
```

### Step 2: Test Locally
```bash
npm run test:agent
```

You should see:
```
📋 TEST 1: Health Check
Result: ✅ PASS

📋 TEST 2: Validation
Result: ✅ PASS

📋 TEST 3: Execute Agent
Result: {success: true, priceData: [...], alerts: []}
```

### Step 3: Run Agent
```bash
npm run dev
```

Output:
```
╔════════════════════════════════════════════════════════════╗
║    🚀 Agent #1: Bitcoin Price Monitor                      ║
║    Starting production service...                          ║
╚════════════════════════════════════════════════════════════╝

✅ Agent validation passed
⚡ Running agent immediately...
📅 Setting up schedule: Every 5 minutes
✅ Agent service started successfully

📊 Status:
   • Agent: Bitcoin Price Monitor
   • Schedule: Every 5 minutes
   • API: CoinGecko (free)
   • Status: ✅ Running

Press Ctrl+C to stop the service
```

---

## 🌍 DEPLOY TO PRODUCTION (RENDER.COM - FREE)

### Step 1: Create GitHub Repository

```bash
# Initialize git
git init
git add .
git commit -m "Initial commit: Bitcoin Price Monitor Agent #1"

# Create repo on GitHub
# Visit: https://github.com/new
# Name: agents-100-system
# Push to GitHub:
git remote add origin https://github.com/YOUR_USERNAME/agents-100-system.git
git branch -M main
git push -u origin main
```

### Step 2: Deploy to Render

1. **Sign up** at https://render.com (free tier)
2. **Create new Web Service**
   - Connect your GitHub repo
   - Choose: `agents-100-system`
3. **Configure:**
   - **Name:** `bitcoin-price-monitor`
   - **Environment:** `Node`
   - **Build Command:** `npm install && npm run build`
   - **Start Command:** `npm start`
   - **Plan:** Free (or Starter $7/month for reliability)

4. **Environment Variables:**
   - Click "Advanced"
   - Add variables from `.env.example`:
     ```
     NODE_ENV=production
     LOG_LEVEL=info
     DATABASE_URL=(optional, use free PostgreSQL if needed)
     REDIS_URL=(optional)
     ```

5. **Deploy!**
   - Render automatically deploys on git push
   - Watch logs: https://dashboard.render.com

---

## 🗄️ DATABASE SETUP (OPTIONAL)

### Option A: Use Supabase (FREE PostgreSQL)

1. **Sign up:** https://supabase.com
2. **Create new project**
3. **Copy connection string** from settings
4. **Add to Render environment:**
   ```
   DATABASE_URL=postgresql://user:password@db.supabase.co/postgres
   ```

### Option B: Use Render's Free PostgreSQL

1. In Render dashboard: Create new PostgreSQL
2. Copy connection string to `.env`

### Option C: Skip Database (For Now)

The agent works fine without a database initially. Data is logged to console/files.

---

## 🔄 CONTINUOUS DEPLOYMENT

### Auto-Deploy on Git Push

Render automatically redeploys when you push to GitHub:

```bash
# Make changes
nano src/agents/bitcoin-price-monitor.ts

# Commit and push
git add .
git commit -m "Update price alert thresholds"
git push

# Render automatically rebuilds and deploys! ✨
```

### Monitoring Logs

```bash
# In Render dashboard
# Go to your service → Logs tab
# Watch real-time logs:

2024-09-26T10:15:00Z [INFO] [Bitcoin Price Monitor] ⚡ Running agent immediately...
2024-09-26T10:15:02Z [INFO] [Bitcoin Price Monitor] Fetching Bitcoin price...
2024-09-26T10:15:03Z [INFO] [Bitcoin Price Monitor] ✅ Price data collected: BTC: $42,500 USD
2024-09-26T10:20:00Z [INFO] [Bitcoin Price Monitor] 🔄 Running scheduled execution...
```

---

## 📊 MONITORING & ALERTS

### View Agent Status

```bash
# Local
npm run dev

# Production (Render logs)
# Dashboard → Services → bitcoin-price-monitor → Logs
```

### Setup Slack Alerts (Optional)

1. Create Slack webhook: https://api.slack.com/messaging/webhooks
2. Add to `.env`:
   ```
   SLACK_WEBHOOK=https://hooks.slack.com/services/YOUR/WEBHOOK/URL
   ```

### Price Alert Triggers

Agent automatically publishes alerts when:
- Bitcoin price changes > 2%
- In USD or EUR
- Multiple severity levels (high: >5%, medium: 2-5%)

---

## 🧪 TESTING IN PRODUCTION

### Test Price Fetching
```bash
# SSH into Render (if available)
curl https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd

# Should return:
{"bitcoin":{"usd":42500}}
```

### View Stored Results
```bash
# If using database:
SELECT * FROM agent_results 
WHERE agent_name = 'bitcoin-price-monitor' 
ORDER BY executed_at DESC 
LIMIT 10;
```

---

## 💰 COST BREAKDOWN

| Component | Free Tier | Cost |
|-----------|-----------|------|
| Render Hosting | 750 hours/month | $0 |
| CoinGecko API | Unlimited | $0 |
| Database (optional) | 1GB Supabase | $0 |
| **TOTAL** | | **$0** |

**Upgrade Path (if needed):**
- Render Starter: $7/month
- Supabase Pro: $25/month
- Total: $32/month (still very cheap!)

---

## 🔧 TROUBLESHOOTING

### "Agent validation failed"
```
❌ Solution:
- Check internet connection
- Verify CoinGecko API is up: https://api.coingecko.com/api/v3/ping
- Check rate limiting (free tier: 1000 calls/hour)
```

### "Database connection failed"
```
❌ Solution:
- If DATABASE_URL not set, agent works without DB
- To enable DB, add Supabase PostgreSQL URL
- No database needed initially
```

### "Port 3000 already in use"
```
❌ Solution:
npm run dev -- --port 3001
```

### Logs not appearing
```
❌ Solution:
- Check LOG_LEVEL=info in .env
- View logs locally: npm run dev
- In Render: check Logs tab in dashboard
```

---

## 📈 NEXT STEPS

### Day 1 (Today):
- ✅ Test locally: `npm run test:agent`
- ✅ Deploy to Render: Follow steps above
- ✅ Verify it's running: Check Render logs
- ✅ Test price alerts: Watch logs for 5 minutes

### Day 2:
- Build Agent #2: Portfolio Tracker
- Create shared utilities for multiple agents

### Day 3:
- Build Agent #3: Pump & Dump Detector
- Start orchestration system

### Week 2:
- Build Agents #4-5
- Create monitoring dashboard
- Set up alert system

---

## 📚 PROJECT STRUCTURE

```
agents-100-system/
├─ src/
│  ├─ agents/
│  │  └─ bitcoin-price-monitor.ts    (Agent #1)
│  ├─ base-agent.ts                  (Base class)
│  ├─ database.ts                    (DB utilities)
│  ├─ logger.ts                      (Logging)
│  ├─ index.ts                       (Main entry)
│  └─ test-agent.ts                  (Tests)
├─ dist/                             (Built JS)
├─ package.json
├─ tsconfig.json
├─ Dockerfile
├─ .env.example
└─ DEPLOY_GUIDE.md                   (This file)
```

---

## ✅ FINAL CHECKLIST

- [ ] Dependencies installed: `npm install`
- [ ] Tests passing: `npm run test:agent`
- [ ] Local run works: `npm run dev`
- [ ] GitHub repo created
- [ ] Render account created
- [ ] Service deployed to Render
- [ ] Environment variables configured
- [ ] Logs viewable in Render dashboard
- [ ] Agent running on 5-minute schedule
- [ ] Ready to build Agent #2!

---

## 🎉 YOU'RE LIVE!

Your Bitcoin Price Monitor is now running 24/7 in production!

Next: Build Agent #2 (Portfolio Tracker)

Questions? Check the main blueprint and guides! 🚀

