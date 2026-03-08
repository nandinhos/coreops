// ============================================================
// CoreOps — API Server Unit Tests (Phase 10)
// Testa endpoints REST sem chamar o LLM real
// ============================================================

import { describe, test, expect, beforeAll, afterAll } from 'bun:test'
import { createApiServer } from '../../src/server/api-server.ts'
import { Orchestrator } from '../../src/core/orchestrator.ts'
import { loadConfig } from '../../src/core/types.ts'

let server: ReturnType<typeof createApiServer>
let baseUrl: string

beforeAll(async () => {
  // Usa diretório temp para não poluir o workspace atual
  const tmpDir = '/tmp/coreops-api-test-' + Date.now()
  const { mkdirSync } = await import('node:fs')
  mkdirSync(tmpDir, { recursive: true })

  const origCwd = process.cwd
  process.cwd = () => tmpDir

  const config = loadConfig()
  const orchestrator = new Orchestrator(config)

  // Inicia um projeto de teste no workspace temp
  await orchestrator.startProject('test-project', 'Projeto de teste para API')

  server = createApiServer(orchestrator, { port: 0 }) // porta 0 = ephemeral
  baseUrl = `http://localhost:${server.port}`

  process.cwd = origCwd
})

afterAll(() => {
  server.stop()
})

async function get(path: string) {
  const res = await fetch(baseUrl + path)
  const body = (await res.json()) as Record<string, unknown>
  return { status: res.status, body }
}

async function post(path: string, data?: unknown) {
  const res = await fetch(baseUrl + path, {
    method: 'POST',
    headers: data ? { 'Content-Type': 'application/json' } : {},
    body: data ? JSON.stringify(data) : undefined,
  })
  const body = (await res.json()) as Record<string, unknown>
  return { status: res.status, body }
}

describe('GET /', () => {
  test('retorna informações da API', async () => {
    const { status, body } = await get('/')
    expect(status).toBe(200)
    expect(body.name).toBe('CoreOps API')
    expect(Array.isArray(body.endpoints)).toBe(true)
    expect((body.endpoints as unknown[]).length).toBeGreaterThan(0)
  })
})

describe('GET /status', () => {
  test('retorna status do projeto inicializado', async () => {
    const { status, body } = await get('/status')
    expect(status).toBe(200)
    expect(body.initialized).toBe(true)
    expect(body.project).toBe('test-project')
    expect(typeof body.current_phase).toBe('string')
  })
})

describe('GET /backlog', () => {
  test('retorna listas de tasks e microtasks', async () => {
    const { status, body } = await get('/backlog')
    expect(status).toBe(200)
    expect(Array.isArray(body.tasks)).toBe(true)
    expect(Array.isArray(body.microtasks)).toBe(true)
    expect(typeof body.total_tasks).toBe('number')
  })
})

describe('GET /metrics', () => {
  test('retorna objeto de métricas', async () => {
    const { status, body } = await get('/metrics')
    expect(status).toBe(200)
    expect(typeof body.events_total).toBe('number')
    expect(Array.isArray(body.phases)).toBe(true)
    expect(Array.isArray(body.agents)).toBe(true)
  })
})

describe('GET /memory', () => {
  test('retorna lista de memórias', async () => {
    const { status, body } = await get('/memory')
    expect(status).toBe(200)
    expect(Array.isArray(body.results)).toBe(true)
    expect(typeof body.count).toBe('number')
  })

  test('aceita query ?q= para busca', async () => {
    const { status, body } = await get('/memory?q=teste')
    expect(status).toBe(200)
    expect(Array.isArray(body.results)).toBe(true)
  })
})

describe('GET /events', () => {
  test('retorna eventos recentes', async () => {
    const { status, body } = await get('/events')
    expect(status).toBe(200)
    expect(Array.isArray(body.events)).toBe(true)
    expect((body.events as unknown[]).length).toBeGreaterThan(0) // project_started emitido no beforeAll
  })

  test('respeita ?limit=', async () => {
    const { body } = await get('/events?limit=1')
    expect((body.events as unknown[]).length).toBeLessThanOrEqual(1)
  })
})

describe('GET /timeline', () => {
  test('retorna timeline de fases', async () => {
    const { status, body } = await get('/timeline')
    expect(status).toBe(200)
    expect(Array.isArray(body.timeline)).toBe(true)
    expect(typeof body.phases).toBe('number')
  })
})

describe('GET /404', () => {
  test('retorna 404 para endpoint desconhecido', async () => {
    const { status } = await get('/endpoint-inexistente')
    expect(status).toBe(404)
  })
})

describe('POST /start', () => {
  test('retorna 400 sem campos obrigatórios', async () => {
    const { status } = await post('/start', { name: 'só nome' })
    expect(status).toBe(400)
  })
})

describe('OPTIONS (CORS)', () => {
  test('responde 204 com headers CORS', async () => {
    const res = await fetch(baseUrl + '/', { method: 'OPTIONS' })
    expect(res.status).toBe(204)
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe('*')
  })
})
