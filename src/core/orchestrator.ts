// ============================================================
// CoreOps — Core Orchestrator
// Controlador central do sistema — ponto único de coordenação
// ============================================================

import { PipelinePhase } from './types.ts'
import type { ProjectState, Task, Microtask, CoreOpsConfig, ExecutionPlan } from './types.ts'
import { EventBus } from './event-bus.ts'
import { StateMachine } from './state-machine.ts'
import { WorkspaceManager } from '../workspace/workspace-manager.ts'
import { StateStore } from '../workspace/state-store.ts'
import { BacklogStore } from '../workspace/backlog-store.ts'
import { HistoryLog } from '../workspace/history-log.ts'
import { AgentRegistry } from '../agents/agent-registry.ts'
import { AgentRunner } from '../agents/agent-runner.ts'
import { createAdapter, detectCurrentLLM, type AdapterSource } from '../llm/adapter-factory.ts'
import type { LLMAdapter } from '../llm/types.ts'
import { ParallelExecutionEngine } from './parallel-engine.ts'
import { MemoryStore } from '../memory/memory-store.ts'
import { EventStore, createProjectEventStore } from '../debug/event-store.ts'
import { randomUUID } from 'node:crypto'

// Importações dos agentes (registradas dinamicamente)
import { PlannerAgent, type PlannerInput } from '../agents/planner.ts'
import { MicrotaskGeneratorAgent } from '../agents/microtask-generator.ts'
import { ContextBuilderAgent } from '../agents/context-builder.ts'
import { CoderAgent } from '../agents/coder.ts'
import { ReviewerAgent } from '../agents/reviewer.ts'
import { TesterAgent } from '../agents/tester.ts'
import { ValidatorAgent } from '../agents/validator.ts'
import { DebuggerAgent } from '../agents/debugger.ts'
import { SecurityAgent } from '../agents/security.ts'
import type { SecurityInput, SecurityReport } from '../agents/security.ts'
import { RefactorAgent } from '../agents/refactor.ts'
import type { RefactorInput, RefactorResult } from '../agents/refactor.ts'
import { DocumentationAgent } from '../agents/documentation.ts'
import type { DocumentationInput, DocumentationResult } from '../agents/documentation.ts'

export interface OrchestratorStatus {
  project: string
  description: string
  current_phase: PipelinePhase
  phases_completed: PipelinePhase[]
  phases_pending: PipelinePhase[]
  next_phase: PipelinePhase | null
  tasks_total: number
  tasks_completed: number
  tasks_pending: number
  started_at: string
  last_updated: string
  llm_source: string | null
}

export class Orchestrator {
  private readonly workspace: WorkspaceManager
  private readonly stateStore: StateStore
  private readonly backlogStore: BacklogStore
  private readonly historyLog: HistoryLog
  private readonly eventBus: EventBus
  private readonly stateMachine: StateMachine
  private readonly registry: AgentRegistry
  private readonly runner: AgentRunner
  private readonly memory: MemoryStore
  private readonly events: EventStore
  // LLM é inicializado lazy (async) na primeira chamada
  private llm: LLMAdapter | null = null
  private adapterSource: AdapterSource | null = null

  constructor(private readonly config: CoreOpsConfig) {
    this.workspace = new WorkspaceManager(process.cwd())
    this.stateStore = new StateStore(this.workspace)
    this.backlogStore = new BacklogStore(this.workspace)
    this.historyLog = new HistoryLog(this.workspace)
    this.eventBus = new EventBus()
    this.stateMachine = new StateMachine(this.stateStore, this.eventBus, this.historyLog)
    this.registry = new AgentRegistry()
    this.runner = new AgentRunner(
      this.registry,
      this.eventBus,
      this.historyLog,
      config.agent_timeout_ms,
    )
    this.memory = new MemoryStore()
    this.events = createProjectEventStore()

    this.setupEventLogging()
  }

