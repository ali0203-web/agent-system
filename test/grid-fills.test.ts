/**
 * Grid bot: fill tracking and order rounding, against a fake Binance that enforces
 * the real exchange rules independently of the code under test (tick/step size,
 * min notional, MARKET parameter rules, balances, fees paid in the base asset).
 */
import axios from 'axios'
import { getBinanceAPI } from '../src/services/binance-api'
import { gridTradingBot } from '../src/agents/grid-trading-bot'

process.env.USE_TESTNET = 'true'
process.env.BINANCE_TESTNET_API_KEY = 'dummy'
process.env.BINANCE_TESTNET_API_SECRET = 'dummy'

interface Order {
  orderId: number
  symbol: string
  side: 'BUY' | 'SELL'
  price: number
  origQty: number
  executedQty: number
  quoteQty: number
  status: 'NEW' | 'PARTIALLY_FILLED' | 'FILLED' | 'CANCELED'
  clientOrderId: string
  time: number
}

const RULES: Record<string, { base: string; tick: string; step: string; minNotional: number }> = {
  BTCUSDT: { base: 'BTC', tick: '0.01000000', step: '0.00001000', minNotional: 5 },
  ETHUSDT: { base: 'ETH', tick: '0.01000000', step: '0.00010000', minNotional: 5 },
}
const decimals = (s: string) => (s.split('.')[1] ?? '').replace(/0+$/, '').length
const aligned = (value: number, step: string) => {
  const q = value / parseFloat(step)
  return Math.abs(q - Math.round(q)) < 1e-7
}

class FakeExchange {
  prices: Record<string, number> = { BTCUSDT: 100000, ETHUSDT: 3000 }
  orders = new Map<number, Order>()
  trades: any[] = []
  balances: Record<string, number> = { USDT: 100000, BTC: 0, ETH: 0 }
  nextId = 5000
  posts: string[] = []
  rulesDown = false
  statusReadsFail = false
  losePostResponseOnce = false
  partialNext = false // next resting order fills only 40% when touched, then waits

  err(code: number, msg: string): never {
    throw Object.assign(new Error(msg), { response: { data: { code, msg } } })
  }

  setPrice(symbol: string, price: number) {
    this.prices[symbol] = price
    for (const o of this.orders.values()) {
      if (o.symbol !== symbol || (o.status !== 'NEW' && o.status !== 'PARTIALLY_FILLED')) continue
      const touched = o.side === 'BUY' ? price <= o.price : price >= o.price
      if (!touched) continue
      const remaining = o.origQty - o.executedQty
      if (this.partialNext && o.status === 'NEW') {
        this.partialNext = false
        this.fill(o, Number((remaining * 0.4).toFixed(decimals(RULES[symbol].step))))
        o.status = 'PARTIALLY_FILLED'
      } else {
        this.fill(o, remaining)
      }
    }
  }

  fill(o: Order, qty: number): any {
    const base = RULES[o.symbol].base
    const quote = o.price * qty
    o.executedQty += qty
    o.quoteQty += quote
    o.status = o.executedQty >= o.origQty - 1e-12 ? 'FILLED' : 'PARTIALLY_FILLED'
    const trade =
      o.side === 'BUY'
        ? { commission: qty * 0.001, commissionAsset: base }
        : { commission: quote * 0.001, commissionAsset: 'USDT' }
    if (o.side === 'BUY') {
      this.balances.USDT -= quote
      this.balances[base] += qty - trade.commission
    } else {
      this.balances[base] -= qty
      this.balances.USDT += quote - trade.commission
    }
    const t = { orderId: o.orderId, price: String(o.price), qty: String(qty), quoteQty: String(quote), commission: String(trade.commission), commissionAsset: trade.commissionAsset }
    this.trades.push(t)
    return t
  }

  q(url: string) {
    return new URLSearchParams(url.split('?')[1])
  }

  order(o: Order, fills?: any[]) {
    return {
      orderId: o.orderId, symbol: o.symbol, side: o.side, price: String(o.price), origQty: String(o.origQty),
      executedQty: String(o.executedQty), cummulativeQuoteQty: String(o.quoteQty), status: o.status,
      transactTime: o.time, time: o.time, updateTime: o.time, ...(fills ? { fills } : {}),
    }
  }

