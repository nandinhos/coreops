// ============================================================
// CoreOps — State Machine
// Controla transições determinísticas entre fases do pipeline
// ============================================================

import { PipelinePhase, PIPELINE_SEQUENCE } from './types.ts'
import type { ProjectState } from './types.ts'
import { EventBus } from './event-bus.ts'
import { StateStore } from '../workspace/state-store.ts'
import { HistoryLog } from '../workspace/history-log.ts'

// Matriz de transições permitidas (forward)
// Rollbacks são tratados separadamente
const ALLOWED_TRANSITIONS: Record<PipelinePhase, PipelinePhase[]> = {
  [PipelinePhase.IDEA]: [PipelinePhase.BRAINSTORM],
  [PipelinePhase.BRAINSTORM]: [PipelinePhase.PLANNING],
  [PipelinePhase.PLANNING]: [PipelinePhase.ARCHITECTURE],
  [PipelinePhase.ARCHITECTURE]: [PipelinePhase.TDD],
  [PipelinePhase.TDD]: [PipelinePhase.CODING],
  [PipelinePhase.CODING]: [PipelinePhase.REVIEW],
  [PipelinePhase.REVIEW]: [PipelinePhase.QA],
  [PipelinePhase.QA]: [PipelinePhase.DEPLOY],
  [PipelinePhase.DEPLOY]: [PipelinePhase.DONE],
  [PipelinePhase.DONE]: [],
}

// Rollbacks permitidos (backward)
const ALLOWED_ROLLBACKS: Record<PipelinePhase, PipelinePhase[]> = {
  [PipelinePhase.IDEA]: [],
  [PipelinePhase.BRAINSTORM]: [PipelinePhase.IDEA],
  [PipelinePhase.PLANNING]: [PipelinePhase.BRAINSTORM],
  [PipelinePhase.ARCHITECTURE]: [PipelinePhase.PLANNING],
  [PipelinePhase.TDD]: [PipelinePhase.ARCHITECTURE],
  [PipelinePhase.CODING]: [PipelinePhase.ARCHITECTURE, PipelinePhase.TDD],
  [PipelinePhase.REVIEW]: [PipelinePhase.CODING],
  [PipelinePhase.QA]: [PipelinePhase.CODING, PipelinePhase.REVIEW],
  [PipelinePhase.DEPLOY]: [PipelinePhase.QA],
  [PipelinePhase.DONE]: [],
}

export class StateMachine {
  constructor(
    private readonly stateStore: StateStore,
    private readonly eventBus: EventBus,
    private readonly history: HistoryLog,
  ) {}

  getCurrentPhase(): PipelinePhase {
    const state = this.stateStore.read()
    if (!state) throw new Error('Projeto não inicializado.')
    return state.current_phase
  }

  canTransitionTo(target: PipelinePhase): boolean {
    const current = this.getCurrentPhase()
    const allowed = ALLOWED_TRANSITIONS[current] ?? []
    const rollbacks = ALLOWED_ROLLBACKS[current] ?? []
    return allowed.includes(target) || rollbacks.includes(target)
  }

  async transition(target: PipelinePhase): Promise<ProjectState> {
    const state = this.stateStore.read()
    if (!state) throw new Error('Projeto não inicializado.')

    const current = state.current_phase

    // Validar transição
    const allowedForward = ALLOWED_TRANSITIONS[current] ?? []
    const allowedRollback = ALLOWED_ROLLBACKS[current] ?? []

    const isForward = allowedForward.includes(target)
    const isRollback = allowedRollback.includes(target)

    if (!isForward && !isRollback) {
      throw new Error(
        `Transição inválida: ${current} → ${target}. ` +
          `Permitidas: forward=${allowedForward.join(', ')} | rollback=${allowedRollback.join(', ')}`,
      )
    }

    // Calcular fases completadas
    const phaseIndex = PIPELINE_SEQUENCE.indexOf(target)
    const phases_completed = PIPELINE_SEQUENCE.slice(0, phaseIndex).filter(
      (p) => p !== target,
    ) as PipelinePhase[]

    const updated = this.stateStore.patch({
      current_phase: target,
      phases_completed,
      last_transition: new Date().toISOString(),
    })

    // Registrar no histórico
    this.history.stateChange(current, target)

    // Emitir evento
    if (isRollback) {
      await this.eventBus.emit('rollback_triggered', {
        from: current,
        to: target,
        project: state.project,
      })
    } else {
      await this.eventBus.emit('state_transition', {
        from: current,
        to: target,
        project: state.project,
      })
    }

    if (target === PipelinePhase.DONE) {
      await this.eventBus.emit('pipeline_completed', { project: state.project })
    }

    return updated
  }

  async advanceToNext(): Promise<ProjectState> {
    const current = this.getCurrentPhase()
    const allowed = ALLOWED_TRANSITIONS[current]

    if (!allowed || allowed.length === 0) {
      throw new Error(`Nenhuma transição disponível a partir de ${current}.`)
    }

    const next = allowed[0]!
    return this.transition(next)
  }

  getNextPhase(): PipelinePhase | null {
    const current = this.getCurrentPhase()
    const allowed = ALLOWED_TRANSITIONS[current]
    return allowed && allowed.length > 0 ? (allowed[0] ?? null) : null
  }

  getPipelineStatus(): {
    current: PipelinePhase
    completed: PipelinePhase[]
    pending: PipelinePhase[]
    next: PipelinePhase | null
  } {
    const state = this.stateStore.read()
    if (!state) throw new Error('Projeto não inicializado.')

    const currentIndex = PIPELINE_SEQUENCE.indexOf(state.current_phase)
    const pending = PIPELINE_SEQUENCE.slice(currentIndex + 1) as PipelinePhase[]

    return {
      current: state.current_phase,
      completed: state.phases_completed,
      pending,
      next: this.getNextPhase(),
    }
  }
}