  // Inicializar LLM adapter na primeira necessidade (lazy async)
  private async ensureLlm(): Promise<LLMAdapter> {
    if (this.llm) return this.llm

    const result = await createAdapter({
      anthropic_api_key: this.config.anthropic_api_key,
      model: this.config.model,
      prefer: this.config.adapter as AdapterSource | undefined,
      enable_cache: this.config.enable_llm_cache,
    })

    this.llm = result.adapter
    this.adapterSource = result.source
    process.stderr.write('[CoreOps] LLM: ' + result.source + '\n')

    this.registerAgents(result.adapter)
    return this.llm
  }

  // ----------------------------------------------------------
  // Setup
  // ----------------------------------------------------------

  private registerAgents(llm: LLMAdapter): void {
    this.registry.register('planner', new PlannerAgent(llm))
    this.registry.register('microtask-generator', new MicrotaskGeneratorAgent(llm))
    this.registry.register('context-builder', new ContextBuilderAgent(this.workspace, this.memory))
    this.registry.register('coder', new CoderAgent(llm))
    this.registry.register('reviewer', new ReviewerAgent(llm))
    this.registry.register('tester', new TesterAgent(llm))
    this.registry.register('validator', new ValidatorAgent())
    this.registry.register('debugger', new DebuggerAgent(llm))

    // Phase 8: Advanced Agents (opcionais por config)
    if (this.config.enable_security) {
      this.registry.register('security', new SecurityAgent(llm))
    }
    if (this.config.enable_refactor) {
      this.registry.register('refactor', new RefactorAgent(llm))
    }
    if (this.config.enable_documentation) {
      this.registry.register('documentation', new DocumentationAgent(llm))
    }
  }

  private setupEventLogging(): void {
    this.eventBus.on('phase_started', (e) => {
      const phase = e.payload['phase'] as string
      process.stderr.write('\n[CoreOps] Fase iniciada: ' + phase + '\n')
      this.events.record('phase_started', { phase, payload: e.payload })
    })

    this.eventBus.on('phase_completed', (e) => {
      const phase = e.payload['phase'] as string
      process.stderr.write('[CoreOps] Fase concluída: ' + phase + '\n')
      this.events.record('phase_completed', { phase, status: 'ok', payload: e.payload })
    })

    this.eventBus.on('agent_spawned', (e) => {
      const agent = e.payload['agent'] as string
      if (this.config.log_level === 'debug') {
        process.stderr.write('  [Agent] Executando: ' + agent + '\n')
      }
    })

    this.eventBus.on('agent_completed', (e) => {
      const agent = e.payload['agent'] as string
      const duration = e.payload['duration_ms'] as number | undefined
      this.events.record('agent_completed', {
        ref_id: agent,
        duration_ms: duration,
        status: 'ok',
        payload: e.payload,
      })
    })

    this.eventBus.on('agent_failed', (e) => {
      const agent = e.payload['agent'] as string
      this.events.record('agent_failed', { ref_id: agent, status: 'error', payload: e.payload })
    })

    this.eventBus.on('microtask_completed', (e) => {
      this.events.record('microtask_completed', {
        ref_id: e.payload['id'] as string,
        status: 'ok',
        payload: e.payload,
      })
    })

    this.eventBus.on('microtask_failed', (e) => {
      this.events.record('microtask_failed', {
        ref_id: e.payload['id'] as string,
        status: 'error',
        payload: e.payload,
      })
    })

    this.eventBus.on('error_occurred', (e) => {
      process.stderr.write('[CoreOps] Erro: ' + (e.payload['message'] as string) + '\n')
      this.events.record('error_occurred', { status: 'error', payload: e.payload })
    })
  }

  // ----------------------------------------------------------
  // Lifecycle
  // ----------------------------------------------------------

