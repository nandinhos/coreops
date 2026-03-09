// ============================================================
// CoreOps — Core Orchestrator
// Controlador central do sistema — ponto único de coordenação
// ============================================================

import { PipelinePhase } from './types.ts'
import type { ProjectState, Task, Microtask, CoreOpsConfig, ExecutionPlan, BrainstormResult, CheckpointState, CheckpointQuestion, ArchitectureSpec } from './types.ts'
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
import { detectSkills } from '../skills/skill-registry.ts'
import type { Skill } from '../core/types.ts'
import { ParallelExecutionEngine } from './parallel-engine.ts'
import { MemoryStore } from '../memory/memory-store.ts'
import { ErrorStore } from '../memory/error-store.ts'
import { EventStore, createProjectEventStore } from '../debug/event-store.ts'
import { randomUUID } from 'node:crypto'

// Importações dos agentes (registradas dinamicamente)
import { BrainstormAgent, type BrainstormInput } from '../agents/brainstorm.ts'
import { ArchitectAgent, type ArchitectInput } from '../agents/architect.ts'
import { PlannerAgent, type PlannerInput } from '../agents/planner.ts'
import { MicrotaskGeneratorAgent, type MicrotaskGeneratorInput } from '../agents/microtask-generator.ts'
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
  pending_checkpoint: CheckpointState | null
  brainstorm_session: {
    interactive: boolean
    session_state?: string
    open_questions?: string[]
    approaches?: string[]
  } | null
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
  private readonly errorStore: ErrorStore
  private readonly events: EventStore
  // LLM é inicializado lazy (async) na primeira chamada
  private llm: LLMAdapter | null = null
  private adapterSource: AdapterSource | null = null
  private activeSkills: Skill[] = []

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
    this.errorStore = new ErrorStore()
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

    this.registerAgents(result.adapter, this.activeSkills)
    return this.llm
  }

  // ----------------------------------------------------------
  // Setup
  // ----------------------------------------------------------

  private registerAgents(llm: LLMAdapter, skills: Skill[] = []): void {
    this.registry.register('brainstorm', new BrainstormAgent(llm))
    this.registry.register('architect', new ArchitectAgent(llm))
    this.registry.register('planner', new PlannerAgent(llm))
    this.registry.register('microtask-generator', new MicrotaskGeneratorAgent(llm))
    this.registry.register('context-builder', new ContextBuilderAgent(this.workspace, this.memory))
    this.registry.register('coder', new CoderAgent(llm, skills))
    this.registry.register('reviewer', new ReviewerAgent(llm, skills))
    this.registry.register('tester', new TesterAgent(llm, skills))
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
      brainstorm_result: null,
      architecture_spec: null,
      pending_checkpoint: null,
      active_skills: [],
      brainstorm_session: null,
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
      case PipelinePhase.BRAINSTORM:
        await this.runBrainstormPhase()
        break
      case PipelinePhase.ARCHITECTURE:
        await this.runArchitecturePhase()
        break
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
  // Checkpoint
  // ----------------------------------------------------------

  createCheckpoint(phase: PipelinePhase, questions: string[], manual: boolean = false): void {
    const checkpointQuestions: CheckpointQuestion[] = questions.map((q, i) => ({
      id: `q${i + 1}`,
      question: q,
      required: true,
    }))

    const checkpoint: CheckpointState = {
      phase,
      questions: checkpointQuestions,
      answers: {},
      resolved: false,
      manual,  // true = artesanato manual
    }

    this.stateStore.patch({ pending_checkpoint: checkpoint })
    this.events.record('checkpoint_created', {
      phase,
      status: 'ok',
      payload: { question_count: questions.length, manual },
    })
    process.stderr.write(`[CoreOps] Checkpoint ${manual ? 'MANUAL ' : ''}criado com ${questions.length} pergunta(s).\n`)
  }

  resolveCheckpoint(answers: Record<string, string>, confirm: boolean = false): { resolved: boolean; pending: string[]; manual_confirm_required?: boolean; message?: string } {
    const state = this.stateStore.read()
    if (!state?.pending_checkpoint) {
      return { resolved: true, pending: [] }
    }

    const checkpoint = state.pending_checkpoint
    
    // Para checkpoints manuais, exigir confirmação explícita
    if (checkpoint.manual && !confirm) {
      return { 
        resolved: false, 
        pending: checkpoint.questions.map(q => q.question),
        manual_confirm_required: true,
        message: '⚠️ Este checkpoint é MANUAL. Para confirmar, use coreops_answer com { answers: {...}, confirm: true }' 
      }
    }

    const updated: CheckpointState = {
      ...checkpoint,
      answers: { ...checkpoint.answers, ...answers },
    }

    const pending = checkpoint.questions
      .filter(q => q.required && !updated.answers[q.id])
      .map(q => q.question)

    updated.resolved = pending.length === 0
    this.stateStore.patch({ pending_checkpoint: updated })

    if (updated.resolved) {
      this.events.record('checkpoint_resolved', {
        phase: checkpoint.phase,
        status: 'ok',
        payload: { answers_count: Object.keys(updated.answers).length, manual: checkpoint.manual },
      })
      process.stderr.write('[CoreOps] Checkpoint resolvido.\n')
    }

    return { resolved: updated.resolved, pending }
  }

  getPendingCheckpoint(): CheckpointState | null {
    const state = this.stateStore.read()
    return state?.pending_checkpoint ?? null
  }

  // ----------------------------------------------------------
  // Phases
  // ----------------------------------------------------------

  private async runBrainstormPhase(): Promise<void> {
    const state = this.stateStore.read()
    if (!state) throw new Error('Estado não encontrado.')

    await this.ensureLlm()
    process.stderr.write('[CoreOps] Executando BrainstormAgent...\n')

    const t0 = Date.now()
    const result = await this.runner.run<BrainstormInput, BrainstormResult>('brainstorm', {
      project: state.project,
      description: state.description,
      workspace_path: state.workspace_path,
    })

    // Detectar e aplicar skills baseadas na stack identificada
    const skills = detectSkills(state.workspace_path, result.tech_stack_detected)
    this.activeSkills = skills

    this.stateStore.patch({
      brainstorm_result: result,
      active_skills: skills.map(s => s.id),
    })

    // Re-registrar agentes com skills detectadas
    if (this.llm && skills.length > 0) {
      this.registerAgents(this.llm, skills)
      this.events.record('skills_detected', {
        phase: PipelinePhase.BRAINSTORM,
        status: 'ok',
        payload: { skills: skills.map(s => s.id) },
      })
    }

    this.memory.add({
      project: state.project,
      phase: PipelinePhase.BRAINSTORM,
      type: 'context',
      title: 'Brainstorm: ' + state.project,
      content: [
        'Modo: ' + result.project_mode,
        'Descrição refinada: ' + result.refined_description,
        'Stack: ' + result.tech_stack_detected.join(', '),
        'Critérios: ' + result.acceptance_criteria.join(' | '),
      ].join('\n'),
      tags: ['brainstorm', result.project_mode, ...result.tech_stack_detected],
    })

    this.events.record('brainstorm_completed', {
      phase: PipelinePhase.BRAINSTORM,
      duration_ms: Date.now() - t0,
      status: 'ok',
      payload: {
        project_mode: result.project_mode,
        tech_stack: result.tech_stack_detected,
        open_questions: result.open_questions.length,
        acceptance_criteria: result.acceptance_criteria.length,
      },
    })

    process.stderr.write('[CoreOps] Brainstorm concluído. Modo: ' + result.project_mode + '.\n')
    if (result.tech_stack_detected.length > 0) {
      process.stderr.write('[CoreOps] Stack detectada: ' + result.tech_stack_detected.join(', ') + '\n')
    }

      // Criar checkpoint MANUAL (artesanato) - exige resposta do usuário
      if (result.open_questions.length > 0 && result._is_interactive) {
        this.createCheckpoint(PipelinePhase.BRAINSTORM, result.open_questions, true)
        process.stderr.write('[CoreOps] ⚠️ CHECKPOINT MANUAL: responda as perguntas para continuar.\n')
      } else if (result.open_questions.length > 0) {
        this.createCheckpoint(PipelinePhase.BRAINSTORM, result.open_questions, false)
      }
  }

  private async runArchitecturePhase(): Promise<void> {
    const state = this.stateStore.read()
    if (!state) throw new Error('Estado não encontrado.')

    const backlog = this.backlogStore.read()
    if (!backlog?.plan) {
      process.stderr.write('[CoreOps] Nenhum plano encontrado. Execute a fase PLANNING primeiro.\n')
      return
    }

    await this.ensureLlm()
    process.stderr.write('[CoreOps] Executando ArchitectAgent...\n')

    const t0 = Date.now()
    const spec = await this.runner.run<ArchitectInput, ArchitectureSpec>('architect', {
      plan: backlog.plan,
      brainstorm_result: state.brainstorm_result ?? null,
      workspace_path: state.workspace_path,
    })

    this.stateStore.patch({ architecture_spec: spec })

    this.memory.add({
      project: state.project,
      phase: PipelinePhase.ARCHITECTURE,
      type: 'decision',
      title: 'Arquitetura: ' + state.project,
      content: [
        'Padrões: ' + spec.patterns.join(', '),
        'Decisões: ' + spec.tech_decisions.map(d => d.concern + ' → ' + d.decision).join(' | '),
        'Estrutura:\n' + spec.folder_structure,
      ].join('\n'),
      tags: ['arquitetura', 'decisão', ...spec.patterns],
    })

    this.events.record('architecture_completed', {
      phase: PipelinePhase.ARCHITECTURE,
      duration_ms: Date.now() - t0,
      status: 'ok',
      payload: {
        patterns: spec.patterns,
        abstractions: spec.key_abstractions.length,
        tech_decisions: spec.tech_decisions.length,
      },
    })

    process.stderr.write('[CoreOps] Arquitetura definida: ' + spec.patterns.join(', ') + '\n')
  }

  private async runPlanningPhase(): Promise<void> {
    const state = this.stateStore.read()
    if (!state) throw new Error('Estado não encontrado.')

    await this.ensureLlm()
    process.stderr.write('[CoreOps] Executando Planner...\n')

    const t0 = Date.now()
    const checkpoint = state.pending_checkpoint
    const plan = await this.runner.run<PlannerInput, ExecutionPlan>('planner', {
      project: state.project,
      description: state.description,
      workspace_path: state.workspace_path,
      brainstorm_result: state.brainstorm_result ?? null,
      checkpoint_answers: checkpoint?.answers ?? {},
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

    const state = this.stateStore.read()
    const archSpec = state?.architecture_spec ?? null

    const microtasks: Microtask[] = []
    for (const task of tasks) {
      const generated = await this.runner.run<MicrotaskGeneratorInput, Microtask[]>('microtask-generator', {
        task,
        architecture_spec: archSpec,
      })
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

          // Consultar error store antes de chamar o LLM
          const priorMatches = this.errorStore.findSimilar(errorLog)
          const priorSolution = priorMatches.length > 0 && priorMatches[0]
            ? {
                root_cause: priorMatches[0]!.root_cause,
                fix_description: priorMatches[0]!.fix_description,
                occurrence_count: priorMatches[0]!.occurrence_count,
              }
            : null

          if (priorSolution) {
            process.stderr.write('  [ErrorStore] Solução anterior encontrada (' + priorSolution.occurrence_count + 'x).\n')
          }

          const debug = await this.runner.run<
            import('../agents/debugger.ts').DebuggerInput,
            import('./types.ts').DebugAnalysis
          >('debugger', {
            errors: validation.errors,
            patches: patches as import('./types.ts').CodePatch[],
            microtask,
            prior_solution: priorSolution,
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

          // Registrar erro → solução no error store
          this.errorStore.record(
            errorLog,
            debug.root_cause,
            debug.analysis.substring(0, 300),
            projectName,
          )

          if (priorMatches.length > 0 && priorMatches[0]) {
            this.errorStore.bumpOccurrence(priorMatches[0]!.id)
          }

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
    const checkpoint = this.getPendingCheckpoint()

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
      pending_checkpoint: checkpoint,
      brainstorm_session: state.brainstorm_result?._is_interactive ? {
        interactive: true,
        session_state: state.brainstorm_result?._session_state,
        open_questions: state.brainstorm_result?.open_questions,
        approaches: state.brainstorm_result?._approaches,
      } : null,
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

    const checkpoint = this.getPendingCheckpoint()
    
    // CRÍTICO: Se há checkpoint não resolvido, BLOQUEIA avanço
    if (checkpoint && !checkpoint.resolved) {
      const manualMsg = checkpoint.manual 
        ? '⚠️ ATENÇÃO: Este checkpoint é MANUAL (artesanato). Responda explicitamente.'
        : ''
      return {
        requires_input: true,
        checkpoint,
        message: `⚠️ RESPOSTAS NECESSÁRIAS antes de continuar.\n${manualMsg}\nResponda usando coreops_answer({ answers: { "q1": "sua resposta", ... } })`,
        blocked_phase: checkpoint.phase,
        manual: checkpoint.manual,
      }
    }

    // Se checkpoint foi resolvido mas é manual, verificar se realmente deve avançar
    // (para checkpoints manuais, só avanza após resolveCheckpoint explícito)
    if (checkpoint && checkpoint.resolved && checkpoint.manual) {
      return {
        requires_input: false,
        can_advance: true,
        message: 'Checkpoint manual resolvido. Pode avançar com coreops next.',
        checkpoint,
      }
    }

    const currentState = this.stateStore.read()
    const currentPhase = currentState?.current_phase

    // Verificar se há perguntas de clarification PENDENTES no brainstorm_result
    // Se sim, não avançar até serem respondidas
    if (currentState?.brainstorm_result?._is_interactive && 
        currentState?.brainstorm_result?.open_questions?.length > 0 &&
        currentState?.brainstorm_result?._session_state !== 'approved') {
      
      // Não avançar - ainda há diálogo pendente
      return {
        requires_input: true,
        type: 'brainstorm_clarification',
        questions: currentState.brainstorm_result.open_questions,
        session_state: currentState.brainstorm_result._session_state,
        approaches: currentState.brainstorm_result._approaches,
        message: '⚠️ Brainstorm interativo pendente. Responda as perguntas ou escolha uma abordagem.',
      }
    }

    const nextState = await this.stateMachine.advanceToNext()
    const newPhase = nextState.current_phase

    process.stderr.write(`[CoreOps] Transicionando de ${currentPhase} para ${newPhase}\n`)

    await this.runPhase(newPhase)

    return {
      phase: newPhase,
      previous_phase: currentPhase,
      message: `Fase ${newPhase} iniciada.`,
    }
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
