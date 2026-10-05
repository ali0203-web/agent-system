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