  async startProject(name: string, description: string): Promise<ProjectState> {
    // Inicializar workspace
    this.workspace.init()

    const llmSource = detectCurrentLLM()

    const state: ProjectState = {
      project: name,
      description,
      current_phase: PipelinePhase.IDEA,
      phases_completed: [],
      tasks_total: 0,
      tasks_completed: 0,
      tasks_pending: 0,
      started_at: new Date().toISOString(),
      last_updated: new Date().toISOString(),
      last_transition: null,
      workspace_path: process.cwd(),
      llm_source: llmSource,
    }

    this.stateStore.write(state)
    this.historyLog.projectStarted(name)

    this.events.record('llm_detected', {
      phase: PipelinePhase.IDEA,
      status: 'ok',
      payload: { source: llmSource },
    })

    this.memory.add({
      project: name,
      phase: PipelinePhase.IDEA,
      type: 'context',
      title: 'Projeto: ' + name,
      content: description,
      tags: ['projeto', 'contexto'],
    })

    this.events.record('project_started', {
      phase: PipelinePhase.IDEA,
      status: 'ok',
      payload: { project: name, description },
    })

    await this.eventBus.emit('project_started', { project: name, description })

    return state
  }

  async resumeProject(): Promise<ProjectState> {
    const state = this.stateStore.read()
    if (!state) {
      throw new Error('Nenhum projeto encontrado. Execute `coreops start` primeiro.')
    }

    this.historyLog.projectResumed(state.project, state.current_phase)
    this.events.record('project_resumed', {
      phase: state.current_phase,
      status: 'ok',
      payload: { project: state.project, phase: state.current_phase },
    })
    await this.eventBus.emit('project_resumed', {
      project: state.project,
      phase: state.current_phase,
    })

    return state
  }

  // ----------------------------------------------------------
  // Pipeline Control
  // ----------------------------------------------------------

  async advancePhase(): Promise<ProjectState> {
    return this.stateMachine.advanceToNext()
  }

  async runPhase(phase: PipelinePhase): Promise<void> {
    await this.eventBus.emit('phase_started', { phase })

    switch (phase) {
      case PipelinePhase.PLANNING:
        await this.runPlanningPhase()
        break
      case PipelinePhase.CODING:
        await this.runCodingPhase()
        break
      case PipelinePhase.REVIEW:
        await this.runReviewPhase()
        break
      case PipelinePhase.TDD:
        await this.runTDDPhase()
        break
      default:
        process.stderr.write('[CoreOps] Fase ' + phase + ' requer intervenção manual ou não tem automação no MVP.\n')
    }

    await this.eventBus.emit('phase_completed', { phase })
  }

  // ----------------------------------------------------------
  // Phases
  // ----------------------------------------------------------

  private async runPlanningPhase(): Promise<void> {
    const state = this.stateStore.read()
    if (!state) throw new Error('Estado não encontrado.')

    await this.ensureLlm()
    process.stderr.write('[CoreOps] Executando Planner...\n')

    const t0 = Date.now()
    const plan = await this.runner.run<PlannerInput, ExecutionPlan>('planner', {
      project: state.project,
      description: state.description,
      workspace_path: state.workspace_path,
    })

    await this.backlogStore.savePlan(plan)

    const tasks = this.backlogStore.getTasks()
    this.stateStore.patch({
      tasks_total: tasks.length,
      tasks_pending: tasks.length,
    })

    this.memory.add({
      project: state.project,
      phase: PipelinePhase.PLANNING,
      type: 'decision',
      title: 'Estratégia: ' + plan.project,
      content: 'Objetivo: ' + plan.objective + '\n\nEstratégia: ' + plan.strategy,
      tags: ['plano', 'estratégia'],
    })

    this.events.record('planning_completed', {
      phase: PipelinePhase.PLANNING,
      duration_ms: Date.now() - t0,
      status: 'ok',
      payload: { task_count: tasks.length, objective: plan.objective },
    })

    process.stderr.write('[CoreOps] Plano gerado com ' + tasks.length + ' tarefa(s).\n')
  }

  private async runTDDPhase(): Promise<void> {
    const tasks = this.backlogStore.getTasks()
    if (tasks.length === 0) {
      process.stderr.write('[CoreOps] Nenhuma tarefa no backlog. Execute a fase PLANNING primeiro.\n')
      return
    }

    await this.ensureLlm()
    process.stderr.write('[CoreOps] Gerando microtasks...\n')

    const microtasks: Microtask[] = []
    for (const task of tasks) {
      const generated = await this.runner.run<Task, Microtask[]>('microtask-generator', task)
      microtasks.push(...generated)
    }

    await this.backlogStore.saveMicrotasks(microtasks)
    process.stderr.write('[CoreOps] ' + microtasks.length + ' microtask(s) gerada(s).\n')
  }

