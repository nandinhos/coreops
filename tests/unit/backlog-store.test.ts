// ============================================================
// CoreOps — BacklogStore Unit Tests
// Testa atomicidade de savePlan, saveMicrotasks e updateMicrotask
// ============================================================

import { describe, test, expect, beforeEach } from 'bun:test'
import { mkdirSync, rmSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { BacklogStore } from '../../src/workspace/backlog-store.ts'
import { WorkspaceManager } from '../../src/workspace/workspace-manager.ts'
import type { ExecutionPlan, Microtask } from '../../src/core/types.ts'

const TMP_DIR = '/tmp/coreops-backlog-test-' + Date.now()

function makeWorkspace(): WorkspaceManager {
  mkdirSync(join(TMP_DIR, '.coreops', 'backlog'), { recursive: true })
  return new WorkspaceManager(TMP_DIR)
}

function makePlan(taskCount = 2): ExecutionPlan {
  return {
    project: 'test',
    objective: 'Test',
    strategy: 'TDD',
    tasks: Array.from({ length: taskCount }, (_, i) => ({
      id: 't' + i,
      project: 'test',
      title: 'Task ' + i,
      description: 'desc',
      phase: 'CODING' as any,
      priority: 'medium' as const,
      status: 'pending' as const,
      created_at: new Date().toISOString(),
      completed_at: null,
    })),
  }
}

function makeMicrotask(id: string): Microtask {
  return {
    id,
    task_id: 't0',
    description: 'microtask ' + id,
    dependencies: [],
    concurrency_group: null,
    status: 'pending',
    retry_count: 0,
    created_at: new Date().toISOString(),
    completed_at: null,
  }
}

let store: BacklogStore

beforeEach(() => {
  if (existsSync(TMP_DIR)) rmSync(TMP_DIR, { recursive: true })
  store = new BacklogStore(makeWorkspace())
})

describe('BacklogStore — savePlan', () => {
  test('persiste plan e tasks', async () => {
    const plan = makePlan(3)
    await store.savePlan(plan)
    expect(store.getTasks()).toHaveLength(3)
    expect(store.getPlan()?.project).toBe('test')
  })

  test('retorna Promise (é assíncrono)', () => {
    const result = store.savePlan(makePlan())
    expect(result).toBeInstanceOf(Promise)
  })
})

describe('BacklogStore — saveMicrotasks', () => {
  test('persiste lista de microtasks', async () => {
    const mts = [makeMicrotask('m1'), makeMicrotask('m2')]
    await store.saveMicrotasks(mts)
    expect(store.getMicrotasks()).toHaveLength(2)
  })

  test('retorna Promise (é assíncrono)', () => {
    const result = store.saveMicrotasks([])
    expect(result).toBeInstanceOf(Promise)
  })
})

describe('BacklogStore — atomicidade concorrente', () => {
  test('savePlan + updateMicrotask concorrentes não sobrescrevem dados', async () => {
    // Prepara estado inicial: plan com tasks e microtasks
    const plan = makePlan(1)
    await store.savePlan(plan)
    const microtasks = [makeMicrotask('m1'), makeMicrotask('m2')]
    await store.saveMicrotasks(microtasks)

    // Lança savePlan e updateMicrotask concorrentemente
    await Promise.all([
      store.savePlan(makePlan(1)),
      store.updateMicrotask('m1', { status: 'completed' }),
      store.updateMicrotask('m2', { status: 'in_progress' }),
    ])

    // As microtasks devem ter os status corretos (sem sobrescrita)
    const result = store.getMicrotasks()
    const m1 = result.find((m) => m.id === 'm1')
    const m2 = result.find((m) => m.id === 'm2')
    expect(m1?.status).toBe('completed')
    expect(m2?.status).toBe('in_progress')
  })

  test('múltiplos updateMicrotask paralelos preservam todos os updates', async () => {
    const microtasks = Array.from({ length: 5 }, (_, i) => makeMicrotask('m' + i))
    await store.saveMicrotasks(microtasks)

    await Promise.all(
      microtasks.map((m, i) =>
        store.updateMicrotask(m.id, { status: i % 2 === 0 ? 'completed' : 'failed' }),
      ),
    )

    const result = store.getMicrotasks()
    for (let i = 0; i < 5; i++) {
      const m = result.find((x) => x.id === 'm' + i)
      expect(m?.status).toBe(i % 2 === 0 ? 'completed' : 'failed')
    }
  })
})

describe('BacklogStore — retry_count', () => {
  test('updateMicrotask persiste retry_count', async () => {
    await store.saveMicrotasks([makeMicrotask('m1')])
    await store.updateMicrotask('m1', { retry_count: 2 })
    const m = store.getMicrotasks().find((x) => x.id === 'm1')
    expect(m?.retry_count).toBe(2)
  })
})
