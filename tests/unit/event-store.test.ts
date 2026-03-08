// ============================================================
// CoreOps — EventStore Unit Tests
// ============================================================

import { describe, test, expect, beforeEach, afterEach } from 'bun:test'
import { EventStore } from '../../src/debug/event-store.ts'

let store: EventStore

beforeEach(() => {
  store = new EventStore(':memory:')
})

afterEach(() => {
  store.close()
})

describe('EventStore — basic operations', () => {
  test('record() armazena evento e retorna id numérico', () => {
    const id = store.record('phase_started', { phase: 'PLANNING', status: 'ok' })
    expect(typeof id).toBe('number')
    expect(id).toBeGreaterThan(0)
  })

  test('list() retorna eventos em ordem cronológica', () => {
    store.record('phase_started', { phase: 'PLANNING' })
    store.record('agent_completed', { ref_id: 'planner', status: 'ok' })
    store.record('phase_completed', { phase: 'PLANNING', status: 'ok' })

    const events = store.list()
    expect(events.length).toBe(3)
    expect(events[0]!.type).toBe('phase_started')
    expect(events[2]!.type).toBe('phase_completed')
  })

  test('list() filtra por fase', () => {
    store.record('phase_started', { phase: 'PLANNING' })
    store.record('agent_completed', { phase: 'CODING', ref_id: 'coder', status: 'ok' })

    const planning = store.list(100, 'PLANNING')
    expect(planning.length).toBe(1)
    expect(planning[0]!.phase).toBe('PLANNING')
  })

  test('getByRef() retorna eventos do ref_id', () => {
    store.record('agent_completed', { ref_id: 'planner', status: 'ok', duration_ms: 500 })
    store.record('agent_failed', { ref_id: 'coder', status: 'error' })
    store.record('agent_completed', { ref_id: 'planner', status: 'ok', duration_ms: 300 })

    const plannerEvents = store.getByRef('planner')
    expect(plannerEvents.length).toBe(2)
    expect(plannerEvents.every((e) => e.ref_id === 'planner')).toBe(true)
  })

  test('count() retorna total de eventos', () => {
    expect(store.count()).toBe(0)
    store.record('phase_started', { phase: 'PLANNING' })
    store.record('phase_started', { phase: 'CODING' })
    expect(store.count()).toBe(2)
  })

  test('payload é serializado/deserializado corretamente', () => {
    store.record('planning_completed', {
      payload: { task_count: 5, objective: 'Criar API REST' },
      status: 'ok',
    })

    const events = store.list()
    expect(events[0]!.payload['task_count']).toBe(5)
    expect(events[0]!.payload['objective']).toBe('Criar API REST')
  })

  test('duration_ms é armazenado', () => {
    store.record('agent_completed', { ref_id: 'coder', duration_ms: 1234, status: 'ok' })
    const events = store.list()
    expect(events[0]!.duration_ms).toBe(1234)
  })
})

describe('EventStore — timeline', () => {
  beforeEach(() => {
    store.record('project_started', { phase: 'IDEA', status: 'ok', payload: { project: 'test' } })
    store.record('phase_started', { phase: 'PLANNING' })
    store.record('agent_completed', { phase: 'PLANNING', ref_id: 'planner', status: 'ok', duration_ms: 800, payload: { agent: 'planner' } })
    store.record('phase_completed', { phase: 'PLANNING', status: 'ok' })
    store.record('phase_started', { phase: 'CODING' })
    store.record('microtask_completed', { phase: 'CODING', ref_id: 'abc123', status: 'ok', payload: { id: 'abc123', description: 'Criar arquivo principal' } })
    store.record('phase_completed', { phase: 'CODING', status: 'ok' })
  })

  test('getTimeline() retorna fases distintas', () => {
    const timeline = store.getTimeline()
    const phases = timeline.map((t) => t.phase)
    expect(phases).toContain('PLANNING')
    expect(phases).toContain('CODING')
  })

  test('getTimeline() registra agentes na fase correta', () => {
    const timeline = store.getTimeline()
    const planning = timeline.find((t) => t.phase === 'PLANNING')
    expect(planning).toBeDefined()
    expect(planning!.agents.length).toBeGreaterThanOrEqual(1)
    expect(planning!.agents[0]!.name).toBe('planner')
  })

  test('getTimeline() registra microtasks', () => {
    const timeline = store.getTimeline()
    const coding = timeline.find((t) => t.phase === 'CODING')
    expect(coding).toBeDefined()
    expect(coding!.microtasks.length).toBe(1)
    expect(coding!.microtasks[0]!.id).toBe('abc123')
  })
})
