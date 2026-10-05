/**
 * Grid bot persistence: a restart must not orphan resting orders, forget holdings or lose
 * profit, and a crash at the worst moment (order created but not yet recorded) must not
 * leave an order nobody tracks.
 */
import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'
import axios from 'axios'
import { getBinanceAPI } from '../src/services/binance-api'
import { gridTradingBot } from '../src/agents/grid-trading-bot'
import {
  CorruptStateError,
  DbGridStateStore,
  FileGridStateStore,
  createGridStateStore,
  parseStateJson,
} from '../src/services/grid-state-store'
import { FakeExchange } from './helpers/fake-binance'

process.env.USE_TESTNET = 'true'
process.env.BINANCE_TESTNET_API_KEY = 'dummy'
process.env.BINANCE_TESTNET_API_SECRET = 'dummy'

const Bot: any = gridTradingBot.constructor
let ex: FakeExchange
let api: any
let dir: string
const stateFile = () => path.join(dir, 'grid-testnet.json')

/** A bot with one level at 100000.02: the buy band is 98000.0196 - 100000.02. */
function newBot(opts: { addGrid?: boolean; bottom?: number; top?: number; invest?: number } = {}) {
  const bot = new Bot()
  bot.strayChecked.add('ETHUSDT')
  if (opts.addGrid !== false) {
    bot.defaultsCreated.add('BTCUSDT')
    bot.defaultsCreated.add('ETHUSDT')
    bot.addGridPosition('bitcoin', 'BTCUSDT', 1, opts.bottom ?? 100000.02, opts.top ?? 100001, opts.invest ?? 50)
  }
  return bot
}
const restart = () => new Bot() // a new process: nothing in memory, only the saved state
const level = (bot: any) => bot.getPositionBySymbol('BTCUSDT').levels[0]
const position = (bot: any) => bot.getPositionBySymbol('BTCUSDT')
const saved = () => JSON.parse(fs.readFileSync(stateFile(), 'utf8'))

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'grid-state-'))
  process.env.GRID_STATE_STORE = 'file'
  process.env.GRID_STATE_DIR = dir
  process.env.DRY_RUN = 'false'
  ex = new FakeExchange()
  api = getBinanceAPI() as any
  api.rulesCache.clear()
  api.lastPrices.clear()
  api.simOrders.clear()
  api.dryRunOrders.length = 0
  jest.spyOn(axios, 'get').mockImplementation((url: any) => ex.get(url))
  jest.spyOn(axios, 'post').mockImplementation((url: any) => ex.post(url))
  jest.spyOn(axios, 'delete').mockImplementation((url: any) => ex.delete(url))
  // The state file is named by network: keep the test file name predictable
  jest.spyOn(FileGridStateStore.prototype as any, 'fileFor').mockImplementation(() => stateFile())
})
afterEach(() => {
  jest.restoreAllMocks()
  fs.rmSync(dir, { recursive: true, force: true })
})