  async get(url: string): Promise<any> {
    const path = url.split('?')[0].replace(/^https:\/\/[^/]+\/api/, '')
    const p = this.q(url)
    if (path === '/v3/exchangeInfo') {
      if (this.rulesDown) throw new Error('exchangeInfo down')
      const r = RULES[p.get('symbol')!]
      return { data: { symbols: [{ symbol: p.get('symbol'), baseAsset: r.base, quoteAsset: 'USDT', filters: [
        { filterType: 'PRICE_FILTER', minPrice: '0.01000000', maxPrice: '1000000.00000000', tickSize: r.tick },
        { filterType: 'LOT_SIZE', minQty: r.step, maxQty: '9000.00000000', stepSize: r.step },
        { filterType: 'NOTIONAL', minNotional: String(r.minNotional), applyMinToMarket: true, maxNotional: '9000000.0', applyMaxToMarket: false, avgPriceMins: 5 },
      ] }] } }
    }
    if (path === '/v3/ticker/price') return { data: { price: String(this.prices[p.get('symbol')!]) } }
    if (path === '/v3/order') {
      if (this.statusReadsFail && p.get('orderId')) throw new Error('status read failed')
      const o = p.get('orderId')
        ? this.orders.get(Number(p.get('orderId')))
        : [...this.orders.values()].find((x) => x.clientOrderId === p.get('origClientOrderId'))
      if (!o) this.err(-2013, 'Order does not exist.')
      return { data: this.order(o) }
    }
    if (path === '/v3/myTrades') return { data: this.trades.filter((t) => String(t.orderId) === p.get('orderId')) }
    if (path === '/v3/openOrders') {
      return { data: [...this.orders.values()].filter((o) => o.symbol === p.get('symbol') && (o.status === 'NEW' || o.status === 'PARTIALLY_FILLED')).map((o) => this.order(o)) }
    }
    throw new Error(`unhandled GET ${path}`)
  }

  async post(url: string): Promise<any> {
    this.posts.push(url)
    const p = this.q(url)
    const symbol = p.get('symbol')!
    const type = p.get('type')!
    const side = p.get('side') as 'BUY' | 'SELL'
    const r = RULES[symbol]
    if (!r) this.err(-1121, 'Invalid symbol.')

    const qtyText = p.get('quantity')!
    const priceText = p.get('price')
    for (const t of [qtyText, priceText ?? '']) if (/e/i.test(t)) this.err(-1100, 'Illegal characters found in parameter.')
    if (type === 'MARKET' && (priceText || p.get('timeInForce'))) this.err(-1106, "Parameter 'price'/'timeInForce' sent when not required.")
    if (type === 'LIMIT' && (!priceText || !p.get('timeInForce'))) this.err(-1102, 'Mandatory parameter was not sent.')

    const qty = parseFloat(qtyText)
    if (decimals(qtyText) > decimals(r.step) || !aligned(qty, r.step)) this.err(-1013, 'Filter failure: LOT_SIZE')
    const price = priceText ? parseFloat(priceText) : this.prices[symbol]
    if (priceText && (decimals(priceText) > decimals(r.tick) || !aligned(price, r.tick))) this.err(-1013, 'Filter failure: PRICE_FILTER')
    if (price * qty < r.minNotional) this.err(-1013, 'Filter failure: NOTIONAL')
    if (side === 'SELL' && this.balances[r.base] + 1e-12 < qty) this.err(-2010, 'Account has insufficient balance for requested action.')

    const order: Order = {
      orderId: this.nextId++, symbol, side, price, origQty: qty, executedQty: 0, quoteQty: 0,
      status: 'NEW', clientOrderId: p.get('newClientOrderId')!, time: Date.now(),
    }
    this.orders.set(order.orderId, order)

    const fills: any[] = []
    const marketable = type === 'MARKET' || (side === 'BUY' ? price >= this.prices[symbol] : price <= this.prices[symbol])
    if (marketable) {
      const t = this.fill(order, qty)
      fills.push({ price: t.price, qty: t.qty, commission: t.commission, commissionAsset: t.commissionAsset, tradeId: 1 })
    }

    if (this.losePostResponseOnce) {
      this.losePostResponseOnce = false
      throw new Error('socket hang up') // the order exists, the response never arrived
    }
    return { data: this.order(order, fills) }
  }

  async delete(url: string): Promise<any> {
    const o = this.orders.get(Number(this.q(url).get('orderId')))
    if (!o || o.status === 'FILLED' || o.status === 'CANCELED') this.err(-2011, 'Unknown order sent.')
    o.status = 'CANCELED'
    return { data: this.order(o) }
  }
}

const Bot: any = gridTradingBot.constructor
let ex: FakeExchange
let api: any

