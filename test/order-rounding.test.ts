import {
  ceilToStep,
  decimalsOf,
  floorToStep,
  formatDecimal,
  parseSymbolRules,
  prepareOrder,
  roundPrice,
  roundQuantity,
  SymbolRules,
} from '../src/services/order-rounding'

// Shape of a real GET /api/v3/exchangeInfo?symbol=BTCUSDT entry
const btcInfo = {
  symbol: 'BTCUSDT',
  baseAsset: 'BTC',
  quoteAsset: 'USDT',
  filters: [
    { filterType: 'PRICE_FILTER', minPrice: '0.01000000', maxPrice: '1000000.00000000', tickSize: '0.01000000' },
    { filterType: 'LOT_SIZE', minQty: '0.00001000', maxQty: '9000.00000000', stepSize: '0.00001000' },
    { filterType: 'NOTIONAL', minNotional: '5.00000000', applyMinToMarket: true, maxNotional: '9000000.00000000', applyMaxToMarket: false, avgPriceMins: 5 },
  ],
}

describe('order rounding', () => {
  let rules: SymbolRules
  beforeAll(() => {
    rules = parseSymbolRules(btcInfo)!
  })

  test('parses exchangeInfo filters', () => {
    expect(rules).toMatchObject({ baseAsset: 'BTC', quoteAsset: 'USDT', tickSize: 0.01, stepSize: 0.00001, minQty: 0.00001, minNotional: 5 })
  })

  test('falls back to MIN_NOTIONAL and refuses when essential filters are missing', () => {
    const old = parseSymbolRules({ ...btcInfo, filters: [btcInfo.filters[0], btcInfo.filters[1], { filterType: 'MIN_NOTIONAL', minNotional: '10.0', applyToMarket: true, avgPriceMins: 5 }] })!
    expect(old.minNotional).toBe(10)
    expect(old.applyMinToMarket).toBe(true)
    expect(parseSymbolRules({ ...btcInfo, filters: [btcInfo.filters[0]] })).toBeNull()
    expect(parseSymbolRules(null)).toBeNull()
  })

  test('decimalsOf', () => {
    expect(decimalsOf('0.00100000')).toBe(3)
    expect(decimalsOf('1.00000000')).toBe(0)
    expect(decimalsOf(0.01)).toBe(2)
    expect(decimalsOf(0.00000001)).toBe(8)
  })

  test('floor/ceil to step are float-safe', () => {
    expect(floorToStep(0.3, 0.1)).toBe(0.3) // 0.3 / 0.1 = 2.9999999999999996
    expect(floorToStep(0.7, 0.1)).toBe(0.7)
    expect(floorToStep(1.15, 0.01)).toBe(1.15)
    expect(floorToStep(0.0011627906976744186, 0.00001)).toBe(0.00116)
    expect(ceilToStep(97500.001, 0.01)).toBe(97500.01)
    expect(ceilToStep(97500.01, 0.01)).toBe(97500.01)
  })

  test('formats without exponent notation', () => {
    expect(formatDecimal(0.0000005, 8)).toBe('0.00000050')
    expect(formatDecimal(0.00116, 5)).toBe('0.00116')
    expect(formatDecimal(97500, 2)).toBe('97500.00')
  })

  test('BUY price rounds down, SELL price rounds up, to the tick', () => {
    expect(roundPrice(97500.019, rules, 'BUY')).toBe(97500.01)
    expect(roundPrice(97500.011, rules, 'SELL')).toBe(97500.02)
    expect(roundPrice(97500.01, rules, 'SELL')).toBe(97500.01)
  })

  test('quantity always rounds down, never up', () => {
    expect(roundQuantity(0.00116279069767, rules)).toBe(0.00116)
    expect(roundQuantity(0.001169999, rules)).toBe(0.00116)
  })

  test('typical grid order ($50 of BTC at 97,500) is valid and snapped', () => {
    const o = prepareOrder(rules, 'BUY', 50 / 97500.019, 97500.019)
    expect(o).toMatchObject({ ok: true, price: '97500.01', quantity: '0.00051' })
    // the notional that Binance will check is price*qty >= 5
    expect(o.priceValue! * o.quantityValue).toBeGreaterThan(5)
  })

  test('rejects quantity that rounds below minQty', () => {
    const o = prepareOrder(rules, 'BUY', 0.000004, 97500)
    expect(o.ok).toBe(false)
    expect(o.reason).toMatch(/minQty/)
  })

  test('rejects an order below the minimum notional', () => {
    const o = prepareOrder(rules, 'BUY', 0.00004, 97500) // 3.9 USDT
    expect(o.ok).toBe(false)
    expect(o.reason).toMatch(/minNotional/)
  })

  test('rejects invalid input instead of sending it', () => {
    expect(prepareOrder(rules, 'BUY', NaN, 97500).ok).toBe(false)
    expect(prepareOrder(rules, 'BUY', 0, 97500).ok).toBe(false)
    expect(prepareOrder(rules, 'BUY', 1, -1).ok).toBe(false)
  })

  test('MARKET orders carry no price and use the reference price for notional', () => {
    const o = prepareOrder(rules, 'SELL', 0.0006, undefined, 97500)
    expect(o.ok).toBe(true)
    expect(o.price).toBeUndefined()
    const small = prepareOrder(rules, 'SELL', 0.00003, undefined, 97500)
    expect(small.ok).toBe(false)
  })

  test('clamps quantity to maxQty', () => {
    const o = prepareOrder(rules, 'BUY', 100000, 10)
    expect(o.quantityValue).toBeLessThanOrEqual(9000)
  })
})
