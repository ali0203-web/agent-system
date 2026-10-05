/**
 * Grid bot dry run: runs the real grid bot against live prices with orders forced to
 * simulation. Nothing is ever sent to the exchange, whatever DRY_RUN says in your env.
 *
 *   npm run grid:dry                       # keeps running, one cycle every 30 s (Ctrl+C for a summary)
 *   npm run grid:dry -- --cycles 20        # 20 cycles, then the summary
 *   npm run grid:dry -- --interval 10      # a cycle every 10 s (or GRID_DRY_INTERVAL_SEC=10)
 *
 * Prices (and exchange rules) come from the venue chosen by USE_TESTNET in .env.local,
 * default testnet. They are public endpoints, so no real API keys are needed.
 */

import * as dotenv from 'dotenv'
import * as path from 'path'
import { gridTradingBot } from './agents/grid-trading-bot'
import { getBinanceAPI } from './services/binance-api'

export interface DryRunOptions {
  /** Stop after this many cycles; undefined runs until interrupted. */
  cycles?: number
  intervalSec: number
}

export function parseArgs(argv: string[], env: NodeJS.ProcessEnv = process.env): DryRunOptions {
  const read = (flag: string): number | undefined => {
    const i = argv.indexOf(flag)
    const value = i >= 0 ? Number(argv[i + 1]) : NaN
    return Number.isFinite(value) && value >= 0 ? value : undefined
  }
  const cycles = read('--cycles')
  const envInterval = Number(env.GRID_DRY_INTERVAL_SEC)
  return {
    cycles: cycles !== undefined && cycles > 0 ? Math.floor(cycles) : undefined,
    intervalSec: read('--interval') ?? (Number.isFinite(envInterval) && envInterval >= 0 && env.GRID_DRY_INTERVAL_SEC ? envInterval : 30),
  }
}

/** Load .env files, then force dry run. Run before the exchange client is created. */
export function prepareDryRunEnv(log: (m: string) => void = console.log): void {
  dotenv.config({ path: path.resolve(process.cwd(), '.env.local') })
  dotenv.config()

  if (process.env.DRY_RUN !== 'true') {
    log(`DRY_RUN was "${process.env.DRY_RUN ?? ''}" in your environment: overriding to "true" for this script.`)
  }
  process.env.DRY_RUN = 'true' // forced: this script can never place a real order

  if (!process.env.BINANCE_TESTNET_API_KEY && !process.env.BINANCE_API_KEY) {
    // Prices and exchange rules are public, so placeholder keys are enough (nothing is signed or sent)
    process.env.BINANCE_TESTNET_API_KEY = 'dry-run-placeholder'
    process.env.BINANCE_TESTNET_API_SECRET = 'dry-run-placeholder'
  }
}

const money = (n: number, d = 2) => n.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d })

export function formatStatus(status: ReturnType<typeof gridTradingBot.getStatus>, now = new Date()): string[] {
  const time = now.toTimeString().slice(0, 8)
  if (status.length === 0) return [`${time}  no grids yet (waiting for live prices)`]
  return status.map(
    (s) =>
      `${time}  ${s.symbol.padEnd(8)} ${s.price === undefined ? '       n/a' : '$' + money(s.price).padStart(10)}  ` +
      `grid ${money(s.bottomPrice, 0)}-${money(s.topPrice, 0)}  ` +
      `buys ${s.openBuys} | held ${s.holding} | sells ${s.openSells}  ` +
      `trades ${s.tradesCompleted}  profit $${s.profit.toFixed(4)}`
  )
}

export function formatSummary(status: ReturnType<typeof gridTradingBot.getStatus>, simulatedOrders: number): string[] {
  const lines = ['', '=== DRY RUN SUMMARY (nothing was sent to the exchange) ===']
  if (status.length === 0) lines.push('No grids were created: no live prices were available.')
  for (const s of status) {
    lines.push(
      `${s.symbol}: ${s.tradesCompleted} round trips, realised profit $${s.profit.toFixed(4)}, ` +
        `holding ${s.heldQty.toFixed(6)} ${s.symbol.replace(/USDT$/, '')} across ${s.holding + s.openSells} level(s) ` +
        `(unrealised, not counted), ${s.openBuys + s.openSells} order(s) resting`
    )
  }
  lines.push(`Simulated orders: ${simulatedOrders}`)
  return lines
}

export async function run(
  options: DryRunOptions,
  log: (m: string) => void = console.log,
  stop: { requested: boolean } = { requested: false }
): Promise<void> {
  prepareDryRunEnv(log)
  const api = getBinanceAPI()
  log(`Grid bot DRY RUN on ${api.isTestnet() ? 'TESTNET' : 'MAINNET'} prices. Ctrl+C for a summary.`)

  for (let cycle = 1; !stop.requested && (options.cycles === undefined || cycle <= options.cycles); cycle++) {
    await gridTradingBot.execute()
    for (const line of formatStatus(gridTradingBot.getStatus())) log(line)

    const last = options.cycles !== undefined && cycle >= options.cycles
    if (!last && options.intervalSec > 0) {
      await new Promise((resolve) => setTimeout(resolve, options.intervalSec * 1000))
    }
  }

  for (const line of formatSummary(gridTradingBot.getStatus(), api.getDryRunOrders().length)) log(line)
}

if (require.main === module) {
  const stop = { requested: false }
  process.on('SIGINT', () => {
    stop.requested = true
    console.log('\nStopping after this cycle...')
  })
  run(parseArgs(process.argv.slice(2)), console.log, stop)
    .then(() => process.exit(0))
    .catch((error) => {
      console.error('Dry run failed:', error?.message ?? error)
      process.exit(1)
    })
}
