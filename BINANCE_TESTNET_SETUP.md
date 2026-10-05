# Binance Testnet Setup Guide

This guide walks you through setting up Binance testnet for agent trading.

## What is Binance Testnet?

Binance Testnet is a **sandbox environment** that:
- ✅ Uses the exact same API as mainnet
- ✅ Has fake money (no real risk)
- ✅ Shows up in a separate Binance dashboard
- ✅ Perfect for testing trading bots before going live
- ✅ Can seamlessly switch to mainnet by changing API keys

## Step 1: Access Binance Testnet

Go to: **https://testnet.binance.vision/**

This is Binance's testnet dashboard. You'll see:
- Account balances (fake money)
- Open orders
- Trading history
- Portfolio overview

## Step 2: Generate Testnet API Keys

### 2.1 Log in to testnet.binance.vision
- Use your regular Binance account credentials
- You'll get access to testnet automatically

### 2.2 Navigate to API Management
1. Click on your account icon (top right)
2. Select **"API Management"** or **"API Key"**
3. Click **"Create New Key"**

### 2.3 Configure API Key Permissions
Choose these permissions:
- ✅ **Enable Reading** (can view account info)
- ✅ **Enable Spot & Margin Trading** (can place orders)
- ✅ **Enable Withdrawals** (optional, we won't use this)

**Do NOT enable:**
- ❌ IP whitelist (leave blank or add your IP)

### 2.4 Copy Your Keys
You'll get:
- **API Key**: A long string starting with letters
- **Secret Key**: Another long string

**⚠️ IMPORTANT: Save these in `.env.local` immediately!**

## Step 3: Update Your .env.local

Add these lines to your `.env.local` file:

```bash
# Binance Testnet API Keys (FAKE MONEY - FOR TESTING ONLY)
BINANCE_TESTNET_API_KEY=your_testnet_api_key_here
BINANCE_TESTNET_API_SECRET=your_testnet_secret_key_here

# Enable testnet mode
USE_TESTNET=true

# Keep your mainnet keys for later
BINANCE_API_KEY=your_mainnet_api_key_here
BINANCE_API_SECRET=your_mainnet_secret_key_here
```

## Step 4: Fund Your Testnet Account

Binance testnet gives you **fake money** to trade with:
1. Log in to testnet.binance.vision
2. Click **"Wallet"** → **"Deposit"**
3. Select any crypto (e.g., USDT, BTC)
4. You'll get fake coins instantly
5. Use these to trade with agents

## Step 5: Start Personal Trading System

```bash
cd ~/agent-system
npm run dev:personal-trading
```

The system will:
- ✅ Load testnet API keys from `.env.local`
- ✅ Connect to Binance testnet
- ✅ Start all 10 agents
- ✅ Place orders on testnet (visible in your dashboard)

## Step 6: Monitor in Binance Dashboard

1. Keep testnet.binance.vision open in your browser
2. Watch orders appear in real-time as agents trade
3. See positions opening/closing
4. Track P&L updates
5. Verify agent behavior

## Switching from Testnet to Mainnet (Later)

When you're ready to go live with real money:

**Step 1: Fund your mainnet account**
```
Log into binance.com → Deposit $100-200
```

**Step 2: Update .env.local**
```bash
# Just change this one line:
USE_TESTNET=false

# System will now use BINANCE_API_KEY and BINANCE_API_SECRET (mainnet)
```

**Step 3: Restart the system**
```bash
npm run dev:personal-trading
```

That's it! Same code, same agents, now trading with real money.

## Troubleshooting

**"Invalid API Key"**
- Double-check testnet keys are pasted correctly
- Make sure you're using TESTNET keys, not mainnet keys
- Regenerate keys if unsure

**"No funds available"**
- Go to testnet.binance.vision → Wallet → Deposit
- Select a crypto and deposit fake money

**"Orders not placing"**
- Verify API key has "Spot & Margin Trading" enabled
- Check logs for specific error message

## Security Note

- ✅ Testnet keys are SAFE to share (fake money)
- ✅ Never share mainnet API keys
- ✅ Testnet funds are worthless (for testing only)

---

**Ready?** Provide your testnet API keys and I'll activate the system.

## Dry run (block all orders)

Set `DRY_RUN=true` in `.env.local` (or the environment) to stop the system from sending
**any** order or cancellation to Binance. Orders are simulated instead: they get a negative
`orderId`, status `DRY_RUN` and `simulated: true`, so bots run their full logic and events
are tagged as simulated. Cancelling a *real* order is also blocked in dry run.

- `DRY_RUN` unset, `false`, `0`, `no` or `off`: orders are sent (the default).
- `DRY_RUN` set to `true`, `1`, `yes` or `on`: dry run.
- Any other value (for example a typo like `ture`): treated as dry run, so a typo can't enable trading.

The flag is read every time an order is placed, so it takes effect without a restart,
but set it **before** starting the process for the startup banner to be accurate.
Use it when running against mainnet until you have checked the bots' behaviour.

## Mainnet safety gate (`ALLOW_MAINNET_ORDERS`)

Orders against **mainnet** (`USE_TESTNET=false`, real money) are only sent when
`ALLOW_MAINNET_ORDERS=true`. Otherwise they are simulated exactly like a dry run, with a
`🛑 MAINNET ORDERS NOT ALLOWED` log line, and a warning is printed at startup.

- Only the exact value `true` (any letter case) opens the gate. Unset, `1`, `yes` or a typo keep it closed.
- `DRY_RUN=true` still wins: with both set, orders are simulated.
- Testnet is not affected by this setting.
- Like dry run, cancelling a real order is also blocked while the gate is closed.

## Order rounding and fill tracking

**Rounding.** Before any order is sent, `BinanceAPI.placeOrder` loads the symbol's exchange
rules (`/v3/exchangeInfo`, cached for an hour) and snaps the order to them: price to the tick size
(BUY rounds down, SELL rounds up), quantity down to the step size, then checks `minQty` and
`minNotional`. An order Binance would reject is **not sent**: `placeOrder` returns `null` and
`getLastOrderError()` says why. If the rules cannot be loaded, live orders are refused (fail closed).
In dry run, orders are rounded and validated the same way, so config problems show up early.

**Fill tracking.** The grid bot no longer assumes an order filled because it was placed. Each level
moves `pending -> buy_open -> filled -> sell_open -> pending`, driven by what the exchange reports on
every run:

- A resting buy only counts once it fills. Spot charges the buy fee in the base coin, so the bot
  holds (and later sells) the fee-adjusted quantity, rounded down to the step size.
- Profit is booked only when the sell fills, from the real fills and fees. Unsellable rounding
  dust is kept as inventory, not counted as a loss.
- A buy that has not filled after `GRID_BUY_TTL_MIN` minutes (default 60) is cancelled; any part
  that did fill is kept.
- If a response is lost (timeout), the order is looked up by its client order id instead of being
  placed twice.
- Orders resting on the exchange that the bot does not know about are reported once in the log
  (e.g. placed by hand, or from before persistence was turned on). Cancel them by hand if stale.

In dry run, simulated orders fill when the last price touches the limit, with a 0.1% fee.

| Variable | Default | Meaning |
|---|---|---|
| `GRID_RANGE_PCT` | `0.04` | Half-width of a new default grid around the live price |
| `GRID_BUY_TTL_MIN` | `60` | Cancel an unfilled resting buy after this many minutes |
| `GRID_FEE_FALLBACK` | `0.001` | Buy fee assumed only if Binance's trade list cannot be read |

Note: with `$50` per level on BTC the step size (0.00001 BTC) is about 2% of the order, so rounding
dust is large relative to the grid's 2% profit target. Use a larger `investmentPerGrid` for BTC.

## Grid state survives restarts

The grids, resting order ids, coins held, cost basis and profit are saved, so a restart picks up
where it left off instead of forgetting orders that are still resting on Binance.

| Store | When | Where |
|---|---|---|
| `db` | default when `DATABASE_URL` / `POSTGRES_URL` is set | table `grid_state` (created automatically), one row per network |
| `file` | default otherwise | `./data/` (override with `GRID_STATE_DIR`), written atomically; `data/` is git-ignored |
| `off` | `GRID_STATE_STORE=off` | nothing is saved |

Set `GRID_STATE_STORE=db|file|off` to override. Use `db` when deployed: a container's disk is wiped on
every redeploy.

How it protects orders:

- **Write-ahead.** Before an order is sent, the bot saves a marker with the order's client id. If the
  process dies after Binance accepted the order but before the bot recorded it, the next start looks the
  order up by that id and tracks it again. If the order never reached Binance, the marker is cleared.
  If the state cannot be saved, no order is placed.
- **Fail closed.** If the saved state cannot be read, is corrupt, has an unknown version or belongs to the
  other network, the bot does not trade at all (and logs why) instead of starting fresh and duplicating or
  orphaning orders. A read error is retried next run. For a corrupt state, fix or delete it
  (`data/grid-<network>.json`, or `DELETE FROM grid_state WHERE key = 'grid:testnet'`) and cancel any
  stale orders on Binance first.
- **Saved grids win** over a freshly built grid: they are restored as they were, not re-centered on
  today's price. A grid added in code only replaces a saved one that has nothing at stake.
- **Dry run saves nothing**, and simulated orders are never written, so paper trading cannot leak into
  real state. Testnet and mainnet are kept separate.

Only one process should run the grid bot per network: two would both place orders.