describe('restart with resting orders', () => {
  test('a resting buy is remembered: no duplicate order, and its fill is detected after the restart', async () => {
    ex.prices.BTCUSDT = 100000.019
    const a = newBot()
    await a.execute()
    expect(level(a).status).toBe('buy_open')
    const orderId = level(a).buyOrderId
    expect(ex.posts).toHaveLength(1)

    const b = restart()
    const warn = jest.spyOn(b.logger, 'warn')
    await b.execute()
    expect(ex.posts).toHaveLength(1) // still one order: nothing orphaned, nothing duplicated
    expect(level(b).status).toBe('buy_open')
    expect(level(b).buyOrderId).toBe(orderId)
    expect(warn.mock.calls.filter((c) => String(c[0]).includes('not tracked'))).toHaveLength(0)

    ex.setPrice('BTCUSDT', 100000.01) // fills while the new process is running
    await b.execute()
    expect(level(b).status).toBe('filled')
    expect(level(b).heldQty).toBeGreaterThan(0)
  })

  test('an order that filled while the bot was down is picked up on the next start', async () => {
    ex.prices.BTCUSDT = 100000.019
    const a = newBot()
    await a.execute()
    ex.setPrice('BTCUSDT', 100000.01) // fills while "down": nobody is running
    const b = restart()
    await b.execute()
    expect(level(b).status).toBe('filled')
    expect(ex.posts).toHaveLength(1)
  })

  test('holdings, cost and profit survive, and the restored sell uses the saved quantity', async () => {
    ex.prices.BTCUSDT = 100000.019
    const a = newBot()
    await a.execute()
    ex.setPrice('BTCUSDT', 100000.01)
    await a.execute() // filled
    position(a).totalProfit = 12.34
    position(a).tradesCompleted = 2
    await a.execute() // saves the changed totals
    const held = level(a).heldQty
    const cost = level(a).buyCost

    const b = restart()
    await b.execute()
    expect(position(b).totalProfit).toBe(12.34)
    expect(position(b).tradesCompleted).toBe(2)
    expect(level(b).heldQty).toBe(held)
    expect(level(b).buyCost).toBe(cost)
    expect(level(b).buyFilledAt).toBeInstanceOf(Date) // dates are revived, not left as strings

    ex.setPrice('BTCUSDT', 102100.011)
    await b.execute() // sell placed from the restored holdings
    const sell = [...ex.orders.values()].find((o) => o.side === 'SELL')!
    expect(sell.origQty).toBe(held)
    expect(level(b).status).toBe('sell_open')

    const c = restart() // restart again with the sell resting
    await c.execute()
    expect(ex.posts).toHaveLength(2) // buy + sell only
    ex.setPrice('BTCUSDT', 102200)
    await c.execute()
    expect(position(c).tradesCompleted).toBe(3)
    expect(position(c).totalProfit).toBeGreaterThan(12.34)
  })

  test('grids are restored as saved: not rebuilt around today\'s price, defaults not duplicated', async () => {
    ex.prices.BTCUSDT = 100000
    ex.prices.ETHUSDT = 3000
    const a = newBot({ addGrid: false })
    await a.execute() // default grids around the live prices
    const btcBefore = { bottom: position(a).bottomPrice, top: position(a).topPrice }
    expect(a.getPositions()).toHaveLength(2)

    ex.prices.BTCUSDT = 130000 // market moved far away while down
    ex.prices.ETHUSDT = 4000
    const b = restart()
    await b.execute()
    expect(b.getPositions()).toHaveLength(2)
    expect(position(b).bottomPrice).toBe(btcBefore.bottom)
    expect(position(b).topPrice).toBe(btcBefore.top)
  })
})

describe('crash safety (write-ahead marker)', () => {
  test('crash AFTER the exchange accepted the order but BEFORE it was recorded: the order is found again', async () => {
    ex.prices.BTCUSDT = 100000.019
    const a = newBot()
    const real = api.placeOrder.bind(api)
    jest.spyOn(api, 'placeOrder').mockImplementationOnce(async (o: any) => {
      await real(o) // the exchange has the order now...
      throw new Error('process killed') // ...and we die before noticing
    })
    await expect(a.execute()).rejects.toThrow('process killed')
    expect(ex.orders.size).toBe(1)
    expect(saved().positions[0].levels[0].placing).toBeDefined() // the intent was saved first

    const b = restart()
    await b.execute()
    expect(ex.orders.size).toBe(1) // no duplicate
    expect(level(b).status).toBe('buy_open')
    expect(level(b).buyOrderId).toBe(String([...ex.orders.values()][0].orderId))
    expect(level(b).placing).toBeUndefined()
  })

  test('crash BEFORE the order reached the exchange: the marker is cleared and the buy is placed once', async () => {
    ex.prices.BTCUSDT = 100000.019
    const a = newBot()
    jest.spyOn(api, 'placeOrder').mockImplementationOnce(async () => {
      throw new Error('process killed')
    })
    await expect(a.execute()).rejects.toThrow('process killed')
    expect(ex.orders.size).toBe(0)

    const b = restart()
    await b.execute()
    expect(ex.orders.size).toBe(1)
    expect(level(b).status).toBe('buy_open')
    expect(level(b).placing).toBeUndefined()
  })

  test('if the in-flight order cannot be looked up, nothing new is placed until it can', async () => {
    ex.prices.BTCUSDT = 100000.019
    const a = newBot()
    const real = api.placeOrder.bind(api)
    jest.spyOn(api, 'placeOrder').mockImplementationOnce(async (o: any) => {
      await real(o)
      throw new Error('process killed')
    })
    await expect(a.execute()).rejects.toThrow('process killed')

    ex.clientLookupFails = true
    const b = restart()
    await b.execute()
    await b.execute()
    expect(ex.posts).toHaveLength(1) // the buy from before the crash; B placed nothing
    expect(level(b).placing).toBeDefined()

    ex.clientLookupFails = false
    await b.execute()
    expect(level(b).status).toBe('buy_open')
    expect(ex.orders.size).toBe(1)
  })

  test('if the state cannot be saved, no order is placed (an order we cannot remember is an orphan)', async () => {
    ex.prices.BTCUSDT = 100000.019
    jest.spyOn(FileGridStateStore.prototype, 'save').mockRejectedValue(new Error('disk full'))
    const a = newBot()
    await a.execute()
    expect(ex.posts).toHaveLength(0)
    expect(level(a).status).toBe('pending')
    expect(level(a).placing).toBeUndefined()
  })
})

