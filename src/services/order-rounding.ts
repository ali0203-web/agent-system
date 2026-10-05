/**
 * Binance order rounding and validation.
 *
 * Binance rejects an order unless, for the symbol's filters:
 *   price    >= minPrice, <= maxPrice, and a multiple of tickSize   (PRICE_FILTER)
 *   quantity >= minQty,   <= maxQty,   and a multiple of stepSize   (LOT_SIZE)
 *   price * quantity >= minNotional (and <= maxNotional)            (NOTIONAL / MIN_NOTIONAL)
 *
 * Everything here is pure and decimal-safe: values are snapped to the step using
 * the step's own number of decimals and returned as plain decimal strings, never
 * exponent notation ("5e-7"), which Binance would reject in a query string.
 */

export interface SymbolRules {
  symbol: string
  baseAsset: string
  quoteAsset: string
  tickSize: number
  minPrice: number
  maxPrice: number
  stepSize: number
  minQty: number
  maxQty: number
  minNotional: number // 0 when the symbol has no notional filter
  maxNotional: number // Infinity when unbounded
  applyMinToMarket: boolean
}

export type OrderSide = 'BUY' | 'SELL'

export interface RoundedOrder {
  ok: boolean
  /** Price formatted for the API (undefined for MARKET orders). */
  price?: string
  /** Quantity formatted for the API. */
  quantity: string
  priceValue?: number
  quantityValue: number
  /** Why the order cannot be placed (only when ok is false). */
  reason?: string
}

/** Number of decimals in a step such as "0.00100000" (-> 3) or "1.00000000" (-> 0). */
export function decimalsOf(step: number | string): number {
  const s = typeof step === 'number' ? step.toFixed(12) : step
  const [, frac = ''] = s.split('.')
  return frac.replace(/0+$/, '').length
}

/** Plain decimal string with a fixed number of decimals (no exponent notation). */
export function formatDecimal(value: number, decimals: number): string {
  return value.toFixed(Math.max(0, Math.min(18, decimals)))
}

/** Snap `value` down (floor) or up (ceil) to a multiple of `step` (Binance: value % step == 0). */
function snap(value: number, step: number, mode: 'floor' | 'ceil'): number {
  if (!(step > 0)) return value
  const decimals = decimalsOf(step)
  // The epsilon absorbs binary float error (e.g. 0.3 / 0.1 = 2.9999999999999996)
  const units = value / step
  const snapped = mode === 'floor' ? Math.floor(units + 1e-9) : Math.ceil(units - 1e-9)
  return Number((snapped * step).toFixed(decimals))
}

export const floorToStep = (value: number, step: number): number => snap(value, step, 'floor')
export const ceilToStep = (value: number, step: number): number => snap(value, step, 'ceil')

/**
 * Round a price to the tick: BUY rounds down (never pay more than asked),
 * SELL rounds up (never accept less than asked).
 */
export function roundPrice(price: number, rules: SymbolRules, side: OrderSide): number {
  const rounded = snap(price, rules.tickSize, side === 'BUY' ? 'floor' : 'ceil')
  return Math.min(Math.max(rounded, rules.minPrice), rules.maxPrice)
}

/** Round a quantity DOWN to the step (never sell/buy more than intended or held). */
export function roundQuantity(quantity: number, rules: SymbolRules): number {
  return snap(Math.min(quantity, rules.maxQty), rules.stepSize, 'floor')
}

/**
 * Round and validate an order against the symbol rules. For MARKET orders there is
 * no price; the notional check then uses `referencePrice` (e.g. the last price).
 */
export function prepareOrder(
  rules: SymbolRules,
  side: OrderSide,
  quantity: number,
  price: number | undefined,
  referencePrice?: number
): RoundedOrder {
  const isMarket = price === undefined
  const qtyDecimals = decimalsOf(rules.stepSize)
  const priceDecimals = decimalsOf(rules.tickSize)

  if (!Number.isFinite(quantity) || quantity <= 0) {
    return { ok: false, quantity: '0', quantityValue: 0, reason: `invalid quantity ${quantity}` }
  }
  if (!isMarket && (!Number.isFinite(price) || (price as number) <= 0)) {
    return { ok: false, quantity: '0', quantityValue: 0, reason: `invalid price ${price}` }
  }

  const qty = roundQuantity(quantity, rules)
  const px = isMarket ? undefined : roundPrice(price as number, rules, side)

  const base: RoundedOrder = {
    ok: false,
    quantity: formatDecimal(qty, qtyDecimals),
    quantityValue: qty,
    price: px === undefined ? undefined : formatDecimal(px, priceDecimals),
    priceValue: px,
  }

  if (qty < rules.minQty || qty <= 0) {
    return {
      ...base,
      reason: `quantity ${quantity} rounds to ${base.quantity}, below minQty ${rules.minQty} (stepSize ${rules.stepSize})`,
    }
  }

  const notionalPrice = px ?? referencePrice
  if (notionalPrice !== undefined && (!isMarket || rules.applyMinToMarket)) {
    const notional = notionalPrice * qty
    if (rules.minNotional > 0 && notional < rules.minNotional) {
      return { ...base, reason: `notional ${notional.toFixed(4)} is below minNotional ${rules.minNotional}` }
    }
    if (notional > rules.maxNotional) {
      return { ...base, reason: `notional ${notional.toFixed(4)} is above maxNotional ${rules.maxNotional}` }
    }
  }

  return { ...base, ok: true }
}

/**
 * Build SymbolRules from one entry of GET /api/v3/exchangeInfo `symbols[]`.
 * Returns null if the essential PRICE_FILTER / LOT_SIZE filters are missing, so the
 * caller can refuse to trade rather than guess.
 */
export function parseSymbolRules(info: any): SymbolRules | null {
  if (!info || !Array.isArray(info.filters)) return null
  const byType = (t: string) => info.filters.find((f: any) => f.filterType === t)

  const price = byType('PRICE_FILTER')
  const lot = byType('LOT_SIZE')
  if (!price || !lot) return null

  const tickSize = parseFloat(price.tickSize)
  const stepSize = parseFloat(lot.stepSize)
  if (!(tickSize > 0) || !(stepSize > 0)) return null

  // Newer symbols use NOTIONAL, older ones MIN_NOTIONAL
  const notional = byType('NOTIONAL')
  const minNotionalFilter = byType('MIN_NOTIONAL')
  const maxNotional = notional ? parseFloat(notional.maxNotional) : NaN

  return {
    symbol: info.symbol,
    baseAsset: info.baseAsset,
    quoteAsset: info.quoteAsset,
    tickSize,
    minPrice: parseFloat(price.minPrice) || 0,
    maxPrice: parseFloat(price.maxPrice) > 0 ? parseFloat(price.maxPrice) : Infinity,
    stepSize,
    minQty: parseFloat(lot.minQty) || 0,
    maxQty: parseFloat(lot.maxQty) > 0 ? parseFloat(lot.maxQty) : Infinity,
    minNotional: parseFloat((notional ?? minNotionalFilter)?.minNotional) || 0,
    maxNotional: maxNotional > 0 ? maxNotional : Infinity,
    applyMinToMarket: Boolean(notional?.applyMinToMarket ?? minNotionalFilter?.applyToMarket),
  }
}