function newBot(opts: { levels?: number; bottom?: number; top?: number; invest?: number } = {}) {
  const bot = new Bot()
  bot.defaultsCreated.add('BTCUSDT')
  bot.defaultsCreated.add('ETHUSDT')
  bot.strayChecked.add('BTCUSDT')
  bot.addGridPosition('bitcoin', 'BTCUSDT', opts.levels ?? 1, opts.bottom ?? 100000, opts.top ?? 100000.0001, opts.invest ?? 50)
  return bot
}
const level = (bot: any) => bot.getPositionBySymbol('BTCUSDT').levels[0]
const position = (bot: any) => bot.getPositionBySymbol('BTCUSDT')

beforeEach(() => {
  process.env.DRY_RUN = 'false'
  delete process.env.GRID_BUY_TTL_MIN
  ex = new FakeExchange()
  api = getBinanceAPI() as any
  api.rulesCache.clear()
  api.lastPrices.clear()
  api.simOrders.clear()
  api.dryRunOrders.length = 0
  jest.spyOn(axios, 'get').mockImplementation((url: any) => ex.get(url))
  jest.spyOn(axios, 'post').mockImplementation((url: any) => ex.post(url))
  jest.spyOn(axios, 'delete').mockImplementation((url: any) => ex.delete(url))
})
afterEach(() => jest.restoreAllMocks())

describe('rounding: orders match exchange filters', () => {
  test('quantity and price are snapped to step/tick before sending', async () => {
    ex.prices.BTCUSDT = 99990.019 // not tick aligned
    const bot = newBot({ bottom: 99991, top: 99992 }) // level at 99991 >= price, inside the 2% buy band
    await bot.execute()
    expect(ex.posts).toHaveLength(1)
    const sent = new URLSearchParams(ex.posts[0].split('?')[1])
    expect(sent.get('price')).toBe('99990.01') // BUY rounds down
    expect(sent.get('quantity')).toBe('0.00050') // 50 / 99990.019 = 0.0005000... floored to the 1e-5 step
    expect(sent.get('type')).toBe('LIMIT')
    expect(sent.get('timeInForce')).toBe('GTC')
  })

  test('a quantity like 0.0011627906976744186 is never sent unrounded', async () => {
    const bot = newBot({ invest: 50 })
    ex.prices.BTCUSDT = 43000
    await newBot({ bottom: 43000, top: 43001 }).execute()
    for (const url of ex.posts) {
      const q = new URLSearchParams(url.split('?')[1]).get('quantity')!
      expect(q).toMatch(/^\d+\.\d{1,5}$/)
    }
    expect(bot).toBeDefined()
  })

  test('an order below the minimum notional is rejected locally and never sent', async () => {
    const bot = newBot({ invest: 2 }) // $2 < $5 minimum
    await bot.execute()
    expect(ex.posts).toHaveLength(0)
    expect(level(bot).status).toBe('pending')
    expect(api.getLastOrderError()?.code).toBe('ORDER_REJECTED_LOCALLY')
    expect(api.getLastOrderError()?.message).toMatch(/notional/i)
  })

  test('live order is refused (fail closed) when exchange rules cannot be loaded', async () => {
    ex.rulesDown = true
    const bot = newBot()
    await bot.execute()
    expect(ex.posts).toHaveLength(0)
    expect(level(bot).status).toBe('pending')
    expect(api.getLastOrderError()?.code).toBe('RULES_UNAVAILABLE')
  })

  test('MARKET orders send no price or timeInForce', async () => {
    const r = await api.placeOrder({ symbol: 'BTCUSDT', side: 'BUY', quantity: 0.0006, orderType: 'MARKET' })
    expect(r?.status).toBe('FILLED')
    const sent = new URLSearchParams(ex.posts[0].split('?')[1])
    expect(sent.has('price')).toBe(false)
    expect(sent.has('timeInForce')).toBe(false)
  })
})

