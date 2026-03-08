import { expect, test, describe, beforeEach } from 'bun:test'
import { EventBus } from '../../src/core/event-bus.ts'
import type { SystemEvent } from '../../src/core/types.ts'

describe('EventBus', () => {
  let bus: EventBus

  beforeEach(() => {
    bus = new EventBus()
  })

  test('deve emitir evento e notificar handler registrado', async () => {
    const received: SystemEvent[] = []

    bus.on('project_started', (e) => { received.push(e) })
    await bus.emit('project_started', { project: 'test' })

    expect(received).toHaveLength(1)
    expect(received[0]!.type).toBe('project_started')
    expect(received[0]!.payload['project']).toBe('test')
  })

  test('deve notificar múltiplos handlers do mesmo evento', async () => {
    let count = 0
    bus.on('agent_spawned', () => { count++ })
    bus.on('agent_spawned', () => { count++ })
    bus.on('agent_spawned', () => { count++ })

    await bus.emit('agent_spawned', { agent: 'planner' })

    expect(count).toBe(3)
  })

  test('deve remover handler com off', async () => {
    let count = 0
    const handler = () => { count++ }

    bus.on('task_created', handler)
    await bus.emit('task_created', {})
    expect(count).toBe(1)

    bus.off('task_created', handler)
    await bus.emit('task_created', {})
    expect(count).toBe(1) // não aumentou
  })

  test('evento deve ter id, timestamp e payload', async () => {
    let captured: SystemEvent | undefined

    bus.on('phase_started', (e) => { captured = e })
    await bus.emit('phase_started', { phase: 'PLANNING' })

    expect(captured).toBeDefined()
    expect(captured!.id).toBeString()
    expect(captured!.id.length).toBeGreaterThan(0)
    expect(captured!.timestamp).toBeString()
    expect(captured!.payload['phase']).toBe('PLANNING')
  })

  test('deve registrar histórico de eventos', async () => {
    await bus.emit('project_started', { project: 'p1' })
    await bus.emit('phase_started', { phase: 'IDEA' })
    await bus.emit('agent_spawned', { agent: 'planner' })

    const history = bus.getHistory()
    expect(history).toHaveLength(3)
    expect(history[0]!.type).toBe('project_started')
    expect(history[1]!.type).toBe('phase_started')
    expect(history[2]!.type).toBe('agent_spawned')
  })

  test('clearHistory deve limpar o histórico', async () => {
    await bus.emit('project_started', {})
    expect(bus.getHistory()).toHaveLength(1)

    bus.clearHistory()
    expect(bus.getHistory()).toHaveLength(0)
  })

  test('não deve lançar erro ao emitir evento sem handlers', async () => {
    expect(async () => {
      await bus.emit('error_occurred', { message: 'test error' })
    }).not.toThrow()
  })
})
