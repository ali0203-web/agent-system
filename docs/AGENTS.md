# 40 Trading Agents - Strategy Guide

## Overview

The AgentOS system consists of 40 specialized autonomous trading agents, each executing a specific strategy on the Binance cryptocurrency exchange. Agents run on 5-15 minute schedules and emit signals for portfolio management and risk monitoring.

---

## Agent Categories

### 1. Basic Monitoring Agents (5 agents)

#### Agent 1: Bitcoin Price Monitor
- **ID:** bitcoin-monitor
- **Strategy:** Tracks BTC/USDT price movements and alerts on significant volatility
- **Trigger:** Price change > 2% in 5-minute window
- **Signal Type:** bullish, bearish, neutral
- **Risk Level:** Low
- **Execution Interval:** Every 5 minutes

#### Agent 2: Ethereum Portfolio Monitor
- **ID:** ethereum-monitor
- **Strategy:** Monitors ETH holdings and P&L in real-time
- **Trigger:** Position change or price move > 1.5%
- **Signal Type:** position-update
- **Risk Level:** Low
- **Execution Interval:** Every 5 minutes

#### Agent 3: Portfolio Rebalancer
- **ID:** portfolio-rebalancer
- **Strategy:** Detects portfolio imbalances and suggests rebalancing
- **Trigger:** Asset allocation drift > 5%
- **Signal Type:** rebalance-suggestion
- **Risk Level:** Medium
- **Execution Interval:** Every 15 minutes

#### Agent 4: Pump & Dump Detector
- **ID:** pump-dump-detector
- **Strategy:** Detects abnormal volume and price spikes
- **Trigger:** Volume spike > 200% + price move > 5%
- **Signal Type:** pump-detected, dump-detected
- **Risk Level:** High
- **Execution Interval:** Every 5 minutes

#### Agent 5: DCA Purchase Agent
- **ID:** dca-purchase-agent
- **Strategy:** Dollar-cost averaging purchases on set schedule
- **Trigger:** Scheduled daily + portfolio cash available
- **Signal Type:** dca-purchase
- **Risk Level:** Low
- **Execution Interval:** Every 1 hour

---

### 2. Technical Analysis Agents (10 agents)

#### Agent 6: Moving Average Crossover
- **ID:** moving-average-crossover
- **Strategy:** Golden cross (MA50 > MA200) and death cross detection
- **Indicators:** SMA 50, SMA 200
- **Confidence Range:** 60-85%
- **Risk Level:** Medium
- **Execution Interval:** Every 15 minutes

#### Agent 7: MACD Divergence Bot
- **ID:** macd-divergence-bot
- **Strategy:** Detects MACD convergence/divergence and signal line crosses
- **Indicators:** MACD, Signal Line, Histogram
- **Confidence Range:** 55-80%
- **Risk Level:** Medium
- **Execution Interval:** Every 10 minutes

#### Agent 8: RSI Overbought/Oversold
- **ID:** rsi-oscillator
- **Strategy:** Identifies RSI extremes for mean reversion
- **Indicators:** RSI(14)
- **Signal Thresholds:** RSI > 70 (overbought), RSI < 30 (oversold)
- **Confidence Range:** 65-90%
- **Risk Level:** Medium
- **Execution Interval:** Every 10 minutes

#### Agent 9: Stochastic Momentum
- **ID:** stochastic-bot
- **Strategy:** K% vs D% crossovers for momentum confirmation
- **Indicators:** %K(14,3), %D(3)
- **Confidence Range:** 60-75%
- **Risk Level:** Medium-High
- **Execution Interval:** Every 15 minutes

#### Agent 10: Bollinger Bands
- **ID:** bollinger-bands
- **Strategy:** Price breakouts and mean reversion on bands
- **Indicators:** 20-period Bollinger Bands
- **Confidence Range:** 55-75%
- **Risk Level:** Medium
- **Execution Interval:** Every 10 minutes

#### Agent 11: Ichimoku Cloud
- **ID:** ichimoku-bot
- **Strategy:** Trend and support/resistance from Ichimoku Cloud
- **Indicators:** Tenkan-sen, Kijun-sen, Cloud
- **Confidence Range:** 70-85%
- **Risk Level:** Medium
- **Execution Interval:** Every 15 minutes

