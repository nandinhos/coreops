// ============================================================
// CoreOps — Metrics Unit Tests
// ============================================================

import { describe, test, expect, beforeEach, afterEach } from 'bun:test'
import { EventStore } from '../../src/debug/event-store.ts'
import { computeMetrics } from '../../src/observability/metrics.ts'

let store: EventStore

beforeEach(() => {
  store = new EventStore(':memory:')
})

afterEach(() => {
  store.close()
})

function buildTestEvents(): void {
  store.record('project_started', { phase: 'IDEA', status: 'ok', payload: { project: 'test-proj' } })
  store.record('phase_started', { phase: 'PLANNING' })
  store.record('agent_completed', { phase: 'PLANNING', ref_id: 'planner', status: 'ok', duration_ms: 800, payload: { agent: 'planner' } })
  store.record('planning_completed', { phase: 'PLANNING', status: 'ok', duration_ms: 900, payload: { task_count: 3 } })
  store.record('phase_completed', { phase: 'PLANNING', status: 'ok' })
  store.record('phase_started', { phase: 'CODING' })
  store.record('agent_completed', { phase: 'CODING', ref_id: 'coder', status: 'ok', duration_ms: 1200, payload: { agent: 'coder' } })
  store.record('agent_completed', { phase: 'CODING', ref_id: 'reviewer', status: 'ok', duration_ms: 400, payload: { agent: 'reviewer' } })
  store.record('microtask_completed', { phase: 'CODING', ref_id: 'mt1', status: 'ok', payload: { id: 'mt1', description: 'Criar model' } })
  store.record('agent_failed', { phase: 'CODING', ref_id: 'coder', status: 'error', payload: { agent: 'coder' } })
  store.record('microtask_failed', { phase: 'CODING', ref_id: 'mt2', status: 'error', payload: { id: 'mt2', description: 'Criar auth' } })
  store.record('phase_completed', { phase: 'CODING', status: 'ok' })
}

describe('computeMetrics()', () => {
  test('retorna projeto correto', () => {
    buildTestEvents()
    const events = store.list(1000)
    const m = computeMetrics(events, 'test-proj')
    expect(m.project).toBe('test-proj')
  })

  test('calcula total de eventos', () => {
    buildTestEvents()
    const events = store.list(1000)
    const m = computeMetrics(events, 'proj')
    expect(m.events_total).toBe(events.length)
  })

  test('identifica fases corretamente', () => {
    buildTestEvents()
    const events = store.list(1000)
    const m = computeMetrics(events, 'proj')
    const phases = m.phases.map((p) => p.phase)
    expect(phases).toContain('PLANNING')
    expect(phases).toContain('CODING')
  })

  test('PLANNING marcada como completed', () => {
    buildTestEvents()
    const events = store.list(1000)
    const m = computeMetrics(events, 'proj')
    const planning = m.phases.find((p) => p.phase === 'PLANNING')
    expect(planning?.status).toBe('completed')
    expect(planning?.duration_ms).not.toBeNull()
  })

  test('métricas de agentes corretas', () => {
    buildTestEvents()
    const events = store.list(1000)
    const m = computeMetrics(events, 'proj')

    const coder = m.agents.find((a) => a.name === 'coder')
    expect(coder).toBeDefined()
    expect(coder!.executions).toBe(2)
    expect(coder!.successes).toBe(1)
    expect(coder!.failures).toBe(1)
    expect(coder!.avg_duration_ms).toBe(1200) // só agent_completed tem duration_ms; agent_failed não tem
  })

  test('microtask success_rate calculado', () => {
    buildTestEvents()
    const events = store.list(1000)
    const m = computeMetrics(events, 'proj')
    expect(m.microtasks.total).toBe(2)
    expect(m.microtasks.completed).toBe(1)
    expect(m.microtasks.failed).toBe(1)
    expect(m.microtasks.success_rate).toBe(50)
  })

  test('retorna zeros para projeto sem eventos', () => {
    const m = computeMetrics([], 'vazio')
    expect(m.events_total).toBe(0)
    expect(m.microtasks.total).toBe(0)
    expect(m.phases.length).toBe(0)
    expect(m.agents.length).toBe(0)
    expect(m.errors).toBe(0)
  })

  test('conta erros corretamente', () => {
    store.record('error_occurred', { status: 'error', payload: { message: 'algo deu errado' } })
    store.record('microtask_failed', { status: 'error', payload: { id: 'x' } })
    const events = store.list(1000)
    const m = computeMetrics(events, 'proj')
    expect(m.errors).toBeGreaterThanOrEqual(1)
  })
})
