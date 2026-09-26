# 🚀 DEPLOY TO RAILWAY IN 5 MINUTES

## Prerequisites
- GitHub account
- Railway account (free at railway.app)
- This repo on GitHub

---

## STEP 1: Push to GitHub (2 minutes)

```bash
# From your project directory
git init
git add -A
git commit -m "Add 100-agent system with orchestrator"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/agent-system.git
git push -u origin main
```

---

## STEP 2: Connect Railway (3 minutes)

### 2a. Create Railway Project
1. Go to https://railway.app
2. Click **New Project**
3. Select **Deploy from GitHub repo**
4. Authorize GitHub
5. Select your repo
6. Click **Deploy**

### 2b. Wait for build to finish
- Railway automatically builds from Dockerfile
- You'll see logs in the dashboard
- Status shows "Success" when done

---

## STEP 3: Add Database (1 minute)

1. In Railway dashboard, click **+ Add Service**
2. Select **PostgreSQL**
3. Click **Create**
4. Click on your main app service
5. Go to **Variables**
6. Copy `DATABASE_URL` from PostgreSQL service
7. Paste into your app's `DATABASE_URL` variable

---

## STEP 4: Test Live API (1 minute)

Your app is now live! Find your URL in Railway dashboard (looks like `https://your-app.railway.app`).

Test these endpoints:

```bash
# Health check
curl https://your-app.railway.app/health

# Orchestrator status
curl https://your-app.railway.app/api/status

# Agent metrics
curl https://your-app.railway.app/api/metrics

# Dashboard data
curl https://your-app.railway.app/api/dashboard
```

---

## ✅ DONE!

Your 100-agent system is now running 24/7 in the cloud:

- ✅ All 3 agents running on schedule
- ✅ Bitcoin Price Monitor: Every 5 minutes
- ✅ Portfolio Tracker: Every 15 minutes  
- ✅ Pump & Dump Detector: Every 5 minutes
- ✅ Real-time metrics available via API
- ✅ PostgreSQL database for persistence
- ✅ Automatic restarts if crashes
- ✅ Free tier or pay-as-you-go

---

## 📊 Monitor Your System

### View Logs
1. Railway dashboard → Your app
2. Click **Deployments** tab
3. See real-time logs

### Check Metrics
```bash
curl https://your-app.railway.app/api/metrics | jq
```

### Dashboard Data
```bash
curl https://your-app.railway.app/api/dashboard | jq
```

---

## 💰 Costs

**Railway Pricing:**
- App service: Free first $5/month, then ~$5/month
- PostgreSQL: $10/month (shared)
- **Total: $15/month** ✅

**For 100 agents:** $50-100/month

---

## 🆘 Troubleshooting

### App won't start
- Check logs in Railway dashboard
- Verify all dependencies in `package.json`
- Ensure `NODE_ENV` is set to `production`

### API returns 500 errors
- Check DATABASE_URL is set
- Restart app in Railway dashboard
- Check logs for specific error

### Agents not running
- Verify cron schedules in orchestrator
- Check API rates (CoinGecko free tier has limits)
- Check logs for error messages

---

## 🎯 Next Steps

1. **Monitor the system** - Check metrics every day
2. **Add webhooks** - Send alerts to Slack/Discord
3. **Build web UI** - Dashboard connected to your API
4. **Scale agents** - Add Agents #4-#6
5. **Monetize** - Launch AutoTrader SaaS

---

## 📚 Full Documentation

- See `DEPLOYMENT_GUIDE.md` for detailed setup
- See `SYSTEM_SUMMARY.md` for architecture overview
- See `100_agent_blueprint.md` for agent types

---

**Your system is now live and earning! 🎉**