#### Agent 12: ADX Trend Strength
- **ID:** adx-trend-meter
- **Strategy:** Only trades when ADX > 25 (strong trend)
- **Indicators:** ADX(14), +DI, -DI
- **Confidence Range:** 75-90%
- **Risk Level:** Medium-Low
- **Execution Interval:** Every 15 minutes

#### Agent 13: Keltner Channel
- **ID:** keltner-channel-bot
- **Strategy:** Mean reversion trades within channels
- **Indicators:** 20-period Keltner Channels
- **Confidence Range:** 60-78%
- **Risk Level:** Medium
- **Execution Interval:** Every 15 minutes

#### Agent 14: Pivot Points
- **ID:** pivot-point-trader
- **Strategy:** Support/resistance from pivot calculations
- **Indicators:** Daily pivots, R1/R2, S1/S2
- **Confidence Range:** 65-80%
- **Risk Level:** Medium
- **Execution Interval:** Every 30 minutes

#### Agent 15: Volume Profile
- **ID:** volume-profile-bot
- **Strategy:** Identifies high-volume price levels as support/resistance
- **Indicators:** Volume at Price (VAP), VPOC
- **Confidence Range:** 70-85%
- **Risk Level:** Medium
- **Execution Interval:** Every 30 minutes

---

### 3. Advanced Strategies (10 agents)

#### Agent 16: Grid Trading Bot
- **ID:** grid-trading-bot
- **Strategy:** Automated grid buying and selling in trending markets
- **Grid Size:** 0.5-1% price increments
- **Confidence Range:** 60-75%
- **Risk Level:** Medium
- **Execution Interval:** Every 5 minutes

#### Agent 17: Arbitrage Detector
- **ID:** arbitrage-detector
- **Strategy:** Detects price differences across trading pairs
- **Pairs Monitored:** BTC/USDT, ETH/USDT, BNB/USDT
- **Min Spread:** 0.2%
- **Confidence Range:** 85-95%
- **Risk Level:** Low
- **Execution Interval:** Every 1 minute

#### Agent 18: Momentum Accumulator
- **ID:** momentum-accumulator
- **Strategy:** Rides momentum waves with trending strategy
- **Exit Rules:** Fixed stop-loss 2%, take-profit 3%
- **Confidence Range:** 70-85%
- **Risk Level:** Medium-High
- **Execution Interval:** Every 10 minutes

#### Agent 19: Mean Reversion Oracle
- **ID:** mean-reversion-oracle
- **Strategy:** Profits from price mean reversion
- **Deviation Threshold:** 2 standard deviations
- **Confidence Range:** 65-80%
- **Risk Level:** Medium
- **Execution Interval:** Every 15 minutes

#### Agent 20: Breakout Trader
- **ID:** breakout-trader
- **Strategy:** Trades on key support/resistance breakouts
- **Volume Confirmation:** Required (> 120% average)
- **Confidence Range:** 70-85%
- **Risk Level:** Medium-High
- **Execution Interval:** Every 10 minutes

#### Agent 21: Scalping Bot
- **ID:** scalping-bot
- **Strategy:** High-frequency micro trades for 0.1-0.5% gains
- **Holding Time:** 1-5 minutes
- **Confidence Range:** 55-70%
- **Risk Level:** High
- **Execution Interval:** Every 2 minutes

#### Agent 22: Swing Trader
- **ID:** swing-trader
- **Strategy:** Multi-day trend-following with swing highs/lows
- **Holding Time:** 2-7 days
- **Confidence Range:** 75-85%
- **Risk Level:** Medium
- **Execution Interval:** Every 1 hour

#### Agent 23: Correlation Pairs Trading
- **ID:** pairs-trader
- **Strategy:** Exploits correlation divergence between pairs
- **Pairs:** BTC/ETH, BTC/BNB correlation
- **Confidence Range:** 70-82%
- **Risk Level:** Medium
- **Execution Interval:** Every 30 minutes

