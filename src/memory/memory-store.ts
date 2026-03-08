// ============================================================
// CoreOps — Memory Store (SQLite)
// Persiste decisões, padrões e lições entre projetos.
// Banco global em ~/.coreops/memory.db
// ============================================================

import { Database } from 'bun:sqlite'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { mkdirSync, existsSync } from 'node:fs'
import { randomUUID } from 'node:crypto'
import type { Memory, MemoryRow, AddMemoryInput } from './types.ts'

export const GLOBAL_COREOPS_DIR = join(homedir(), '.coreops')
export const MEMORY_DB_PATH = join(GLOBAL_COREOPS_DIR, 'memory.db')

export class MemoryStore {
  private readonly db: Database

  constructor(dbPath: string = MEMORY_DB_PATH) {
    if (dbPath !== ':memory:') {
      const dir = join(dbPath, '..')
      if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
    }

    this.db = new Database(dbPath)
    this.db.exec('PRAGMA journal_mode=WAL')
    this.migrate()
  }

  private migrate(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS memories (
        id TEXT PRIMARY KEY,
        project TEXT NOT NULL,
        phase TEXT NOT NULL DEFAULT 'UNKNOWN',
        type TEXT NOT NULL DEFAULT 'context',
        title TEXT NOT NULL,
        content TEXT NOT NULL,
        tags TEXT NOT NULL DEFAULT '[]',
        created_at INTEGER NOT NULL
      );

      CREATE VIRTUAL TABLE IF NOT EXISTS memories_fts USING fts5(
        id UNINDEXED,
        project,
        phase,
        type UNINDEXED,
        title,
        content,
        tags,
        content='memories',
        content_rowid='rowid'
      );

      CREATE TRIGGER IF NOT EXISTS memories_ai
        AFTER INSERT ON memories BEGIN
          INSERT INTO memories_fts(rowid, id, project, phase, type, title, content, tags)
          VALUES (new.rowid, new.id, new.project, new.phase, new.type, new.title, new.content, new.tags);
        END;

      CREATE TRIGGER IF NOT EXISTS memories_ad
        AFTER DELETE ON memories BEGIN
          INSERT INTO memories_fts(memories_fts, rowid, id, project, phase, type, title, content, tags)
          VALUES ('delete', old.rowid, old.id, old.project, old.phase, old.type, old.title, old.content, old.tags);
        END;
    `)
  }

  add(input: AddMemoryInput): Memory {
    const id = randomUUID().substring(0, 12)
    const now = Date.now()
    const tags = input.tags ?? []
    const tagsJson = JSON.stringify(tags)

    this.db
      .prepare(
        `INSERT INTO memories (id, project, phase, type, title, content, tags, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(id, input.project, input.phase, input.type, input.title, input.content, tagsJson, now)

    return { id, project: input.project, phase: input.phase, type: input.type, title: input.title, content: input.content, tags, created_at: now }
  }

  search(query: string, project?: string): Memory[] {
    const rows = project
      ? this.db
        .prepare(
          `SELECT m.* FROM memories m
             JOIN memories_fts f ON m.rowid = f.rowid
             WHERE memories_fts MATCH '"' || ? || '"' AND m.project = ?
             ORDER BY m.created_at DESC, m.rowid DESC LIMIT 50`,
        )
        .all(query, project) as MemoryRow[]
      : this.db
        .prepare(
          `SELECT m.* FROM memories m
             JOIN memories_fts f ON m.rowid = f.rowid
             WHERE memories_fts MATCH '"' || ? || '"'
             ORDER BY m.created_at DESC, m.rowid DESC LIMIT 50`,
        )
        .all(query) as MemoryRow[]

    return rows.map(toMemory)
  }

  list(project?: string, limit = 50): Memory[] {
    const rows = project
      ? (this.db
        .prepare(
          `SELECT * FROM memories WHERE project = ? ORDER BY created_at DESC, rowid DESC LIMIT ?`,
        )
        .all(project, limit) as MemoryRow[])
      : (this.db
        .prepare(`SELECT * FROM memories ORDER BY created_at DESC, rowid DESC LIMIT ?`)
        .all(limit) as MemoryRow[])

    return rows.map(toMemory)
  }

  getById(id: string): Memory | null {
    const row = this.db
      .prepare(`SELECT * FROM memories WHERE id = ?`)
      .get(id) as MemoryRow | null
    return row ? toMemory(row) : null
  }

  delete(id: string): boolean {
    const result = this.db.prepare(`DELETE FROM memories WHERE id = ?`).run(id)
    return result.changes > 0
  }

  count(project?: string): number {
    const row = project
      ? (this.db
        .prepare(`SELECT COUNT(*) as n FROM memories WHERE project = ?`)
        .get(project) as { n: number })
      : (this.db.prepare(`SELECT COUNT(*) as n FROM memories`).get() as { n: number })
    return row.n
  }

  projects(): string[] {
    const rows = this.db
      .prepare(`SELECT DISTINCT project FROM memories ORDER BY project`)
      .all() as { project: string }[]
    return rows.map((r) => r.project)
  }

  close(): void {
    this.db.close()
  }
}

function toMemory(row: MemoryRow): Memory {
  return {
    id: row.id,
    project: row.project,
    phase: row.phase,
    type: row.type as Memory['type'],
    title: row.title,
    content: row.content,
    tags: JSON.parse(row.tags) as string[],
    created_at: row.created_at,
  }
}
