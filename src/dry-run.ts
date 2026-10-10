/**
 * Dry-run switch.
 *
 * When on, nothing that changes state on the exchange (placing or cancelling
 * orders) is sent: BinanceAPI simulates it instead. Controlled by the DRY_RUN
 * environment variable and read at call time, so it can't be bypassed by import
 * order or a stale cached config value.
 *
 *   DRY_RUN unset / false / 0 / no / off  -> live orders (current default)
 *   DRY_RUN true / 1 / yes / on           -> dry run
 *   anything else (typo such as "ture")   -> dry run, fail-safe
 *
 * Mainnet gate: orders against MAINNET (real money) additionally require
 * ALLOW_MAINNET_ORDERS=true. It is deliberately strict: only the exact value
 * "true" (any case) opens it; unset, "1", "yes" or a typo keep it closed. When
 * closed, orders are simulated exactly like a dry run. Testnet is unaffected.
 */

const TRUE_VALUES = new Set(['true', '1', 'yes', 'on'])
const FALSE_VALUES = new Set(['', 'false', '0', 'no', 'off'])

export function parseDryRun(value: string | undefined): { dryRun: boolean; recognized: boolean } {
  const v = (value ?? '').trim().toLowerCase()
  if (TRUE_VALUES.has(v)) return { dryRun: true, recognized: true }
  if (FALSE_VALUES.has(v)) return { dryRun: false, recognized: true }
  return { dryRun: true, recognized: false } // unrecognised value: fail safe
}

export function isDryRun(): boolean {
  return parseDryRun(process.env.DRY_RUN).dryRun
}

/** True only for ALLOW_MAINNET_ORDERS=true (case-insensitive, trimmed). */
export function mainnetOrdersAllowed(): boolean {
  return (process.env.ALLOW_MAINNET_ORDERS ?? '').trim().toLowerCase() === 'true'
}

export type OrderBlockReason = 'dry-run' | 'mainnet-not-allowed'

/**
 * Why orders must NOT be sent right now, or null if they may be.
 * `useTestnet` is the network the exchange client is actually pointed at.
 */
export function orderBlockReason(useTestnet: boolean): OrderBlockReason | null {
  if (isDryRun()) return 'dry-run'
  if (!useTestnet && !mainnetOrdersAllowed()) return 'mainnet-not-allowed'
  return null
}
