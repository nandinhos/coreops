// ============================================================
// CoreOps — Observability Metrics
// Computa métricas do projeto a partir do EventStore + StateStore
// ============================================================

import type { DebugEvent, EventStore } from '../debug/event-store.ts'

export interface PhaseMetrics {
  phase: string
  started_at: number | null
  ended_at: number | null
  duration_ms: number | null
  status: 'completed' | 'in_progress' | 'pending'
}

export interface AgentMetrics {
  name: string
  executions: number
  successes: number
  failures: number
  avg_duration_ms: number | null
  total_duration_ms: number
}

export interface MicrotaskMetrics {
  total: number
  completed: number
  failed: number
  success_rate: number
}

export interface ProjectMetrics {
  project: string
  started_at: number | null
  total_duration_ms: number | null
  phases: PhaseMetrics[]
  agents: AgentMetrics[]
  microtasks: MicrotaskMetrics
  errors: number
  events_total: number
}

export function computeMetrics(
  events: DebugEvent[],
  projectName: string,
): ProjectMetrics {
  // Timing geral
  const firstEvent = events[0]
  const lastEvent = events[events.length - 1]
  const started_at = firstEvent?.timestamp ?? null
  const total_duration_ms =
    started_at && lastEvent ? lastEvent.timestamp - started_at : null

  // Métricas por fase
  const phaseMap = new Map<string, { start?: number; end?: number }>()

  for (const e of events) {
    if (e.type === 'phase_started' && e.phase) {
      phaseMap.set(e.phase, { ...phaseMap.get(e.phase), start: e.timestamp })
    }
    if (e.type === 'phase_completed' && e.phase) {
      phaseMap.set(e.phase, { ...phaseMap.get(e.phase), end: e.timestamp })
    }
  }

  const phases: PhaseMetrics[] = Array.from(phaseMap.entries()).map(([phase, times]) => {
    const duration_ms = times.start && times.end ? times.end - times.start : null
    const status: PhaseMetrics['status'] = times.end ? 'completed' : times.start ? 'in_progress' : 'pending'
    return { phase, started_at: times.start ?? null, ended_at: times.end ?? null, duration_ms, status }
  })

  // Métricas por agente
  const agentMap = new Map<
    string,
    { execs: number; successes: number; failures: number; total_dur: number; durations: number[] }
  >()

  for (const e of events) {
    if (e.type !== 'agent_completed' && e.type !== 'agent_failed') continue

    const name = (e.payload['agent'] as string) ?? e.ref_id ?? 'unknown'
    const entry = agentMap.get(name) ?? { execs: 0, successes: 0, failures: 0, total_dur: 0, durations: [] }
    entry.execs++

    if (e.type === 'agent_completed') {
      entry.successes++
    } else {
      entry.failures++
    }

    if (e.duration_ms != null) {
      entry.total_dur += e.duration_ms
      entry.durations.push(e.duration_ms)
    }

    agentMap.set(name, entry)
  }

  const agents: AgentMetrics[] = Array.from(agentMap.entries()).map(([name, a]) => ({
    name,
    executions: a.execs,
    successes: a.successes,
    failures: a.failures,
    avg_duration_ms: a.durations.length > 0 ? Math.round(a.total_dur / a.durations.length) : null,
    total_duration_ms: a.total_dur,
  }))

  // Métricas de microtasks
  const mtCompleted = events.filter((e) => e.type === 'microtask_completed').length
  const mtFailed = events.filter((e) => e.type === 'microtask_failed').length
  const mtTotal = mtCompleted + mtFailed
  const success_rate = mtTotal > 0 ? Math.round((mtCompleted / mtTotal) * 100) : 0

  // Contagem de erros
  const errors = events.filter((e) => e.status === 'error' || e.type === 'error_occurred').length

  return {
    project: projectName,
    started_at,
    total_duration_ms,
    phases,
    agents: agents.sort((a, b) => b.executions - a.executions),
    microtasks: { total: mtTotal, completed: mtCompleted, failed: mtFailed, success_rate },
    errors,
    events_total: events.length,
  }
}

export function computeMetricsFromStore(store: EventStore, projectName: string): ProjectMetrics {
  const events = store.list(10_000) // pegar todos
  return computeMetrics(events, projectName)
}