  private async runCodingPhase(): Promise<void> {
    await this.ensureLlm()
    const microtasks = this.backlogStore.getMicrotasks()
    const pendingMicrotasks = microtasks.filter((m) => m.status === 'pending')

    if (pendingMicrotasks.length === 0) {
      process.stderr.write('[CoreOps] Nenhuma microtask pendente. Execute a fase TDD primeiro.\n')
      return
    }

    process.stderr.write('[CoreOps] Executando ' + pendingMicrotasks.length + ' microtask(s)...\n')

    const engine = new ParallelExecutionEngine({
      max_concurrency: 0,
      onWaveStart: async (wave, ids) => {
        process.stderr.write('[CoreOps] Onda ' + wave + ': ' + ids.length + ' microtask(s) em paralelo...\n')
        await this.eventBus.emit('wave_started', { wave, microtask_ids: ids })
      },
      onWaveEnd: async (result) => {
        await this.eventBus.emit('wave_completed', {
          wave: result.wave_number,
          completed: result.completed,
          failed: result.failed,
        })
        this.events.record('wave_completed', {
          payload: {
            wave: result.wave_number,
            completed_count: result.completed.length,
            failed_count: result.failed.length,
          },
        })
      },
    })

    await engine.run(pendingMicrotasks, (m) => this.executeMicrotask(m))
  }

  private async runReviewPhase(): Promise<void> {
    const microtasks = this.backlogStore.getMicrotasks()
    const completedCount = microtasks.filter((m) => m.status === 'completed').length
    process.stderr.write('[CoreOps] Review: ' + completedCount + '/' + microtasks.length + ' microtask(s) completadas.\n')
  }

  // ----------------------------------------------------------
  // Microtask Execution Loop
  // ----------------------------------------------------------

