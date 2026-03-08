import { expect, test, describe, beforeEach, afterEach } from 'bun:test'
import { StateMachine } from '../../src/core/state-machine.ts'
import { EventBus } from '../../src/core/event-bus.ts'
import { StateStore } from '../../src/workspace/state-store.ts'
import { HistoryLog } from '../../src/workspace/history-log.ts'
import { WorkspaceManager } from '../../src/workspace/workspace-manager.ts'
import { PipelinePhase } from '../../src/core/types.ts'
import type { ProjectState } from '../../src/core/types.ts'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

function createTestState(phase: PipelinePhase = PipelinePhase.IDEA): ProjectState {
  return {
    project: 'test-project',
    description: 'Test project',
    current_phase: phase,
    phases_completed: [],
    tasks_total: 0,
    tasks_completed: 0,
    tasks_pending: 0,
    started_at: new Date().toISOString(),
    last_updated: new Date().toISOString(),
    last_transition: null,
    workspace_path: '/tmp/test',
    llm_source: null,
  }
}

describe('StateMachine', () => {
  let tmpDir: string
  let workspace: WorkspaceManager
  let stateStore: StateStore
  let eventBus: EventBus
  let history: HistoryLog
  let sm: StateMachine

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), 'coreops-test-'))
    workspace = new WorkspaceManager(tmpDir)
    workspace.init()
    stateStore = new StateStore(workspace)
    eventBus = new EventBus()
    history = new HistoryLog(workspace)
    sm = new StateMachine(stateStore, eventBus, history)

    // Inicializar estado
    stateStore.write(createTestState(PipelinePhase.IDEA))
  })

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true })
  })

  test('deve retornar fase atual corretamente', () => {
    expect(sm.getCurrentPhase()).toBe(PipelinePhase.IDEA)
  })

  test('deve permitir transição válida IDEA → BRAINSTORM', async () => {
    const result = await sm.transition(PipelinePhase.BRAINSTORM)
    expect(result.current_phase).toBe(PipelinePhase.BRAINSTORM)
  })

  test('deve bloquear transição inválida IDEA → CODING', async () => {
    expect(async () => {
      await sm.transition(PipelinePhase.CODING)
    }).toThrow()
  })

  test('deve bloquear transição IDEA → REVIEW', async () => {
    expect(async () => {
      await sm.transition(PipelinePhase.REVIEW)
    }).toThrow()
  })

  test('deve avançar sequencialmente pelo pipeline', async () => {
    await sm.transition(PipelinePhase.BRAINSTORM)
    await sm.transition(PipelinePhase.PLANNING)
    await sm.transition(PipelinePhase.ARCHITECTURE)

    expect(sm.getCurrentPhase()).toBe(PipelinePhase.ARCHITECTURE)
  })

  test('deve retornar próxima fase corretamente', () => {
    const next = sm.getNextPhase()
    expect(next).toBe(PipelinePhase.BRAINSTORM)
  })

  test('advanceToNext deve avançar para próxima fase automaticamente', async () => {
    await sm.advanceToNext()
    expect(sm.getCurrentPhase()).toBe(PipelinePhase.BRAINSTORM)
  })

  test('deve emitir evento de transição de estado', async () => {
    const events: string[] = []
    eventBus.on('state_transition', (e) => {
      events.push(`${e.payload['from']}→${e.payload['to']}`)
    })

    await sm.transition(PipelinePhase.BRAINSTORM)

    expect(events).toContain('IDEA→BRAINSTORM')
  })

  test('deve emitir evento de rollback', async () => {
    // Avançar para PLANNING
    stateStore.write(createTestState(PipelinePhase.PLANNING))

    const rollbacks: string[] = []
    eventBus.on('rollback_triggered', (e) => {
      rollbacks.push(`${e.payload['from']}→${e.payload['to']}`)
    })

    await sm.transition(PipelinePhase.BRAINSTORM) // rollback

    expect(rollbacks).toContain('PLANNING→BRAINSTORM')
  })

  test('getPipelineStatus deve retornar estado completo', async () => {
    await sm.transition(PipelinePhase.BRAINSTORM)

    const status = sm.getPipelineStatus()
    expect(status.current).toBe(PipelinePhase.BRAINSTORM)
    expect(status.completed).toContain(PipelinePhase.IDEA)
    expect(status.pending).toContain(PipelinePhase.PLANNING)
    expect(status.next).toBe(PipelinePhase.PLANNING)
  })

  test('estado DONE não deve ter próxima fase', () => {
    stateStore.write(createTestState(PipelinePhase.DONE))
    expect(sm.getNextPhase()).toBeNull()
  })

  test('canTransitionTo deve retornar true para transição válida', () => {
    expect(sm.canTransitionTo(PipelinePhase.BRAINSTORM)).toBe(true)
  })

  test('canTransitionTo deve retornar false para transição inválida', () => {
    expect(sm.canTransitionTo(PipelinePhase.CODING)).toBe(false)
  })
})
