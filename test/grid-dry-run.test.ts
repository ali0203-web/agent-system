import axios from 'axios'
import { getBinanceAPI } from '../src/services/binance-api'
import { parseArgs, run, formatStatus, formatSummary } from '../src/grid-dry-run'
import { gridTradingBot } from '../src/agents/grid-trading-bot'
import { FakeExchange } from './helpers/fake-binance'

process.env.USE_TESTNET = 'true'
process.env.BINANCE_TESTNET_API_KEY = 'dummy'
process.env.BINANCE_TESTNET_API_SECRET = 'dummy'

describe('parseArgs', () => {
  test('defaults: run until interrupted, every 30 s', () => {
    expect(parseArgs([], {})).toEqual({ cycles: undefined, intervalSec: 30 })
  })
  test('--cycles and --interval', () => {
    expect(parseArgs(['--cycles', '5', '--interval', '2'], {})).toEqual({ cycles: 5, intervalSec: 2 })
  })
  test('GRID_DRY_INTERVAL_SEC is used when no flag is given, the flag wins otherwise', () => {
    expect(parseArgs([], { GRID_DRY_INTERVAL_SEC: '10' } as any).intervalSec).toBe(10)
    expect(parseArgs(['--interval', '3'], { GRID_DRY_INTERVAL_SEC: '10' } as any).intervalSec).toBe(3)
  })
  test('junk values fall back to the defaults', () => {
    expect(parseArgs(['--cycles', 'abc', '--interval', '-4'], {})).toEqual({ cycles: undefined, intervalSec: 30 })
    expect(parseArgs(['--cycles', '0'], {}).cycles).toBeUndefined()
  })
})

describe('grid dry-run script', () => {
  let ex: FakeExchange

  beforeEach(() => {
    process.env.GRID_STATE_STORE = 'off'
    ex = new FakeExchange()
    const api = getBinanceAPI() as any
    api.rulesCache.clear()
    api.lastPrices.clear()
    jest.spyOn(axios, 'get').mockImplementation((url: any) => ex.get(url))
    jest.spyOn(axios, 'post').mockImplementation((url: any) => ex.post(url))
    jest.spyOn(axios, 'delete').mockImplementation((url: any) => ex.delete(url))
  })
  afterEach(() => jest.restoreAllMocks())

  test('forces dry run even when the environment says live: nothing is ever sent', async () => {
    process.env.DRY_RUN = 'false' // the dangerous setting
    const lines: string[] = []
    await run({ cycles: 3, intervalSec: 0 }, (m) => lines.push(m))

    expect(process.env.DRY_RUN).toBe('true')
    expect(ex.posts).toHaveLength(0)
    expect(lines.some((l) => l.includes('overriding to "true"'))).toBe(true)
    expect(lines.some((l) => l.includes('BTCUSDT'))).toBe(true) // a status line per grid, every cycle
    expect(lines.filter((l) => l.includes('BTCUSDT') && l.includes('grid ')).length).toBeGreaterThanOrEqual(3)
    expect(lines.some((l) => l.includes('DRY RUN SUMMARY'))).toBe(true)
    expect((getBinanceAPI() as any).getDryRunOrders().length).toBeGreaterThan(0) // it did trade, in simulation
  })

  test('stops when asked, still printing the summary', async () => {
    const lines: string[] = []
    await run({ intervalSec: 0 }, (m) => lines.push(m), { requested: true })
    expect(lines.some((l) => l.includes('DRY RUN SUMMARY'))).toBe(true)
  })

  test('formatting: no grids yet, a grid line, and the summary', () => {
    expect(formatStatus([])[0]).toMatch(/no grids yet/)
    const status = [{ symbol: 'BTCUSDT', price: 100123.456, bottomPrice: 96000, topPrice: 104000, openBuys: 2, holding: 1, openSells: 0, heldQty: 0.00048, tradesCompleted: 3, profit: 1.5 }]
    const line = formatStatus(status, new Date('2026-01-01T09:08:07'))[0]
    expect(line).toContain('09:08:07')
    expect(line).toContain('$100,123.46')
    expect(line).toContain('buys 2 | held 1 | sells 0')
    expect(line).toContain('profit $1.5000')
    const summary = formatSummary(status, 7).join('\n')
    expect(summary).toContain('nothing was sent')
    expect(summary).toContain('3 round trips')
    expect(summary).toContain('Simulated orders: 7')
    expect(formatSummary([], 0).join('\n')).toContain('No grids were created')
  })

  test('getStatus reports what the grid is doing', async () => {
    const status = gridTradingBot.getStatus()
    expect(status.length).toBeGreaterThan(0)
    for (const s of status) {
      expect(s.openBuys + s.holding + s.openSells).toBeLessThanOrEqual(10)
      expect(typeof s.profit).toBe('number')
    }
  })
})
