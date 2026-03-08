// ============================================================
// CoreOps — Event Store
// Armazena eventos estruturados em SQLite para debug e timeline
// Arquivo: .coreops/debug/events.db
// ============================================================

import { Database } from 'bun:sqlite'
import { existsSync, mkdirSync } from 'node:fs'
import { join, dirname } from 'node:path'

export type EventStatus = 'ok' | 'error' | 'timeout' | 'pending'

export interface DebugEvent {
  id: number
  type: string
  phase: string | null
  ref_id: string | null
  timestamp: number
  duration_ms: number | null
  status: EventStatus | null
  payload: Record<string, unknown>
}

interface EventRow {
  id: number
  type: string
  phase: string | null
  ref_id: string | null
  timestamp: number
  duration_ms: number | null
  status: string | null
  payload: string
}

export class EventStore {
  private readonly db: Database

  constructor(dbPath: string) {
    const dir = dirname(dbPath)
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true })

    this.db = new Database(dbPath)
    this.db.exec('PRAGMA journal_mode=WAL')
    this.migrate()
  }

  private migrate(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        type TEXT NOT NULL,
        phase TEXT,
        ref_id TEXT,
        timestamp INTEGER NOT NULL,
        duration_ms INTEGER,
        status TEXT,
        payload TEXT NOT NULL DEFAULT '{}'
      );
      CREATE INDEX IF NOT EXISTS idx_events_type ON events(type);
      CREATE INDEX IF NOT EXISTS idx_events_phase ON events(phase);
      CREATE INDEX IF NOT EXISTS idx_events_timestamp ON events(timestamp);
    `)
  }

  record(
    type: string,
    opts: {
      phase?: string
      ref_id?: string
      duration_ms?: number
      status?: EventStatus
      payload?: Record<string, unknown>
    } = {},
  ): number {
    const result = this.db
      .prepare(
        `INSERT INTO events (type, phase, ref_id, timestamp, duration_ms, status, payload)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        type,
        opts.phase ?? null,
        opts.ref_id ?? null,
        Date.now(),
        opts.duration_ms ?? null,
        opts.status ?? null,
        JSON.stringify(opts.payload ?? {}),
      )
    return result.lastInsertRowid as number
  }

  list(limit = 200, phase?: string): DebugEvent[] {
    const rows = phase
      ? (this.db
          .prepare(
            `SELECT * FROM events WHERE phase = ? ORDER BY timestamp DESC LIMIT ?`,
          )
          .all(phase, limit) as EventRow[])
      : (this.db
          .prepare(`SELECT * FROM events ORDER BY timestamp DESC LIMIT ?`)
          .all(limit) as EventRow[])

    return rows.map(toEvent).reverse()
  }

  getByRef(ref_id: string): DebugEvent[] {
    const rows = this.db
      .prepare(`SELECT * FROM events WHERE ref_id = ? ORDER BY timestamp ASC`)
      .all(ref_id) as EventRow[]
    return rows.map(toEvent)
  }

  /** Constrói timeline agrupada por fase */
  getTimeline(): PhaseTimeline[] {
    const rows = this.db
      .prepare(`SELECT * FROM events ORDER BY timestamp ASC`)
      .all() as EventRow[]

    const events = rows.map(toEvent)
    return buildTimeline(events)
  }

  count(): number {
    const row = this.db.prepare(`SELECT COUNT(*) as n FROM events`).get() as { n: number }
    return row.n
  }

  close(): void {
    this.db.close()
  }
}

// ----------------------------------------------------------
// Timeline builder
// ----------------------------------------------------------

export interface PhaseTimeline {
  phase: string
  started_at: number
  ended_at: number | null
  duration_ms: number | null
  agents: Array<{ name: string; status: EventStatus | null; duration_ms: number | null }>
  microtasks: Array<{ id: string; description: string; status: EventStatus | null }>
  errors: string[]
}

function buildTimeline(events: DebugEvent[]): PhaseTimeline[] {
  const phases: Map<string, PhaseTimeline> = new Map()
  let currentPhase = 'IDEA'

  for (const e of events) {
    const phase = e.phase ?? currentPhase

    if (!phases.has(phase)) {
      phases.set(phase, {
        phase,
        started_at: e.timestamp,
        ended_at: null,
        duration_ms: null,
        agents: [],
        microtasks: [],
        errors: [],
      })
    }

    const pt = phases.get(phase)!

    if (e.type === 'phase_started') {
      pt.started_at = e.timestamp
      currentPhase = phase
    }

    if (e.type === 'phase_completed') {
      pt.ended_at = e.timestamp
      pt.duration_ms = e.timestamp - pt.started_at
    }

    if (e.type === 'agent_completed' || e.type === 'agent_failed') {
      const name = (e.payload['agent'] as string) ?? e.ref_id ?? 'unknown'
      pt.agents.push({ name, status: e.status, duration_ms: e.duration_ms })
    }

    if (e.type === 'microtask_completed' || e.type === 'microtask_failed') {
      const id = (e.payload['id'] as string) ?? e.ref_id ?? '?'
      const desc = (e.payload['description'] as string) ?? ''
      pt.microtasks.push({ id, description: desc, status: e.status })
    }

    if (e.status === 'error' || e.type === 'error_occurred') {
      const msg = (e.payload['message'] as string) ?? e.type
      pt.errors.push(msg)
    }
  }

  return Array.from(phases.values())
}

function toEvent(row: EventRow): DebugEvent {
  return {
    id: row.id,
    type: row.type,
    phase: row.phase,
    ref_id: row.ref_id,
    timestamp: row.timestamp,
    duration_ms: row.duration_ms,
    status: row.status as EventStatus | null,
    payload: JSON.parse(row.payload) as Record<string, unknown>,
  }
}

// ----------------------------------------------------------
// Factory helper — cria EventStore no path padrão do projeto
// ----------------------------------------------------------

export function createProjectEventStore(cwd: string = process.cwd()): EventStore {
  return new EventStore(join(cwd, '.coreops', 'debug', 'events.db'))
}