describe('unreadable or unusable saved state fails closed', () => {
  test('a read error skips the run (no orders, no fresh grids) and the next run recovers', async () => {
    ex.prices.BTCUSDT = 100000.019
    const a = newBot()
    await a.execute()
    expect(ex.posts).toHaveLength(1)

    jest.spyOn(FileGridStateStore.prototype, 'load').mockRejectedValueOnce(new Error('EACCES'))
    const b = restart()
    await b.execute()
    expect(b.getPositions()).toHaveLength(0)
    expect(ex.posts).toHaveLength(1)

    await b.execute() // readable again
    expect(level(b).status).toBe('buy_open')
    expect(ex.posts).toHaveLength(1) // still no duplicate
  })

  test('a corrupt file stops trading and is left untouched', async () => {
    fs.writeFileSync(stateFile(), '{ this is not json')
    ex.prices.BTCUSDT = 100000.019
    const b = newBot()
    const error = jest.spyOn(b.logger, 'error')
    await b.execute()
    await b.execute()
    expect(ex.posts).toHaveLength(0)
    expect(fs.readFileSync(stateFile(), 'utf8')).toBe('{ this is not json') // never overwritten
    expect(error.mock.calls.some((c) => String(c[0]).includes('unusable'))).toBe(true)
  })

  test('state saved for another network is refused', async () => {
    fs.writeFileSync(stateFile(), JSON.stringify({ version: 1, network: 'mainnet', defaultsCreated: [], positions: [] }))
    const b = newBot()
    await b.execute()
    expect(ex.posts).toHaveLength(0)
  })

  test('an unknown format version is refused', async () => {
    fs.writeFileSync(stateFile(), JSON.stringify({ version: 99, positions: [] }))
    const b = newBot()
    await b.execute()
    expect(ex.posts).toHaveLength(0)
  })
})

