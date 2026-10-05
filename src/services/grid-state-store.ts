/**
 * Persistence for grid-bot state, so a restart does not forget resting orders.
 *
 *   db   (default when DATABASE_URL / POSTGRES_URL is set) one JSONB row per key in `grid_state`.
 *        This is what survives a container redeploy.
 *   file (default otherwise) one JSON file per key in GRID_STATE_DIR (default ./data), written
 *        atomically (temp file + rename). Fine locally; a container's disk is usually wiped on redeploy.
 *   off  (GRID_STATE_STORE=off) nothing is saved.
 *
 * Contract used by the bot:
 *   load() resolves to null when there is no saved state (a clean first run) and THROWS when the
 *   state could not be read, so "nothing saved" is never confused with "could not look".
 *   save() throws when the state could not be written.
 */

import * as fs from 'fs'
import * as path from 'path'

export interface GridStateStore {
  readonly kind: 'db' | 'file' | 'off'
  load(key: string): Promise<string | null>
  save(key: string, json: string): Promise<void>
}

/** Saved state exists but is not usable. The bot refuses to trade rather than start over. */
export class CorruptStateError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'CorruptStateError'
  }
}

/** JSON keys that hold dates in the saved state. */
const DATE_KEYS = new Set(['createdAt', 'buyOrderPlacedAt', 'buyFilledAt', 'soldAt', 'at'])

/** Parse saved JSON, turning the known date fields back into Date objects. */
export function parseStateJson(json: string): any {
  try {
    return JSON.parse(json, (key, value) =>
      DATE_KEYS.has(key) && typeof value === 'string' && !Number.isNaN(Date.parse(value)) ? new Date(value) : value
    )
  } catch (error: any) {
    throw new CorruptStateError(`saved grid state is not valid JSON: ${error?.message}`)
  }
}

const safeName = (key: string) => key.replace(/[^A-Za-z0-9_.-]+/g, '-')

export class FileGridStateStore implements GridStateStore {
  readonly kind = 'file' as const

  constructor(private dir: string = process.env.GRID_STATE_DIR || path.resolve(process.cwd(), 'data')) {}

  private fileFor(key: string): string {
    return path.join(this.dir, `${safeName(key)}.json`)
  }

  async load(key: string): Promise<string | null> {
    try {
      return await fs.promises.readFile(this.fileFor(key), 'utf8')
    } catch (error: any) {
      if (error?.code === 'ENOENT') return null
      throw error
    }
  }

  async save(key: string, json: string): Promise<void> {
    const file = this.fileFor(key)
    const tmp = `${file}.${process.pid}.tmp`
    await fs.promises.mkdir(this.dir, { recursive: true })
    const handle = await fs.promises.open(tmp, 'w')
    try {
      await handle.writeFile(json, 'utf8')
      await handle.sync() // on disk before it replaces the old copy
    } finally {
      await handle.close()
    }
    await fs.promises.rename(tmp, file) // atomic: readers see the old or the new file, never half
  }
}

/** The part of the Database class this store needs (lets tests pass a fake). */
export interface QueryRunner {
  query(text: string, values?: any[]): Promise<{ rows: any[] }>
}

export class DbGridStateStore implements GridStateStore {
  readonly kind = 'db' as const
  private ready = false

  constructor(private db: QueryRunner) {}

  private async ensureTable(): Promise<void> {
    if (this.ready) return
    await this.db.query(`
      CREATE TABLE IF NOT EXISTS grid_state (
        key VARCHAR(255) PRIMARY KEY,
        state JSONB NOT NULL,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `)
    this.ready = true
  }

  async load(key: string): Promise<string | null> {
    await this.ensureTable()
    const result = await this.db.query('SELECT state FROM grid_state WHERE key = $1', [key])
    if (result.rows.length === 0) return null
    const state = result.rows[0].state
    return typeof state === 'string' ? state : JSON.stringify(state)
  }

  async save(key: string, json: string): Promise<void> {
    await this.ensureTable()
    await this.db.query(
      `INSERT INTO grid_state (key, state, updated_at) VALUES ($1, $2::jsonb, CURRENT_TIMESTAMP)
       ON CONFLICT (key) DO UPDATE SET state = EXCLUDED.state, updated_at = CURRENT_TIMESTAMP`,
      [key, json]
    )
  }
}

export class NoGridStateStore implements GridStateStore {
  readonly kind = 'off' as const
  async load(): Promise<string | null> {
    return null
  }
  async save(): Promise<void> {}
}

/** Choose the store from the environment (see the header comment). */
export function createGridStateStore(db: QueryRunner): GridStateStore {
  const configured = (process.env.GRID_STATE_STORE || '').trim().toLowerCase()
  const hasDatabase = Boolean(
    process.env.DATABASE_URL || process.env.POSTGRES_URL || process.env.DATABASE_URL_NONPOOLING
  )

  if (configured === 'off') return new NoGridStateStore()
  if (configured === 'file') return new FileGridStateStore()
  if (configured === 'db' || (configured === '' && hasDatabase)) return new DbGridStateStore(db)
  return new FileGridStateStore()
}