#### Agent 24: Fibonacci Retracement
- **ID:** fibonacci-bot
- **Strategy:** Trades bounces at Fibonacci levels
- **Levels Monitored:** 38.2%, 50%, 61.8%
- **Confidence Range:** 65-78%
- **Risk Level:** Medium
- **Execution Interval:** Every 15 minutes

#### Agent 25: Wave Analyzer
- **ID:** wave-analyzer
- **Strategy:** Elliott Wave pattern recognition
- **Patterns:** Impulse waves, corrective patterns
- **Confidence Range:** 60-75%
- **Risk Level:** Medium-High
- **Execution Interval:** Every 1 hour

---

### 4. Risk Management Agents (5 agents)

#### Agent 26: Risk Level Monitor
- **ID:** risk-monitor
- **Strategy:** Alerts on portfolio risk level changes
- **Triggers:** Risk level = critical → reduce positions
- **Risk Thresholds:** Low (<10%), Medium (10-25%), High (25-50%), Critical (>50%)
- **Execution Interval:** Every 5 minutes

#### Agent 27: Stop Loss Optimizer
- **ID:** stop-loss-optimizer
- **Strategy:** Dynamically adjusts stops based on volatility
- **Algorithm:** ATR-based stop placement
- **Confidence Range:** 85-95%
- **Risk Level:** Low
- **Execution Interval:** Every 10 minutes

#### Agent 28: Position Sizer
- **ID:** position-sizer
- **Strategy:** Calculates optimal position size by volatility
- **Formula:** Risk Amount / ATR * Multiplier
- **Confidence Range:** 90-98%
- **Risk Level:** Low
- **Execution Interval:** Every 30 minutes

#### Agent 29: Correlation Risk Detector
- **ID:** correlation-risk-detector
- **Strategy:** Detects correlated positions and concentration risk
- **Alert Threshold:** Correlation > 0.8
- **Risk Level:** Medium
- **Execution Interval:** Every 1 hour

#### Agent 30: Leverage Warning System
- **ID:** leverage-warning-system
- **Strategy:** Monitors leverage levels and liquidation risk
- **Alert Threshold:** Leverage > 5x
- **Risk Level:** Critical
- **Execution Interval:** Every 2 minutes

---

### 5. Data Analysis Agents (5 agents)

#### Agent 31: Sentiment Analyzer
- **ID:** sentiment-analyzer
- **Strategy:** Social media and news sentiment scoring
- **Sources:** Twitter, Reddit, News feeds
- **Confidence Range:** 55-75%
- **Risk Level:** Medium
- **Execution Interval:** Every 30 minutes

#### Agent 32: Market Regime Detector
- **ID:** market-regime-detector
- **Strategy:** Identifies bull/bear/sideways market regimes
- **Indicators:** Trend, volatility, volume characteristics
- **Confidence Range:** 75-88%
- **Risk Level:** Medium
- **Execution Interval:** Every 1 hour

#### Agent 33: Volatility Forecaster
- **ID:** volatility-forecaster
- **Strategy:** Predicts volatility using GARCH models
- **Forecast Horizon:** Next 4 hours
- **Confidence Range:** 70-82%
- **Risk Level:** Low
- **Execution Interval:** Every 1 hour

#### Agent 34: Order Book Analyzer
- **ID:** order-book-analyzer
- **Strategy:** Detects large limit orders and market depth imbalances
- **Signal Type:** Whale activity detection
- **Confidence Range:** 80-90%
- **Risk Level:** Low
- **Execution Interval:** Every 5 minutes

#### Agent 35: Funding Rate Monitor
- **ID:** funding-rate-monitor
- **Strategy:** Monitors perpetual futures funding rates for sentiment
- **Trigger:** Funding rate > 0.05% per 8h (extreme bullish)
- **Confidence Range:** 75-85%
- **Risk Level:** Low-Medium
- **Execution Interval:** Every 4 hours

---

### 6. Meta-Strategy Agents (4 agents)

#### Agent 36: Trend Strength Meter
- **ID:** trend-strength-meter
- **Strategy:** Aggregates 5 trend indicators for consensus
- **Indicators:** ADX, MACD, MA Slope, Volume Trend, Ichimoku
- **Confidence Range:** 80-95%
- **Risk Level:** Low
- **Execution Interval:** Every 15 minutes

