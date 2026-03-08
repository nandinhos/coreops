// ============================================================
// CoreOps CLI — metrics command
// coreops metrics [--json]
// ============================================================

import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { createProjectEventStore } from '../../debug/event-store.ts'
import { computeMetricsFromStore, type ProjectMetrics } from '../../observability/metrics.ts'
import { StateStore } from '../../workspace/state-store.ts'
import { WorkspaceManager } from '../../workspace/workspace-manager.ts'

export function metricsCommand(args: string[]): void {
  const cwd = process.cwd()
  const isJson = args.includes('--json')

  if (!existsSync(join(cwd, '.coreops'))) {
    console.error('Nenhum projeto encontrado. Execute `coreops start` primeiro.')
    process.exit(1)
  }

  // Obter nome do projeto
  const workspace = new WorkspaceManager(cwd)
  const stateStore = new StateStore(workspace)
  const state = stateStore.read()
  const projectName = state?.project ?? 'unknown'

  const eventsDb = join(cwd, '.coreops', 'debug', 'events.db')

  if (!existsSync(eventsDb)) {
    console.log('Nenhuma métrica disponível ainda. Execute `coreops next` para iniciar o pipeline.')
    return
  }

  const store = createProjectEventStore(cwd)
  const metrics = computeMetricsFromStore(store, projectName)
  store.close()

  if (isJson) {
    console.log(JSON.stringify(metrics, null, 2))
    return
  }

  renderMetrics(metrics)
}

function renderMetrics(m: ProjectMetrics): void {
  console.log('\n╔══════════════════════════════════════════╗')
  console.log('║         Observability — Métricas          ║')
  console.log('╚══════════════════════════════════════════╝\n')

  console.log('Projeto:     ' + m.project)
  if (m.started_at) {
    console.log('Iniciado:    ' + new Date(m.started_at).toISOString().replace('T', ' ').substring(0, 19))
  }
  if (m.total_duration_ms != null) {
    console.log('Duração:     ' + formatDuration(m.total_duration_ms))
  }
  console.log('Eventos:     ' + m.events_total)
  console.log('Erros:       ' + (m.errors > 0 ? '\x1b[31m' + m.errors + '\x1b[0m' : '0'))

  // Microtasks
  console.log('\n── Microtasks ─────────────────────────────')
  console.log('  Total:     ' + m.microtasks.total)
  console.log('  Completas: \x1b[32m' + m.microtasks.completed + '\x1b[0m')
  console.log('  Falhas:    \x1b[31m' + m.microtasks.failed + '\x1b[0m')
  if (m.microtasks.total > 0) {
    const bar = renderBar(m.microtasks.success_rate, 30)
    console.log('  Taxa:      ' + bar + ' ' + m.microtasks.success_rate + '%')
  }

  // Fases
  if (m.phases.length > 0) {
    console.log('\n── Fases ──────────────────────────────────')
    for (const p of m.phases) {
      const icon = p.status === 'completed' ? '\x1b[32m✓\x1b[0m' : p.status === 'in_progress' ? '\x1b[33m⟳\x1b[0m' : ' '
      const dur = p.duration_ms != null ? ' ' + formatDuration(p.duration_ms) : ''
      console.log('  ' + icon + ' ' + p.phase.padEnd(16) + dur)
    }
  }

  // Agentes
  if (m.agents.length > 0) {
    console.log('\n── Agentes ────────────────────────────────')
    console.log('  ' + 'Agente'.padEnd(20) + 'Exec'.padStart(6) + ' Ok'.padStart(5) + ' Err'.padStart(5) + ' Avg'.padStart(9))
    console.log('  ' + '─'.repeat(50))
    for (const a of m.agents) {
      const avg = a.avg_duration_ms != null ? formatDuration(a.avg_duration_ms) : '─'
      const errColor = a.failures > 0 ? '\x1b[31m' + a.failures + '\x1b[0m' : '0'
      const ok = '\x1b[32m' + a.successes + '\x1b[0m'
      console.log(
        '  ' + a.name.padEnd(20) +
        String(a.executions).padStart(6) +
        (' ' + ok).padStart(5) +
        (' ' + errColor).padStart(5) +
        avg.padStart(9),
      )
    }
  }

  console.log()
}

function formatDuration(ms: number): string {
  if (ms < 1000) return ms + 'ms'
  if (ms < 60_000) return (ms / 1000).toFixed(1) + 's'
  return Math.floor(ms / 60_000) + 'm' + Math.floor((ms % 60_000) / 1000) + 's'
}

function renderBar(pct: number, width: number): string {
  const filled = Math.round((pct / 100) * width)
  const empty = width - filled
  return '\x1b[32m' + '█'.repeat(filled) + '\x1b[90m' + '░'.repeat(empty) + '\x1b[0m'
}