describe('fill tracking', () => {
  test('a buy that crosses the book fills at once and is recorded from the order response', async () => {
    ex.prices.BTCUSDT = 100000.5 // tick aligned: the buy is placed AT the market, so it is marketable
    const bot = newBot({ bottom: 100000.5, top: 100001 })
    await bot.execute()
    expect(level(bot).status).toBe('filled')
    // 50 / 100000.5 = 0.00049999 -> 0.00049 (step); 0.1% fee in BTC -> 0.00048951 -> held 0.00048 (step)
    expect(level(bot).heldQty).toBe(0.00048)
    expect(level(bot).buyNetQty).toBeCloseTo(0.00048951, 8)
    expect(ex.posts).toHaveLength(1)
  })

  test('resting buy -> detected as filled on a later run, with real fee-adjusted holding', async () => {
    ex.prices.BTCUSDT = 100000.019
    const bot = newBot({ bottom: 100000.02, top: 100001 })
    await bot.execute() // buy placed at 100000.01, below the market of 100000.019 => rests
    expect(level(bot).status).toBe('buy_open')
    expect(level(bot).heldQty).toBeUndefined()
    expect(position(bot).totalFilled).toBe(0)

    ex.setPrice('BTCUSDT', 100000.01) // price falls to the order
    await bot.execute()
    expect(level(bot).status).toBe('filled')
    const order = [...ex.orders.values()][0]
    const netBase = order.origQty * 0.999 // fee charged in BTC
    expect(level(bot).heldQty).toBeLessThanOrEqual(netBase)
    expect(level(bot).heldQty).toBeGreaterThan(netBase - 0.00001) // floored to the 1e-5 step
    expect(level(bot).buyCost).toBeCloseTo(order.quoteQty, 6)
  })

  test('sell uses what is actually held, so it is accepted (selling the bought qty would hit -2010)', async () => {
    ex.prices.BTCUSDT = 100000.019
    const bot = newBot({ bottom: 100000.02, top: 100001 })
    await bot.execute()
    ex.setPrice('BTCUSDT', 100000.01)
    await bot.execute() // filled
    const bought = [...ex.orders.values()][0].origQty
    const held = level(bot).heldQty
    expect(held).toBeLessThan(bought)

    ex.setPrice('BTCUSDT', 102100.011) // >= level * 1.02; the SELL rounds UP to 102100.02, so it rests
    await bot.execute()
    const sell = [...ex.orders.values()].find((o) => o.side === 'SELL')!
    expect(sell).toBeDefined()
    expect(sell.price).toBe(102100.02)
    expect(sell.origQty).toBe(held)
    expect(level(bot).status).toBe('sell_open')
    expect(position(bot).totalProfit).toBe(0) // nothing is booked until the sell actually fills
  })

  test('profit is booked from real fills and fees only when the sell fills', async () => {
    ex.prices.BTCUSDT = 100000.019
    const bot = newBot({ bottom: 100000.02, top: 100001 })
    await bot.execute()
    ex.setPrice('BTCUSDT', 100000.01)
    await bot.execute() // buy filled
    const buy = [...ex.orders.values()][0]
    const cost = buy.quoteQty

    ex.setPrice('BTCUSDT', 102100)
    await bot.execute() // sell placed (marketable at its own price => may fill at once)
    await bot.execute() // reconcile
    const sell = [...ex.orders.values()].find((o) => o.side === 'SELL')!
    expect(sell.status).toBe('FILLED')

    // proceeds after the quote-asset fee, minus the cost of the coins actually sold (not the dust left behind)
    const boughtNet = buy.origQty * 0.999
    const expected = sell.quoteQty - sell.quoteQty * 0.001 - cost * (sell.origQty / boughtNet)
    expect(position(bot).totalProfit).toBeCloseTo(expected, 6)
    expect(position(bot).totalProfit).toBeGreaterThan(0)
    expect(position(bot).tradesCompleted).toBe(1)
    expect(level(bot).status).toBe('pending') // reset for the next cycle

    const naive = (102100 - 100000.01) * buy.origQty
    expect(position(bot).totalProfit).toBeLessThan(naive) // fees and rounding are accounted for
  })

  test('partial buy fill then TTL: cancelled, and the part that filled is kept', async () => {
    process.env.GRID_BUY_TTL_MIN = '1'
    ex.prices.BTCUSDT = 100000.019
    const bot = newBot({ bottom: 100000.02, top: 100001, invest: 500 })
    await bot.execute() // resting buy
    ex.partialNext = true
    ex.setPrice('BTCUSDT', 100000.01) // fills 40%
    await bot.execute()
    expect(level(bot).status).toBe('buy_open') // still resting: part-filled orders are not "filled"

    level(bot).buyOrderPlacedAt = new Date(Date.now() - 5 * 60_000) // older than the TTL
    await bot.execute()
    const order = [...ex.orders.values()][0]
    expect(order.status).toBe('CANCELED')
    expect(level(bot).status).toBe('filled')
    expect(level(bot).heldQty).toBeGreaterThan(0)
    expect(level(bot).heldQty).toBeLessThan(order.origQty * 0.5)
  })

  test('an unfilled buy past the TTL is cancelled and the level is freed', async () => {
    process.env.GRID_BUY_TTL_MIN = '1'
    ex.prices.BTCUSDT = 100000.019
    const bot = newBot({ bottom: 100000.02, top: 100001 })
    await bot.execute()
    level(bot).buyOrderPlacedAt = new Date(Date.now() - 5 * 60_000)
    ex.prices.BTCUSDT = 101500 // price ran away; the order stays unfilled
    await bot.execute()
    expect([...ex.orders.values()][0].status).toBe('CANCELED')
    expect(level(bot).heldQty).toBeUndefined()
  })

  test('if the order status cannot be read, nothing changes and no duplicate order is placed', async () => {
    ex.prices.BTCUSDT = 100000.019
    const bot = newBot({ bottom: 100000.02, top: 100001 })
    await bot.execute()
    expect(ex.posts).toHaveLength(1)
    ex.statusReadsFail = true
    await bot.execute()
    await bot.execute()
    expect(ex.posts).toHaveLength(1)
    expect(level(bot).status).toBe('buy_open')
  })

  test('a lost POST response is recovered via the client order id (no duplicate)', async () => {
    ex.prices.BTCUSDT = 100000.019
    ex.losePostResponseOnce = true
    const bot = newBot({ bottom: 100000.02, top: 100001 })
    await bot.execute()
    expect(ex.orders.size).toBe(1)
    expect(level(bot).status).toBe('buy_open')
    expect(level(bot).buyOrderId).toBe(String([...ex.orders.values()][0].orderId))
    await bot.execute()
    expect(ex.posts).toHaveLength(1)
  })

  test('a sell cancelled on the exchange returns the level to holding, so it can be retried', async () => {
    ex.prices.BTCUSDT = 100000.019
    const bot = newBot({ bottom: 100000.02, top: 100001 })
    await bot.execute()
    ex.setPrice('BTCUSDT', 100000.01)
    await bot.execute() // filled
    ex.prices.BTCUSDT = 102100.011 // sell rounds up above the market, so it rests
    await bot.execute()
    const sell = [...ex.orders.values()].find((o) => o.side === 'SELL')!
    expect(level(bot).status).toBe('sell_open')
    sell.status = 'CANCELED' // e.g. cancelled by hand on the exchange
    await bot.execute()
    expect(['filled', 'sell_open']).toContain(level(bot).status)
    expect(level(bot).heldQty).toBeGreaterThan(0)
  })

  test('orders already resting on the exchange are reported once as untracked', async () => {
    ex.prices.BTCUSDT = 100000.019
    await api.placeOrder({ symbol: 'BTCUSDT', side: 'BUY', quantity: 0.0006, price: 90000, orderType: 'LIMIT' })
    const bot = newBot({ bottom: 200000, top: 201000 })
    bot.strayChecked.delete('BTCUSDT')
    const warn = jest.spyOn(bot.logger, 'warn')
    await bot.execute()
    await bot.execute()
    expect(warn.mock.calls.filter((c) => String(c[0]).includes('not tracked'))).toHaveLength(1)
  })
})

