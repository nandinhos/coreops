// ============================================================
// CoreOps — LLM Response Cache
// Cache SQLite para respostas do LLM — evita chamadas repetidas
// Armazenado em ~/.coreops/llm-cache.db (global)
// ============================================================

import { Database } from 'bun:sqlite'
import { createHash } from 'node:crypto'
import { homedir } from 'node:os'
import { join, dirname } from 'node:path'
import { existsSync, mkdirSync } from 'node:fs'
import type { LLMAdapter, LLMRequest, LLMResponse } from './types.ts'

export const CACHE_DB_PATH = join(homedir(), '.coreops', 'llm-cache.db')
export const DEFAULT_TTL_MS = 7 * 24 * 60 * 60 * 1000 // 7 dias

interface CacheRow {
  content: string
  created_at: number
  hits: number
}

export interface CacheStats {
  total: number
  valid: number
  expired: number
  hit_rate?: number
}

export class ResponseCache {
  private readonly db: Database
  private hits = 0
  private misses = 0

  constructor(dbPath: string = CACHE_DB_PATH) {
    const dir = dirname(dbPath)
    if (dbPath !== ':memory:' && !existsSync(dir)) {
      mkdirSync(dir, { recursive: true })
    }

    this.db = new Database(dbPath)
    this.db.exec('PRAGMA journal_mode=WAL')
    this.migrate()
  }

  private migrate(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS cache (
        key TEXT PRIMARY KEY,
        content TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        expires_at INTEGER NOT NULL,
        hits INTEGER NOT NULL DEFAULT 0
      );
      CREATE INDEX IF NOT EXISTS idx_cache_expires ON cache(expires_at);
    `)
  }

  get(key: string): string | null {
    const row = this.db
      .prepare(`SELECT content, created_at, hits FROM cache WHERE key = ? AND expires_at > ?`)
      .get(key, Date.now()) as CacheRow | null

    if (!row) {
      this.misses++
      return null
    }

    this.hits++
    this.db.prepare(`UPDATE cache SET hits = hits + 1 WHERE key = ?`).run(key)
    return row.content
  }

  set(key: string, content: string, ttl_ms = DEFAULT_TTL_MS): void {
    const now = Date.now()
    this.db
      .prepare(
        `INSERT OR REPLACE INTO cache (key, content, created_at, expires_at, hits)
         VALUES (?, ?, ?, ?, 0)`,
      )
      .run(key, content, now, now + ttl_ms)
  }

  /** SHA256 do sistema + mensagens — usado como chave de cache */
  static hashRequest(system: string | undefined, messages: LLMRequest['messages']): string {
    const payload = JSON.stringify({ system: system ?? '', messages })
    return createHash('sha256').update(payload).digest('hex')
  }

  purgeExpired(): number {
    const result = this.db.prepare(`DELETE FROM cache WHERE expires_at <= ?`).run(Date.now())
    return result.changes
  }

  stats(): CacheStats {
    const total = (this.db.prepare(`SELECT COUNT(*) as n FROM cache`).get() as { n: number }).n
    const valid = (
      this.db.prepare(`SELECT COUNT(*) as n FROM cache WHERE expires_at > ?`).get(Date.now()) as { n: number }
    ).n
    const total_requests = this.hits + this.misses
    return {
      total,
      valid,
      expired: total - valid,
      hit_rate: total_requests > 0 ? Math.round((this.hits / total_requests) * 100) : undefined,
    }
  }

  close(): void {
    this.db.close()
  }
}

// ----------------------------------------------------------
// Decorator: envolve qualquer LLMAdapter com cache
// ----------------------------------------------------------

export class CachedLLMAdapter implements LLMAdapter {
  constructor(
    private readonly inner: LLMAdapter,
    private readonly cache: ResponseCache,
  ) {}

  async complete(request: LLMRequest): Promise<LLMResponse> {
    const key = ResponseCache.hashRequest(request.system, request.messages)
    const cached = this.cache.get(key)

    if (cached !== null) {
      return {
        content: cached,
        model: 'cache-hit',
        input_tokens: 0,
        output_tokens: 0,
      }
    }

    const response = await this.inner.complete(request)
    this.cache.set(key, response.content)
    return response
  }
}
