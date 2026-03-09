// ============================================================
// CoreOps — ErrorStore
// Memória estruturada de erros → soluções com FTS5
// Permite ao Debugger consultar soluções anteriores antes de inferir
// ============================================================

import { Database } from 'bun:sqlite'
import { homedir } from 'node:os'
import { mkdirSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { randomUUID } from 'node:crypto'

export interface ErrorRecord {
  id: string
  error_signature: string
  root_cause: string
  fix_description: string
  project: string
  occurrence_count: number
  last_seen_at: number
}

export interface ErrorMatch {
  record: ErrorRecord
  score: number
}

const GLOBAL_DIR = join(homedir(), '.coreops')

export function normalizeError(errorText: string): string {
  return errorText
    .substring(0, 300)
    .replace(/\d+:\d+/g, 'N:N')          // line:col
    .replace(/line \d+/gi, 'line N')      // "line 42"
    .replace(/at line \d+/gi, 'at line N')
    .replace(/\b[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}\b/gi, 'UUID')
    .replace(/\/[^\s"']+\.(ts|js|php|py|go|rs|java)/g, '/FILE.ext')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()
}

export class ErrorStore {
  private db: Database

  constructor(dbPath?: string) {
    const path = dbPath ?? join(GLOBAL_DIR, 'errors.db')

    if (dbPath !== ':memory:' && !existsSync(GLOBAL_DIR)) {
      mkdirSync(GLOBAL_DIR, { recursive: true })
    }

    this.db = new Database(path)
    this.db.exec('PRAGMA journal_mode=WAL;')
    this.initSchema()
  }

  private initSchema(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS error_records (
        id TEXT PRIMARY KEY,
        error_signature TEXT NOT NULL,
        root_cause TEXT NOT NULL,
        fix_description TEXT NOT NULL,
        project TEXT NOT NULL DEFAULT 'global',
        occurrence_count INTEGER NOT NULL DEFAULT 1,
        last_seen_at INTEGER NOT NULL
      );

      CREATE VIRTUAL TABLE IF NOT EXISTS error_fts USING fts5(
        id UNINDEXED,
        error_signature,
        root_cause,
        fix_description,
        content='error_records',
        content_rowid='rowid'
      );

      CREATE TRIGGER IF NOT EXISTS error_records_ai AFTER INSERT ON error_records BEGIN
        INSERT INTO error_fts(rowid, id, error_signature, root_cause, fix_description)
        VALUES (new.rowid, new.id, new.error_signature, new.root_cause, new.fix_description);
      END;

      CREATE TRIGGER IF NOT EXISTS error_records_ad AFTER DELETE ON error_records BEGIN
        INSERT INTO error_fts(error_fts, rowid, id, error_signature, root_cause, fix_description)
        VALUES ('delete', old.rowid, old.id, old.error_signature, old.root_cause, old.fix_description);
      END;
    `)
  }

  findSimilar(errorText: string, limit: number = 3): ErrorRecord[] {
    const signature = normalizeError(errorText)
    if (!signature) return []

    // Extrair palavras-chave para FTS5 (sem stopwords)
    const STOP_WORDS = new Set(['error', 'at', 'in', 'the', 'a', 'is', 'was', 'to', 'of', 'and'])
    const keywords = signature
      .split(/\s+/)
      .filter(w => w.length > 3 && !STOP_WORDS.has(w))
      .slice(0, 8)
      .map(w => w.replace(/[^a-z0-9]/g, ''))
      .filter(Boolean)

    if (keywords.length === 0) return []

    const ftsQuery = keywords.join(' OR ')

    try {
      const rows = this.db.query(`
        SELECT er.*
        FROM error_records er
        JOIN error_fts ef ON er.id = ef.id
        WHERE error_fts MATCH ?
        ORDER BY er.occurrence_count DESC, er.last_seen_at DESC
        LIMIT ?
      `).all(ftsQuery, limit) as ErrorRecord[]

      return rows
    } catch {
      return []
    }
  }

  record(errorText: string, rootCause: string, fixDescription: string, project: string = 'global'): ErrorRecord {
    const signature = normalizeError(errorText)
    const existing = this.findExact(signature)

    if (existing) {
      this.bumpOccurrence(existing.id)
      return { ...existing, occurrence_count: existing.occurrence_count + 1 }
    }

    const record: ErrorRecord = {
      id: randomUUID().substring(0, 8),
      error_signature: signature,
      root_cause: rootCause,
      fix_description: fixDescription,
      project,
      occurrence_count: 1,
      last_seen_at: Date.now(),
    }

    this.db.query(`
      INSERT INTO error_records (id, error_signature, root_cause, fix_description, project, occurrence_count, last_seen_at)
      VALUES (?, ?, ?, ?, ?, 1, ?)
    `).run(record.id, record.error_signature, record.root_cause, record.fix_description, record.project, record.last_seen_at)

    return record
  }

  bumpOccurrence(id: string): void {
    this.db.query(`
      UPDATE error_records
      SET occurrence_count = occurrence_count + 1, last_seen_at = ?
      WHERE id = ?
    `).run(Date.now(), id)
  }

  private findExact(signature: string): ErrorRecord | null {
    const row = this.db.query(`
      SELECT * FROM error_records WHERE error_signature = ? LIMIT 1
    `).get(signature) as ErrorRecord | null

    return row
  }

  getById(id: string): ErrorRecord | null {
    return this.db.query('SELECT * FROM error_records WHERE id = ?').get(id) as ErrorRecord | null
  }

  list(limit: number = 20): ErrorRecord[] {
    return this.db.query(`
      SELECT * FROM error_records ORDER BY last_seen_at DESC LIMIT ?
    `).all(limit) as ErrorRecord[]
  }

  close(): void {
    this.db.close()
  }
}