#### Agent 37: Signal Aggregator
- **ID:** signal-aggregator
- **Strategy:** Consensus from top 10 agents
- **Threshold:** Minimum 6 agents agree for strong signal
- **Confidence Range:** 85-98%
- **Risk Level:** Low
- **Execution Interval:** Every 15 minutes

#### Agent 38: Drawdown Predictor
- **ID:** drawdown-predictor
- **Strategy:** Predicts max drawdown probability
- **Model:** Machine learning on historical volatility
- **Confidence Range:** 70-80%
- **Risk Level:** Low
- **Execution Interval:** Every 1 hour

#### Agent 39: Performance Attribution
- **ID:** performance-attribution
- **Strategy:** Analyzes which strategies drive returns
- **Output:** Attribution report by agent/strategy
- **Execution Interval:** Every 1 hour (reporting only)

#### Agent 40: ML Predictor
- **ID:** ml-predictor
- **Strategy:** Neural network price prediction (experimental)
- **Features:** 20 technical + market microstructure inputs
- **Confidence Range:** 55-70%
- **Risk Level:** Medium-High
- **Execution Interval:** Every 1 hour

---

## Agent Status Summary

| Category | Count | Avg Confidence | Avg Risk Level |
|----------|-------|-----------------|-----------------|
| Basic Monitoring | 5 | 70% | Low-Medium |
| Technical Analysis | 10 | 68% | Medium |
| Advanced Strategies | 10 | 72% | Medium |
| Risk Management | 5 | 90% | Low |
| Data Analysis | 5 | 75% | Low-Medium |
| Meta-Strategies | 4 | 82% | Low |
| **TOTAL** | **40** | **74%** | **Medium** |

---

## Agent Performance Metrics

### Win Rate Tracking
- Target: > 55% win rate per agent
- High performers: Agents 27, 28, 39, 34 (>85%)
- Low performers: Agents 12, 21, 38 (45-55%)
- Underperforming agents trigger alerts

### Signal Generation
- **Daily Signal Count:** 100-200 signals/day from all 40 agents
- **High Confidence Signals:** 30-50 per day (confidence ≥ 85%)
- **Critical Alerts:** 5-10 per day (risk management)

### Portfolio Impact
- **Target Allocation:** Avoid > 50% weighting to any 3 agents
- **Diversification:** 40 agents ensure uncorrelated strategies
- **Composite Returns:** Weighted by individual agent performance

---

## Running a Specific Agent

### CLI Trigger
```bash
# Run an agent immediately (not on schedule)
curl -X POST http://localhost:3000/api/agents/{agentId}/run \
  -H "X-API-Key: default-api-key-demo"

# Example: Run the momentum-accumulator agent
curl -X POST http://localhost:3000/api/agents/momentum-accumulator/run \
  -H "X-API-Key: default-api-key-demo"
```

### Dashboard View
1. Open dashboard: `http://localhost:3000`
2. Click agent name in list to view details
3. Click "Run Now" to trigger immediately

---

## Agent Configuration

### Adjusting Risk Per Agent
```typescript
// In agent implementation
const riskPerTrade = portfolio.cash * 0.01  // 1% risk per trade
const stopLoss = entryPrice * 0.98          // 2% stop loss
const takeProfit = entryPrice * 1.03        // 3% take profit
```

### Disabling/Enabling Agents
```bash
# Disable momentum-accumulator (set to manual-only)
# Modify: src/orchestrator.ts
agents.find(a => a.id === 'momentum-accumulator').enabled = false

# Re-enable
agents.find(a => a.id === 'momentum-accumulator').enabled = true
```

---

## Future Agent Enhancements

1. **Deep Learning:** Agents 21, 38, 40 to use transformer models
2. **Crypto Derivatives:** Add options/futures agents for Agent 41-45
3. **Multi-Exchange:** Support Kraken, Coinbase Pro (Agents 46-50)
4. **Portfolio Optimization:** AI-driven asset allocation agent
5. **News Integration:** Real-time news-triggered trading agent

---

## Contact & Support

For agent-specific questions:
- Each agent logs detailed decision reasoning
- Check `/api/metrics` for performance data per agent
- Review `/docs/API.md` for querying agent signals