  async executeMicrotask(microtask: Microtask): Promise<void> {
    process.stderr.write('\n  [Microtask] ' + microtask.description + '\n')

    const t0 = Date.now()
    await this.backlogStore.updateMicrotask(microtask.id, { status: 'in_progress' })
    await this.eventBus.emit('microtask_started', { id: microtask.id, description: microtask.description })

    const state = this.stateStore.read()
    const projectName = state?.project ?? 'unknown'

    let success = false
    let lastError = ''

    for (let attempt = 1; attempt <= this.config.max_retries && !success; attempt++) {
      if (attempt > 1) {
        process.stderr.write('  [Retry] Tentativa ' + attempt + '/' + this.config.max_retries + '\n')
        await this.backlogStore.updateMicrotask(microtask.id, { retry_count: attempt - 1 })
      }

      try {
        const context = await this.runner.run<Microtask, string>('context-builder', microtask)

        const patches = await this.runner.run<
          { microtask: Microtask; context: string },
          import('./types.ts').CodePatch[]
        >('coder', { microtask, context })

        await this.applyPatches(patches as import('./types.ts').CodePatch[])

        const review = await this.runner.run<
          { patches: import('./types.ts').CodePatch[]; microtask: Microtask },
          import('./types.ts').CodeReview
        >('reviewer', { patches: patches as import('./types.ts').CodePatch[], microtask })

        if (!review.approved) {
          process.stderr.write('  [Review] Rejeitado: ' + review.feedback + '\n')
          lastError = review.feedback
          continue
        }

        // Security scan (se habilitado) — bloqueia em vulnerabilidades críticas
        if (this.config.enable_security) {
          const secReport = await this.runner.run<SecurityInput, SecurityReport>('security', {
            patches: patches as import('./types.ts').CodePatch[],
          })
          if (secReport.issues.length > 0) {
            process.stderr.write('  [Security] ' + secReport.summary + '\n')
            if (!secReport.safe && secReport.severity === 'critical') {
              lastError = '[Security] ' + secReport.summary
              continue
            }
          }
          if (secReport.issues.length > 0) {
            this.events.record('security_issues', { status: 'ok', payload: { count: secReport.issues.length, severity: secReport.severity } })
          }
        }

        const testFiles = await this.runner.run<
          { patches: import('./types.ts').CodePatch[]; microtask: Microtask },
          import('./types.ts').TestFile[]
        >('tester', { patches: patches as import('./types.ts').CodePatch[], microtask })

        await this.applyTestFiles(testFiles as import('./types.ts').TestFile[])

        const validation = await this.runner.run<string, import('./types.ts').ValidationResult>(
          'validator',
          process.cwd(),
        )

        if (!validation.success) {
          const errorLog = validation.errors.join('\n')
          process.stderr.write('  [Validator] Falha: ' + errorLog.substring(0, 200) + '\n')

          const debug = await this.runner.run<
            { errors: string[]; patches: import('./types.ts').CodePatch[]; microtask: Microtask },
            import('./types.ts').DebugAnalysis
          >('debugger', {
            errors: validation.errors,
            patches: patches as import('./types.ts').CodePatch[],
            microtask,
          })

          await this.applyPatches(debug.fix as import('./types.ts').CodePatch[])

          this.memory.add({
            project: projectName,
            phase: PipelinePhase.CODING,
            type: 'lesson',
            title: 'Fix: ' + microtask.description.substring(0, 60),
            content: 'Causa raiz: ' + debug.root_cause + '\n\nAnálise: ' + debug.analysis,
            tags: ['debug', 'fix'],
          })

          lastError = errorLog
          continue
        }

        // Refactoring (se habilitado) — aplicado após validação bem-sucedida
        let finalPatches = patches as import('./types.ts').CodePatch[]
        if (this.config.enable_refactor) {
          const refResult = await this.runner.run<RefactorInput, RefactorResult>('refactor', {
            patches: finalPatches,
          })
          if (refResult.changed) {
            process.stderr.write('  [Refactor] ' + refResult.summary + '\n')
            await this.applyPatches(refResult.refactored)
            finalPatches = refResult.refactored
          }
        }

        // Documentação (se habilitada) — adicionada após refactoring
        if (this.config.enable_documentation) {
          const docResult = await this.runner.run<DocumentationInput, DocumentationResult>('documentation', {
            patches: finalPatches,
          })
          process.stderr.write('  [Docs] ' + docResult.summary + '\n')
          await this.applyPatches(docResult.documented)
        }

        const fileList = finalPatches.map((p) => p.file).join(', ')
        this.memory.add({
          project: projectName,
          phase: PipelinePhase.CODING,
          type: 'pattern',
          title: microtask.description.substring(0, 80),
          content: 'Arquivos: ' + fileList + '\nAbordagem: ' + review.feedback,
          tags: ['microtask', 'aprovado'],
        })

        success = true
        process.stderr.write('  [OK] Microtask concluída\n')
      } catch (error) {
        lastError = error instanceof Error ? error.message : String(error)
        process.stderr.write('  [Error] ' + lastError + '\n')
      }
    }

    if (success) {
      const duration = Date.now() - t0
      await this.backlogStore.updateMicrotask(microtask.id, {
        status: 'completed',
        completed_at: new Date().toISOString(),
      })
      this.historyLog.microtaskCompleted(microtask.id, microtask.description)
      await this.eventBus.emit('microtask_completed', {
        id: microtask.id,
        description: microtask.description,
        duration_ms: duration,
      })

      const currentState = this.stateStore.read()
      if (currentState) {
        this.stateStore.patch({
          tasks_completed: currentState.tasks_completed + 1,
          tasks_pending: Math.max(0, currentState.tasks_pending - 1),
        })
      }
    } else {
      await this.backlogStore.updateMicrotask(microtask.id, { status: 'failed' })
      await this.eventBus.emit('microtask_failed', {
        id: microtask.id,
        description: microtask.description,
        error: lastError,
      })
      process.stderr.write('  [FALHOU] Microtask ' + microtask.id + ' falhou após ' + this.config.max_retries + ' tentativas\n')
    }
  }

  // ----------------------------------------------------------
  // File Operations
  // ----------------------------------------------------------

