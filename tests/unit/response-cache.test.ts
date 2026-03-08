// ============================================================
// CoreOps — ResponseCache Unit Tests (Phase 9)
// ============================================================

import { describe, test, expect } from 'bun:test'
import { ResponseCache, CachedLLMAdapter, DEFAULT_TTL_MS } from '../../src/llm/response-cache.ts'
import type { LLMAdapter, LLMResponse } from '../../src/llm/types.ts'

function mockLLM(content = 'resposta mock'): LLMAdapter & { callCount: number } {
  let count = 0
  return {
    get callCount() {
      return count
    },
    complete: async (): Promise<LLMResponse> => {
      count++
      return { content, model: 'mock', input_tokens: 5, output_tokens: 5 }
    },
  }
}

// ----------------------------------------------------------
// ResponseCache
// ----------------------------------------------------------

describe('ResponseCache', () => {
  test('miss retorna null para chave inexistente', () => {
    const cache = new ResponseCache(':memory:')
    expect(cache.get('chave-inexistente')).toBeNull()
    cache.close()
  })

  test('set/get armazena e recupera conteúdo', () => {
    const cache = new ResponseCache(':memory:')
    cache.set('k1', 'valor1')
    expect(cache.get('k1')).toBe('valor1')
    cache.close()
  })

  test('get retorna null após TTL expirar', async () => {
    const cache = new ResponseCache(':memory:')
    cache.set('k2', 'expira', 1) // 1ms de TTL
    await new Promise((r) => setTimeout(r, 20))
    expect(cache.get('k2')).toBeNull()
    cache.close()
  })

  test('INSERT OR REPLACE sobrescreve chave existente', () => {
    const cache = new ResponseCache(':memory:')
    cache.set('k3', 'original')
    cache.set('k3', 'atualizado')
    expect(cache.get('k3')).toBe('atualizado')
    cache.close()
  })

  test('stats retorna contagens corretas e hit_rate', () => {
    const cache = new ResponseCache(':memory:')
    cache.set('a', '1')
    cache.set('b', '2')
    cache.get('a') // hit
    cache.get('z') // miss
    const s = cache.stats()
    expect(s.total).toBe(2)
    expect(s.valid).toBe(2)
    expect(s.expired).toBe(0)
    expect(s.hit_rate).toBe(50) // 1 hit de 2 requests
    cache.close()
  })

  test('stats sem requests não define hit_rate', () => {
    const cache = new ResponseCache(':memory:')
    const s = cache.stats()
    expect(s.hit_rate).toBeUndefined()
    cache.close()
  })

  test('purgeExpired remove apenas entradas expiradas', async () => {
    const cache = new ResponseCache(':memory:')
    cache.set('fresh', 'ok', DEFAULT_TTL_MS)
    cache.set('stale', 'bye', 1) // expira em 1ms
    await new Promise((r) => setTimeout(r, 20))
    const removed = cache.purgeExpired()
    expect(removed).toBe(1)
    expect(cache.get('fresh')).toBe('ok')
    expect(cache.stats().expired).toBe(0)
    cache.close()
  })

  test('hashRequest é determinístico para os mesmos inputs', () => {
    const msgs = [{ role: 'user' as const, content: 'oi' }]
    const h1 = ResponseCache.hashRequest('system', msgs)
    const h2 = ResponseCache.hashRequest('system', msgs)
    expect(h1).toBe(h2)
    expect(h1).toHaveLength(64) // SHA256 hex = 64 chars
  })

  test('hashRequest varia com system diferente', () => {
    const msgs = [{ role: 'user' as const, content: 'oi' }]
    expect(ResponseCache.hashRequest('sys1', msgs)).not.toBe(ResponseCache.hashRequest('sys2', msgs))
  })

  test('hashRequest varia com mensagens diferentes', () => {
    const h1 = ResponseCache.hashRequest(undefined, [{ role: 'user', content: 'a' }])
    const h2 = ResponseCache.hashRequest(undefined, [{ role: 'user', content: 'b' }])
    expect(h1).not.toBe(h2)
  })
})

// ----------------------------------------------------------
// CachedLLMAdapter
// ----------------------------------------------------------

describe('CachedLLMAdapter', () => {
  test('segunda chamada idêntica usa cache e não chama o LLM', async () => {
    const llm = mockLLM()
    const cache = new ResponseCache(':memory:')
    const adapter = new CachedLLMAdapter(llm, cache)
    const req = { messages: [{ role: 'user' as const, content: 'teste' }] }

    await adapter.complete(req)
    await adapter.complete(req)

    expect(llm.callCount).toBe(1)
    cache.close()
  })

  test('cache-hit retorna model=cache-hit e tokens zerados', async () => {
    const llm = mockLLM('resposta')
    const cache = new ResponseCache(':memory:')
    const adapter = new CachedLLMAdapter(llm, cache)
    const req = { messages: [{ role: 'user' as const, content: 'q' }] }

    await adapter.complete(req) // miss — chama LLM
    const hit = await adapter.complete(req) // hit

    expect(hit.model).toBe('cache-hit')
    expect(hit.input_tokens).toBe(0)
    expect(hit.output_tokens).toBe(0)
    expect(hit.content).toBe('resposta')
    cache.close()
  })

  test('requisições diferentes não compartilham cache', async () => {
    const llm = mockLLM()
    const cache = new ResponseCache(':memory:')
    const adapter = new CachedLLMAdapter(llm, cache)

    await adapter.complete({ messages: [{ role: 'user' as const, content: 'a' }] })
    await adapter.complete({ messages: [{ role: 'user' as const, content: 'b' }] })

    expect(llm.callCount).toBe(2)
    cache.close()
  })

  test('system prompt faz parte da chave de cache', async () => {
    const llm = mockLLM()
    const cache = new ResponseCache(':memory:')
    const adapter = new CachedLLMAdapter(llm, cache)
    const msgs = [{ role: 'user' as const, content: 'q' }]

    await adapter.complete({ messages: msgs, system: 'sys1' })
    await adapter.complete({ messages: msgs, system: 'sys2' }) // system diferente → cache miss

    expect(llm.callCount).toBe(2)
    cache.close()
  })
})