describe('dry run (simulated exchange fills)', () => {
  test('full cycle with no POST: rests, fills on touch with fees, sells, books profit', async () => {
    process.env.DRY_RUN = 'true'
    ex.prices.BTCUSDT = 100000.019
    const bot = newBot({ bottom: 100000.02, top: 100001 })
    await bot.execute()
    expect(level(bot).status).toBe('buy_open')

    ex.setPrice('BTCUSDT', 100000.01)
    await bot.execute()
    expect(level(bot).status).toBe('filled')
    expect(level(bot).heldQty).toBeLessThan(0.0005)

    ex.setPrice('BTCUSDT', 102100)
    await bot.execute()
    await bot.execute()
    expect(position(bot).tradesCompleted).toBe(1)
    expect(position(bot).totalProfit).toBeGreaterThan(0)
    expect(ex.posts).toHaveLength(0) // nothing was ever sent
  })

  test('simulated orders are rounded to the real filters too', async () => {
    process.env.DRY_RUN = 'true'
    ex.prices.BTCUSDT = 99990.019
    const bot = newBot({ bottom: 99991, top: 99992 })
    await bot.execute()
    const o = api.getDryRunOrders()[0]
    expect(o.price).toBe(99990.01)
    expect(o.quantity).toBe(0.0005)
    expect(o.simulated).toBe(true)
  })

  test('a below-minimum order is rejected in dry run as well, exposing config problems early', async () => {
    process.env.DRY_RUN = 'true'
    const bot = newBot({ invest: 2 })
    await bot.execute()
    expect(api.getDryRunOrders()).toHaveLength(0)
    expect(level(bot).status).toBe('pending')
  })

  test('without exchange rules, dry run still simulates (flagged unvalidated) but never sends', async () => {
    process.env.DRY_RUN = 'true'
    ex.rulesDown = true
    const bot = newBot()
    await bot.execute()
    expect(api.getDryRunOrders()[0]?.unvalidated).toBe(true)
    expect(ex.posts).toHaveLength(0)
  })
})
