import { expect, test, describe, beforeEach, afterEach, mock } from 'bun:test'
import { WorkspaceManager } from '../../src/workspace/workspace-manager.ts'
import { StateStore } from '../../src/workspace/state-store.ts'
import { BacklogStore } from '../../src/workspace/backlog-store.ts'
import { HistoryLog } from '../../src/workspace/history-log.ts'
import { EventBus } from '../../src/core/event-bus.ts'
import { StateMachine } from '../../src/core/state-machine.ts'
import { AgentRegistry } from '../../src/agents/agent-registry.ts'
import { AgentRunner } from '../../src/agents/agent-runner.ts'
import { PipelinePhase } from '../../src/core/types.ts'
import type { ProjectState } from '../../src/core/types.ts'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

describe('Pipeline Integration', () => {
  let tmpDir: string
  let workspace: WorkspaceManager
  let stateStore: StateStore
  let backlogStore: BacklogStore
  let eventBus: EventBus
  let history: HistoryLog
  let stateMachine: StateMachine
  let registry: AgentRegistry
  let runner: AgentRunner

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), 'coreops-integration-'))
    workspace = new WorkspaceManager(tmpDir)
    workspace.init()

    stateStore = new StateStore(workspace)
    backlogStore = new BacklogStore(workspace)
    history = new HistoryLog(workspace)
    eventBus = new EventBus()
    stateMachine = new StateMachine(stateStore, eventBus, history)
    registry = new AgentRegistry()
    runner = new AgentRunner(registry, eventBus, history, 5000)

    // Estado inicial
    const initialState: ProjectState = {
      project: 'integration-test',
      description: 'Projeto de teste de integração',
      current_phase: PipelinePhase.IDEA,
      phases_completed: [],
      tasks_total: 0,
      tasks_completed: 0,
      tasks_pending: 0,
      started_at: new Date().toISOString(),
      last_updated: new Date().toISOString(),
      last_transition: null,
      workspace_path: tmpDir,
    }
    stateStore.write(initialState)
  })

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true })
  })

  test('deve inicializar workspace corretamente', () => {
    expect(workspace.isInitialized()).toBe(true)
  })

  test('deve persistir e recuperar estado do projeto', () => {
    const state = stateStore.read()
    expect(state).not.toBeNull()
    expect(state!.project).toBe('integration-test')
    expect(state!.current_phase).toBe(PipelinePhase.IDEA)
  })

  test('deve criar backup ao atualizar estado', () => {
    const { existsSync } = require('node:fs') as typeof import('node:fs')

    stateStore.patch({ tasks_total: 5 })

    const backupPath = workspace.getStatePath().replace('.json', '.bak.json')
    expect(existsSync(backupPath)).toBe(true)
  })

  test('deve avançar pipeline de IDEA → BRAINSTORM → PLANNING', async () => {
    await stateMachine.transition(PipelinePhase.BRAINSTORM)
    expect(stateMachine.getCurrentPhase()).toBe(PipelinePhase.BRAINSTORM)

    await stateMachine.transition(PipelinePhase.PLANNING)
    expect(stateMachine.getCurrentPhase()).toBe(PipelinePhase.PLANNING)

    const state = stateStore.read()
    expect(state!.phases_completed).toContain(PipelinePhase.IDEA)
    expect(state!.phases_completed).toContain(PipelinePhase.BRAINSTORM)
  })

  test('deve executar agente mock via AgentRunner', async () => {
    const mockAgent = {
      name: 'mock-planner',
      execute: async (input: { project: string }) => ({
        project: input.project,
        objective: 'Test objective',
        strategy: 'Test strategy',
        tasks: [],
      }),
    }

    registry.register('planner', mockAgent)

    const result = await runner.run('planner', { project: 'test' })
    expect(result).toEqual({
      project: 'test',
      objective: 'Test objective',
      strategy: 'Test strategy',
      tasks: [],
    })
  })

  test('deve registrar eventos no histórico durante execução', async () => {
    const events: string[] = []
    eventBus.on('agent_spawned', (e) => { events.push(e.payload['agent'] as string) })
    eventBus.on('agent_completed', (e) => { events.push(`${e.payload['agent'] as string}:done`) })

    const mockAgent = {
      name: 'test-agent',
      execute: async () => ({ result: 'ok' }),
    }
    registry.register('planner', mockAgent)

    await runner.run('planner', {})

    expect(events).toContain('planner')
    expect(events).toContain('planner:done')
  })

  test('deve salvar e recuperar backlog', () => {
    const plan = {
      project: 'test',
      objective: 'Implementar autenticação',
      strategy: 'JWT com refresh tokens',
      tasks: [
        {
          id: 'task-001',
          title: 'Criar endpoint de login',
          description: 'POST /auth/login',
          phase: PipelinePhase.CODING,
          priority: 'high' as const,
          status: 'pending' as const,
          created_at: new Date().toISOString(),
          completed_at: null,
        },
      ],
    }

    backlogStore.savePlan(plan)

    const recovered = backlogStore.getPlan()
    expect(recovered).not.toBeNull()
    expect(recovered!.tasks).toHaveLength(1)
    expect(recovered!.tasks[0]!.title).toBe('Criar endpoint de login')
  })

  test('deve fazer rollback de fase corretamente', async () => {
    // Avançar para PLANNING
    await stateMachine.transition(PipelinePhase.BRAINSTORM)
    await stateMachine.transition(PipelinePhase.PLANNING)

    expect(stateMachine.getCurrentPhase()).toBe(PipelinePhase.PLANNING)

    // Rollback para BRAINSTORM
    await stateMachine.transition(PipelinePhase.BRAINSTORM)

    expect(stateMachine.getCurrentPhase()).toBe(PipelinePhase.BRAINSTORM)
  })

  test('AgentRunner deve respeitar timeout', async () => {
    const slowAgent = {
      name: 'slow-agent',
      execute: async () => {
        await new Promise((resolve) => setTimeout(resolve, 10000)) // 10 segundos
        return {}
      },
    }

    registry.register('planner', slowAgent)

    const fastRunner = new AgentRunner(registry, eventBus, history, 100) // 100ms timeout

    expect(async () => {
      await fastRunner.run('planner', {})
    }).toThrow()
  })
})
