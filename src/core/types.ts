// ============================================================
// CoreOps — Core Types
// Fonte de verdade para todos os tipos do sistema
// ============================================================

// ----------------------------------------------------------
// Pipeline Phases
// ----------------------------------------------------------
export enum PipelinePhase {
  IDEA = 'IDEA',
  BRAINSTORM = 'BRAINSTORM',
  PLANNING = 'PLANNING',
  ARCHITECTURE = 'ARCHITECTURE',
  TDD = 'TDD',
  CODING = 'CODING',
  REVIEW = 'REVIEW',
  QA = 'QA',
  DEPLOY = 'DEPLOY',
  DONE = 'DONE',
}

export const PIPELINE_SEQUENCE: PipelinePhase[] = [
  PipelinePhase.IDEA,
  PipelinePhase.BRAINSTORM,
  PipelinePhase.PLANNING,
  PipelinePhase.ARCHITECTURE,
  PipelinePhase.TDD,
  PipelinePhase.CODING,
  PipelinePhase.REVIEW,
  PipelinePhase.QA,
  PipelinePhase.DEPLOY,
  PipelinePhase.DONE,
]

// ----------------------------------------------------------
// Project State
// ----------------------------------------------------------
export interface ProjectState {
  project: string
  description: string
  current_phase: PipelinePhase
  phases_completed: PipelinePhase[]
  tasks_total: number
  tasks_completed: number
  tasks_pending: number
  started_at: string
  last_updated: string
  last_transition: string | null
  workspace_path: string
}

// ----------------------------------------------------------
// Tasks & Microtasks
// ----------------------------------------------------------
export interface Task {
  id: string
  title: string
  description: string
  phase: PipelinePhase
  priority: 'high' | 'medium' | 'low'
  status: 'pending' | 'in_progress' | 'completed' | 'failed'
  created_at: string
  completed_at: string | null
}

export interface Microtask {
  id: string
  task_id: string
  description: string
  dependencies: string[]
  status: 'pending' | 'in_progress' | 'completed' | 'failed'
  retry_count: number
  created_at: string
  completed_at: string | null
}

export interface ExecutionPlan {
  project: string
  objective: string
  strategy: string
  tasks: Task[]
}

// ----------------------------------------------------------
// Code Operations
// ----------------------------------------------------------
export type CodeAction = 'create' | 'modify' | 'delete'

export interface CodePatch {
  file: string
  action: CodeAction
  content: string
  reason: string
}

export interface CodeReview {
  approved: boolean
  feedback: string
  issues: string[]
  suggestions: string[]
}

export interface TestFile {
  file: string
  content: string
  test_count: number
}

export interface ValidationResult {
  success: boolean
  errors: string[]
  warnings: string[]
  duration_ms: number
}

export interface DebugAnalysis {
  root_cause: string
  analysis: string
  fix: CodePatch[]
}

// ----------------------------------------------------------
// System Events
// ----------------------------------------------------------
export type EventType =
  | 'project_started'
  | 'project_resumed'
  | 'phase_started'
  | 'phase_completed'
  | 'state_transition'
  | 'rollback_triggered'
  | 'pipeline_completed'
  | 'task_created'
  | 'task_completed'
  | 'task_failed'
  | 'microtask_started'
  | 'microtask_completed'
  | 'microtask_failed'
  | 'agent_spawned'
  | 'agent_completed'
  | 'agent_failed'
  | 'error_occurred'

export interface SystemEvent {
  id: string
  type: EventType
  timestamp: string
  payload: Record<string, unknown>
}

// ----------------------------------------------------------
// Config
// ----------------------------------------------------------
export interface CoreOpsConfig {
  model?: string
  log_level: 'debug' | 'info' | 'warn' | 'error'
  agent_timeout_ms: number
  max_retries: number
  // API key é opcional — não necessária quando rodando dentro de Claude Code / Gemini CLI
  anthropic_api_key?: string
  // Forçar um adapter específico (claude-cli | gemini-cli | anthropic-api)
  // Se não definido, auto-detecta pelo ambiente
  adapter?: string
  // Phase 8: Advanced Agents (ativados por variável de ambiente ou flags)
  enable_security: boolean
  enable_refactor: boolean
  enable_documentation: boolean
  // Phase 9: LLM cache
  enable_llm_cache: boolean
}

export function loadConfig(): CoreOpsConfig {
  return {
    model: process.env['COREOPS_MODEL'],
    log_level: (process.env['COREOPS_LOG_LEVEL'] as CoreOpsConfig['log_level']) ?? 'info',
    agent_timeout_ms: parseInt(process.env['COREOPS_AGENT_TIMEOUT'] ?? '120000'),
    max_retries: parseInt(process.env['COREOPS_MAX_RETRIES'] ?? '3'),
    anthropic_api_key: process.env['ANTHROPIC_API_KEY'],
    adapter: process.env['COREOPS_ADAPTER'],
    enable_security: process.env['COREOPS_SECURITY'] === 'true',
    enable_refactor: process.env['COREOPS_REFACTOR'] === 'true',
    enable_documentation: process.env['COREOPS_DOCS'] === 'true',
    enable_llm_cache: process.env['COREOPS_LLM_CACHE'] !== 'false', // ligado por padrão
  }
}
