/**
 * DRY_RUN and ALLOW_MAINNET_ORDERS: while orders are blocked, nothing that changes
 * state on the exchange (POST/DELETE) is ever sent. Reads (exchange rules) are fine.
 */
import axios from 'axios'
import { BinanceAPI } from '../src/services/binance-api'

const exchangeInfo = {
  symbols: [
    {
      symbol: 'BTCUSDT', baseAsset: 'BTC', quoteAsset: 'USDT',
      filters: [
        { filterType: 'PRICE_FILTER', minPrice: '0.01', maxPrice: '1000000', tickSize: '0.01' },
        { filterType: 'LOT_SIZE', minQty: '0.00001', maxQty: '9000', stepSize: '0.00001' },
        { filterType: 'NOTIONAL', minNotional: '5', applyMinToMarket: true, maxNotional: '9000000', avgPriceMins: 5 },
      ],
    },
  ],
}

let posts: string[]
let deletes: string[]
const order = { symbol: 'BTCUSDT', side: 'BUY' as const, quantity: 0.0006, price: 100000, orderType: 'LIMIT' as const }
const env = (vars: { DRY_RUN?: string; ALLOW_MAINNET_ORDERS?: string }) => {
  for (const k of ['DRY_RUN', 'ALLOW_MAINNET_ORDERS'] as const) {
    if (vars[k] === undefined) delete process.env[k]
    else process.env[k] = vars[k]
  }
}
const testnet = () => new BinanceAPI('k', 's', true)
const mainnet = () => new BinanceAPI('k', 's', false)

beforeEach(() => {
  posts = []
  deletes = []
  env({})
  jest.spyOn(axios, 'get').mockImplementation(async () => ({ data: exchangeInfo }))
  jest.spyOn(axios, 'post').mockImplementation(async (url: any) => {
    posts.push(url.split('?')[0])
    return { data: { orderId: 1, symbol: 'BTCUSDT', side: 'BUY', origQty: '0.0006', price: '100000', executedQty: '0', cummulativeQuoteQty: '0', status: 'NEW', transactTime: 1 } }
  })
  jest.spyOn(axios, 'delete').mockImplementation(async (url: any) => {
    deletes.push(url.split('?')[0])
    return { data: {} }
  })
})
afterEach(() => jest.restoreAllMocks())

describe('DRY_RUN', () => {
  test('DRY_RUN=true: nothing is sent, the order is simulated and clearly marked', async () => {
    env({ DRY_RUN: 'true' })
    const api = testnet()
    const r = await api.placeOrder(order)
    expect(posts).toHaveLength(0)
    expect(r).toMatchObject({ simulated: true, status: 'DRY_RUN' })
    expect(r!.orderId).toBeLessThan(0)
  })

  test('cancel: a simulated order is cancelled locally, a real order id is not touched', async () => {
    env({ DRY_RUN: 'true' })
    const api = testnet()
    const sim = (await api.placeOrder(order))!
    expect(await api.cancelOrder('BTCUSDT', sim.orderId)).toBe(true)
    expect(await api.cancelOrder('BTCUSDT', 12345)).toBe(false)
    expect(deletes).toHaveLength(0)
  })

  test('a cancelled simulated order cannot be cancelled again', async () => {
    env({ DRY_RUN: 'true' })
    const api = testnet()
    const sim = (await api.placeOrder(order))!
    await api.cancelOrder('BTCUSDT', sim.orderId)
    expect(await api.cancelOrder('BTCUSDT', sim.orderId)).toBe(false)
  })

  test.each(['false', '0', 'off', 'no', ''])('DRY_RUN=%j still sends orders (testnet)', async (v) => {
    env({ DRY_RUN: v })
    await testnet().placeOrder(order)
    expect(posts).toHaveLength(1)
  })

  test('an unrecognised value fails safe to dry run', async () => {
    env({ DRY_RUN: 'ture' })
    const r = await testnet().placeOrder(order)
    expect(r?.simulated).toBe(true)
    expect(posts).toHaveLength(0)
  })

  test('the flag is read at call time', async () => {
    const api = testnet()
    env({ DRY_RUN: 'false' })
    await api.placeOrder(order)
    env({ DRY_RUN: 'true' })
    await api.placeOrder(order)
    expect(posts).toHaveLength(1)
  })
})

describe('mainnet gate (ALLOW_MAINNET_ORDERS)', () => {
  test('mainnet with the gate closed: simulated, nothing sent', async () => {
    const r = await mainnet().placeOrder(order)
    expect(r?.simulated).toBe(true)
    expect(posts).toHaveLength(0)
  })

  test('mainnet with ALLOW_MAINNET_ORDERS=true sends to api.binance.com', async () => {
    env({ ALLOW_MAINNET_ORDERS: 'true' })
    const r = await mainnet().placeOrder(order)
    expect(r?.simulated).not.toBe(true)
    expect(posts).toEqual(['https://api.binance.com/api/v3/order'])
  })

  test('case and surrounding spaces are accepted', async () => {
    env({ ALLOW_MAINNET_ORDERS: ' TRUE ' })
    await mainnet().placeOrder(order)
    expect(posts).toHaveLength(1)
  })

  test.each(['1', 'yes', 'on', 'false', '', 'ture', 'tru'])('ALLOW_MAINNET_ORDERS=%j keeps the gate closed', async (v) => {
    env({ ALLOW_MAINNET_ORDERS: v })
    const r = await mainnet().placeOrder(order)
    expect(r?.simulated).toBe(true)
    expect(posts).toHaveLength(0)
  })

  test('DRY_RUN=true wins over ALLOW_MAINNET_ORDERS=true', async () => {
    env({ ALLOW_MAINNET_ORDERS: 'true', DRY_RUN: 'true' })
    const r = await mainnet().placeOrder(order)
    expect(r?.simulated).toBe(true)
    expect(posts).toHaveLength(0)
  })

  test('cancels follow the gate', async () => {
    const api = mainnet()
    expect(await api.cancelOrder('BTCUSDT', 777)).toBe(false)
    expect(deletes).toHaveLength(0)
    env({ ALLOW_MAINNET_ORDERS: 'true' })
    expect(await api.cancelOrder('BTCUSDT', 777)).toBe(true)
    expect(deletes).toEqual(['https://api.binance.com/api/v3/order'])
  })

  test('closing the gate at runtime takes effect immediately', async () => {
    const api = mainnet()
    env({ ALLOW_MAINNET_ORDERS: 'true' })
    await api.placeOrder(order)
    env({ ALLOW_MAINNET_ORDERS: 'false' })
    await api.placeOrder(order)
    expect(posts).toHaveLength(1)
  })

  test('testnet is not affected by the gate', async () => {
    await testnet().placeOrder(order)
    expect(posts).toEqual(['https://testnet.binance.vision/api/v3/order'])
  })
})
