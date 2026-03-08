// ============================================================
// CoreOps — Backlog Store
// Persistência de tarefas e microtasks com mutex para evitar
// race conditions em updates concorrentes de microtasks.
// ============================================================

import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import type { Task, Microtask, ExecutionPlan } from '../core/types.ts'
import { WorkspaceManager } from './workspace-manager.ts'

interface BacklogData {
  plan: ExecutionPlan | null
  tasks: Task[]
  microtasks: Microtask[]
}

export class BacklogStore {
  private readonly path: string
  // Fila de writes serializados para evitar race conditions em execução paralela
  private writeQueue: Promise<void> = Promise.resolve()

  constructor(private readonly workspace: WorkspaceManager) {
    this.path = workspace.getBacklogPath()
  }

  read(): BacklogData {
    if (!existsSync(this.path)) {
      return { plan: null, tasks: [], microtasks: [] }
    }
    const raw = readFileSync(this.path, 'utf-8')
    return JSON.parse(raw) as BacklogData
  }

  private write(data: BacklogData): void {
    writeFileSync(this.path, JSON.stringify(data, null, 2), 'utf-8')
  }

  /**
   * Executa uma operação read-modify-write de forma serializada.
   * Garante que updates concorrentes de microtasks não se sobrescrevam.
   */
  private atomicUpdate(fn: (data: BacklogData) => BacklogData): Promise<void> {
    this.writeQueue = this.writeQueue.then(() => {
      const data = this.read()
      const updated = fn(data)
      this.write(updated)
    })
    return this.writeQueue
  }

  savePlan(plan: ExecutionPlan): void {
    const data = this.read()
    data.plan = plan
    data.tasks = plan.tasks
    this.write(data)
  }

  saveMicrotasks(microtasks: Microtask[]): void {
    const data = this.read()
    data.microtasks = microtasks
    this.write(data)
  }

  getPlan(): ExecutionPlan | null {
    return this.read().plan
  }

  getTasks(): Task[] {
    return this.read().tasks
  }

  getMicrotasks(): Microtask[] {
    return this.read().microtasks
  }

  updateTask(taskId: string, patch: Partial<Task>): void {
    const data = this.read()
    data.tasks = data.tasks.map((t) => (t.id === taskId ? { ...t, ...patch } : t))
    this.write(data)
  }

  updateMicrotask(microtaskId: string, patch: Partial<Microtask>): Promise<void> {
    return this.atomicUpdate((data) => {
      data.microtasks = data.microtasks.map((m) =>
        m.id === microtaskId ? { ...m, ...patch } : m,
      )
      return data
    })
  }
}
