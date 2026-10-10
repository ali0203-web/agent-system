/**
 * A fake Binance for tests. It enforces the real exchange rules independently of the code
 * under test (tick/step size, min notional, MARKET parameter rules, balances, fees paid in
 * the base asset) and fills resting orders when the price touches them.
 */

export interface Order {
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
export const RULES: Record<string, { base: string; tick: string; step: string; minNotional: number }> = {
  BTCUSDT: { base: 'BTC', tick: '0.01000000', step: '0.00001000', minNotional: 5 },
  ETHUSDT: { base: 'ETH', tick: '0.01000000', step: '0.00010000', minNotional: 5 },
}
const decimals = (s: string) => (s.split('.')[1] ?? '').replace(/0+$/, '').length
const aligned = (value: number, step: string) => {
  const q = value / parseFloat(step)
  return Math.abs(q - Math.round(q)) < 1e-7
}

export class FakeExchange {
  prices: Record<string, number> = { BTCUSDT: 100000, ETHUSDT: 3000 }
  orders = new Map<number, Order>()
  trades: any[] = []
  balances: Record<string, number> = { USDT: 100000, BTC: 0, ETH: 0 }
  nextId = 5000
  posts: string[] = []
  rulesDown = false
  statusReadsFail = false
  losePostResponseOnce = false
  clientLookupFails = false // GET /v3/order by origClientOrderId fails with a network error
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
      if (this.clientLookupFails && p.get('origClientOrderId')) throw new Error('network unreachable')
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