  private async applyPatches(patches: import('./types.ts').CodePatch[]): Promise<void> {
    const { writeFileSync, mkdirSync, unlinkSync, existsSync } = await import('node:fs')
    const { dirname } = await import('node:path')

    for (const patch of patches) {
      const fullPath = process.cwd() + '/' + patch.file

      if (patch.action === 'delete') {
        if (existsSync(fullPath)) {
          unlinkSync(fullPath)
        }
        continue
      }

      const dir = dirname(fullPath)
      if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true })
      }

      writeFileSync(fullPath, patch.content, 'utf-8')
      process.stderr.write('    ' + (patch.action === 'create' ? '+' : '~') + ' ' + patch.file + '\n')
    }
  }

  private async applyTestFiles(testFiles: import('./types.ts').TestFile[]): Promise<void> {
    const { writeFileSync, mkdirSync, existsSync } = await import('node:fs')
    const { dirname } = await import('node:path')

    for (const tf of testFiles) {
      const fullPath = process.cwd() + '/' + tf.file
      const dir = dirname(fullPath)

      if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true })
      }

      writeFileSync(fullPath, tf.content, 'utf-8')
      process.stderr.write('    + ' + tf.file + ' (' + tf.test_count + ' tests)\n')
    }
  }

  // ----------------------------------------------------------
  // Status
  // ----------------------------------------------------------

  getStatus(): OrchestratorStatus {
    const state = this.stateStore.read()
    if (!state) throw new Error('Projeto não inicializado. Execute `coreops start`.')

    const pipelineStatus = this.stateMachine.getPipelineStatus()

    return {
      project: state.project,
      description: state.description,
      current_phase: state.current_phase,
      phases_completed: pipelineStatus.completed,
      phases_pending: pipelineStatus.pending,
      next_phase: pipelineStatus.next,
      tasks_total: state.tasks_total,
      tasks_completed: state.tasks_completed,
      tasks_pending: state.tasks_pending,
      started_at: state.started_at,
      last_updated: state.last_updated,
      llm_source: state.llm_source ?? null,
    }
  }

  isInitialized(): boolean {
    return this.stateStore.exists()
  }

  getBacklogStore(): BacklogStore {
    return this.backlogStore
  }

  getEventBus(): EventBus {
    return this.eventBus
  }

  getMemoryStore(): MemoryStore {
    return this.memory
  }

  getEventStore(): EventStore {
    return this.events
  }

  async next(): Promise<any> {
    if (!this.isInitialized()) throw new Error('Projeto não inicializado.')
    return this.stateMachine.advanceToNext()
  }

  getBacklog(): any {
    if (!this.isInitialized()) throw new Error('Projeto não inicializado.')
    return this.backlogStore.read()
  }

  getMetrics(): any {
    const state = this.stateStore.read()
    if (!state) throw new Error('Projeto não inicializado.')
    // Métricas simplificadas
    const total = state.tasks_total || 0
    const completed = state.tasks_completed || 0
    return {
      project: state.project,
      phase: state.current_phase,
      progress: total > 0 ? Math.round((completed / total) * 100) : 0,
      total_tasks: total,
      completed,
      pending: state.tasks_pending || 0
    }
  }

  getRecentEvents(limit: number = 20): any {
    return this.events.list(limit)
  }

  async addMemory(title: string, content: string, type: string, project?: string): Promise<void> {
    const VALID_TYPES = ['decision', 'pattern', 'lesson', 'context'] as const
    type ValidMemoryType = typeof VALID_TYPES[number]
    if (!VALID_TYPES.includes(type as ValidMemoryType)) {
      throw new Error(
        `Invalid memory type: "${type}". Valid types: ${VALID_TYPES.join(', ')}`,
      )
    }
    const state = this.stateStore.read()
    this.memory.add({
      project: project || state?.project || 'global',
      phase: state?.current_phase ?? PipelinePhase.IDEA,
      type: type as ValidMemoryType,
      title,
      content,
      tags: [],
    })
  }

  async searchMemory(query: string, project?: string): Promise<any> {
    return this.memory.search(query, project)
  }

  // Helper para gerar IDs únicos (usado pelos agentes)
  static generateId(): string {
    return randomUUID().substring(0, 8)
  }
}
