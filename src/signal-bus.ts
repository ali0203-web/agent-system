/**
 * In-memory signal bus.
 *
 * Every BaseAgent.publishEvent() call is recorded here (before the DB write, so
 * it works even when Postgres is unavailable). Directional signals are
 * normalised into votes (+1 bullish / -1 bearish) so the Signal Aggregator can
 * combine what the other bots actually said instead of inventing data.
 *
 * Bots whose inputs are partly fabricated (random volume / random direction)
 * are deliberately NOT in VOTERS, so they cannot influence a consensus.
 */

export interface Vote {
  agent: string
  event: string
  symbol: string // base asset, e.g. "BTC"
  direction: 1 | -1
  confidence: number // 0..1
  timestamp: number
}

type Extractor = (data: any) => { direction: 1 | -1; confidence?: number } | null

const clamp01 = (n: unknown, fallback = 0.5): number =>
  typeof n === 'number' && Number.isFinite(n) ? Math.max(0, Math.min(1, n)) : fallback

/** Events that carry a usable directional opinion, keyed by event name. */
const VOTERS: Record<string, Extractor> = {
  'ichimoku-signal': (d) =>
    d.signal === 'bullish' ? { direction: 1 } : d.signal === 'bearish' ? { direction: -1 } : null,

  'ma-signal': (d) =>
    d.signal === 'bullish' ? { direction: 1 } : d.signal === 'bearish' ? { direction: -1 } : null,

  'macd-signal': (d) =>
    d.type === 'bullish-crossover'
      ? { direction: 1, confidence: clamp01(d.strength) }
      : d.type === 'bearish-crossover'
        ? { direction: -1, confidence: clamp01(d.strength) }
        : null,

  // Mean-reversion reading: oversold => bullish, overbought => bearish
  'rsi-signal': (d) =>
    d.type === 'oversold'
      ? { direction: 1, confidence: clamp01(d.strength) }
      : d.type === 'overbought'
        ? { direction: -1, confidence: clamp01(d.strength) }
        : null,

  'stochastic-signal': (d) =>
    d.crossover === 'bullish'
      ? { direction: 1 }
      : d.crossover === 'bearish'
        ? { direction: -1 }
        : d.signal === 'oversold'
          ? { direction: 1 }
          : d.signal === 'overbought'
            ? { direction: -1 }
            : null,

  'reversion-signal': (d) =>
    d.signal === 'oversold'
      ? { direction: 1, confidence: clamp01(d.confidence) }
      : d.signal === 'overbought'
        ? { direction: -1, confidence: clamp01(d.confidence) }
        : null,

  'ml-signal': (d) =>
    d.prediction === 'bullish'
      ? { direction: 1, confidence: clamp01(d.confidence) }
      : d.prediction === 'bearish'
        ? { direction: -1, confidence: clamp01(d.confidence) }
        : null,

  'regime-signal': (d) =>
    d.regime === 'bull'
      ? { direction: 1, confidence: clamp01(d.confidence) }
      : d.regime === 'bear'
        ? { direction: -1, confidence: clamp01(d.confidence) }
        : null,

  'trend-signal': (d) =>
    d.direction === 'uptrend'
      ? { direction: 1, confidence: clamp01(d.confidence) }
      : d.direction === 'downtrend'
        ? { direction: -1, confidence: clamp01(d.confidence) }
        : null,

  'bollinger-signal': (d) => {
    const { price, upper, lower } = d
    if (![price, upper, lower].every((n) => typeof n === 'number')) return null
    const confidence = clamp01(d.signal_strength)
    if (d.type === 'mean-reversion') {
      return price <= lower
        ? { direction: 1, confidence }
        : price >= upper
          ? { direction: -1, confidence }
          : null
    }
    if (d.type === 'breakout') {
      return price >= upper
        ? { direction: 1, confidence }
        : price <= lower
          ? { direction: -1, confidence }
          : null
    }
    return null
  },
}

const baseSymbol = (s: unknown): string | null =>
  typeof s === 'string' && s.length > 0 ? s.toUpperCase().replace(/(USDT|USD|BUSD)$/, '') : null

class SignalBus {
  // latest vote per (agent, symbol)
  private latest = new Map<string, Vote>()

  /** Record a published event. Non-directional or unknown events are ignored. Never throws. */
  record(agent: string, event: string, data: any): void {
    try {
      const extract = VOTERS[event]
      if (!extract || !data) return
      const symbol = baseSymbol(data.symbol)
      if (!symbol) return
      const v = extract(data)
      if (!v) {
        // The bot now says "no opinion": drop its previous vote for this symbol
        this.latest.delete(`${agent}|${symbol}`)
        return
      }
      this.latest.set(`${agent}|${symbol}`, {
        agent,
        event,
        symbol,
        direction: v.direction,
        confidence: v.confidence ?? 0.5,
        timestamp: Date.now(),
      })
    } catch {
      // The bus must never break an agent
    }
  }

  /** Votes for a symbol (accepts "BTC" or "BTCUSDT") newer than maxAgeMs. */
  votesFor(symbol: string, maxAgeMs: number): Vote[] {
    const base = baseSymbol(symbol)
    const cutoff = Date.now() - maxAgeMs
    const out: Vote[] = []
    for (const [key, vote] of this.latest) {
      if (vote.timestamp < cutoff) {
        this.latest.delete(key) // expire
      } else if (vote.symbol === base) {
        out.push(vote)
      }
    }
    return out
  }

  clear(): void {
    this.latest.clear()
  }
}

export const signalBus = new SignalBus()