describe('what is (not) saved', () => {
  test('dry run writes nothing', async () => {
    process.env.DRY_RUN = 'true'
    ex.prices.BTCUSDT = 100000.019
    const a = newBot()
    await a.execute()
    expect(level(a).status).toBe('buy_open') // simulated
    expect(fs.existsSync(stateFile())).toBe(false)
  })

  test('simulated orders are never saved, even if live trading is switched on afterwards', async () => {
    process.env.DRY_RUN = 'true'
    ex.prices.BTCUSDT = 100000.019
    const a = newBot()
    await a.execute()
    expect(Number(level(a).buyOrderId)).toBeLessThan(0)

    process.env.DRY_RUN = 'false'
    position(a).totalProfit = 1 // any change forces a save
    await a.execute()
    expect(fs.existsSync(stateFile())).toBe(true)
    const ids = JSON.stringify(saved())
    expect(ids).not.toMatch(/"(buy|sell)OrderId":"-/)
  })

  test('GRID_STATE_STORE=off saves nothing and a restart starts fresh', async () => {
    process.env.GRID_STATE_STORE = 'off'
    ex.prices.BTCUSDT = 100000.019
    const a = newBot()
    await a.execute()
    expect(fs.existsSync(stateFile())).toBe(false)
    const firstOrderId = level(a).buyOrderId
    const b = restart()
    await b.execute()
    // Not restored: B built fresh default grids (10 and 8 levels) and does not know A's order
    expect(b.getPositions().map((p: any) => p.gridLevels).sort()).toEqual([10, 8])
    expect(b.getPositions().flatMap((p: any) => p.levels).some((l: any) => l.buyOrderId === firstOrderId)).toBe(false)
  })

  test('nothing is saved before the previous state has been loaded', async () => {
    ex.prices.BTCUSDT = 100000.019
    const a = newBot()
    await a.execute()
    const before = fs.readFileSync(stateFile(), 'utf8')

    const b = newBot({ bottom: 200000, top: 201000 }) // explicit grid added in code before the first run
    expect(await b.persist()).toBe(true) // a save attempt before loading is a no-op...
    expect(fs.readFileSync(stateFile(), 'utf8')).toBe(before) // ...so it cannot clobber the saved state
    await b.execute()
    expect(level(b).status).toBe('buy_open') // the saved grid with resting orders won
    expect(position(b).bottomPrice).toBe(100000.02)
  })

  test('a grid added in code wins over a saved grid that has nothing at stake', async () => {
    ex.prices.BTCUSDT = 100000.019
    const a = newBot({ bottom: 100000.02 })
    jest.spyOn(api, 'placeOrder').mockResolvedValueOnce(null) // the buy is rejected: level stays pending
    await a.execute()
    expect(level(a).status).toBe('pending')

    const b = newBot({ bottom: 150000, top: 151000 })
    await b.execute()
    expect(position(b).bottomPrice).toBe(150000)
  })
})

describe('stores', () => {
  test('file store: round trip, missing file is null, no temp files left, dates revived', async () => {
    jest.restoreAllMocks() // use the real fileFor
    const store = new FileGridStateStore(dir)
    expect(await store.load('grid:testnet')).toBeNull()
    await store.save('grid:testnet', JSON.stringify({ version: 1, positions: [{ createdAt: '2026-01-02T03:04:05.000Z' }] }))
    const parsed = parseStateJson((await store.load('grid:testnet'))!)
    expect(parsed.positions[0].createdAt).toBeInstanceOf(Date)
    expect(fs.readdirSync(dir).filter((f) => f.endsWith('.tmp'))).toHaveLength(0)
    await store.save('grid:testnet', '{"version":1,"positions":[]}') // overwrite is atomic and works
    expect(JSON.parse((await store.load('grid:testnet'))!).positions).toEqual([])
  })

  test('invalid JSON is reported as corrupt, not as "no state"', () => {
    expect(() => parseStateJson('{nope')).toThrow(CorruptStateError)
  })

  test('db store: creates the table once, upserts, and returns null when there is no row', async () => {
    const rows = new Map<string, any>()
    const calls: string[] = []
    const db = {
      query: async (text: string, values?: any[]) => {
        calls.push(text.trim().split(/\s+/).slice(0, 3).join(' '))
        if (/INSERT INTO grid_state/.test(text)) rows.set(values![0], JSON.parse(values![1]))
        if (/SELECT state/.test(text)) return { rows: rows.has(values![0]) ? [{ state: rows.get(values![0]) }] : [] }
        return { rows: [] }
      },
    }
    const store = new DbGridStateStore(db)
    expect(await store.load('k')).toBeNull()
    await store.save('k', '{"version":1,"positions":[]}')
    await store.save('k', '{"version":1,"positions":[1]}')
    expect(JSON.parse((await store.load('k'))!).positions).toEqual([1])
    expect(calls.filter((c) => c.startsWith('CREATE TABLE'))).toHaveLength(1)
  })

  test('db store: a read error propagates (it is not "no state")', async () => {
    const store = new DbGridStateStore({ query: async () => { throw new Error('connection refused') } })
    await expect(store.load('k')).rejects.toThrow('connection refused')
  })

  test('the store is chosen from the environment', () => {
    const db = { query: async () => ({ rows: [] }) }
    const was = { ...process.env }
    try {
      delete process.env.GRID_STATE_STORE
      delete process.env.DATABASE_URL
      delete process.env.POSTGRES_URL
      delete process.env.DATABASE_URL_NONPOOLING
      expect(createGridStateStore(db).kind).toBe('file') // no database configured
      process.env.DATABASE_URL = 'postgres://x'
      expect(createGridStateStore(db).kind).toBe('db') // deployed: database
      process.env.GRID_STATE_STORE = 'file'
      expect(createGridStateStore(db).kind).toBe('file') // explicit override
      process.env.GRID_STATE_STORE = 'off'
      expect(createGridStateStore(db).kind).toBe('off')
    } finally {
      process.env = was
    }
  })
})
