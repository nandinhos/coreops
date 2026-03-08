// ============================================================
// CoreOps CLI — debug command
// coreops debug [--timeline] [--events] [--tail N] [ref_id]
// ============================================================

import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { createProjectEventStore, type PhaseTimeline } from '../../debug/event-store.ts'

export function debugCommand(args: string[]): void {
  const cwd = process.cwd()
  const historyPath = join(cwd, '.coreops', 'history', 'history.log')
  const isTimeline = args.includes('--timeline') || args.includes('-t')
  const isEvents = args.includes('--events') || args.includes('-e')
  const isJson = args.includes('--json')
  const tailIdx = args.indexOf('--tail')
  const tailN = tailIdx !== -1 ? parseInt(args[tailIdx + 1] ?? '50', 10) : null
  const refId = args.find((a) => !a.startsWith('-') && a !== args[tailIdx + 1])

  if (!existsSync(join(cwd, '.coreops'))) {
    console.error('Nenhum projeto encontrado. Execute `coreops start` primeiro.')
    process.exit(1)
  }

  if (isTimeline) {
    renderTimeline(cwd, isJson)
    return
  }

  if (isEvents) {
    renderEvents(cwd, refId, isJson)
    return
  }

  if (refId) {
    renderEvents(cwd, refId, isJson)
    return
  }

  // Default: histórico de texto com tail
  renderHistory(historyPath, tailN ?? 50)
}

// ----------------------------------------------------------
// Renderers
// ----------------------------------------------------------

function renderHistory(historyPath: string, lines: number): void {
  if (!existsSync(historyPath)) {
    console.log('Nenhum histórico disponível ainda.')
    return
  }

  const content = readFileSync(historyPath, 'utf-8')
  const all = content.split('\n').filter(Boolean)
  const recent = all.slice(-lines)

  console.log('\n╔══════════════════════════════════════╗')
  console.log('║      Debug — Histórico (' + lines + ' linhas)      ║')
  console.log('╚══════════════════════════════════════╝\n')

  for (const line of recent) {
    console.log(colorLine(line))
  }
}

function renderTimeline(cwd: string, isJson: boolean): void {
  const eventsDb = join(cwd, '.coreops', 'debug', 'events.db')

  if (!existsSync(eventsDb)) {
    console.log('Nenhum evento registrado ainda. Execute `coreops next` para iniciar o pipeline.')
    return
  }

  const store = createProjectEventStore(cwd)
  const timeline = store.getTimeline()
  store.close()

  if (isJson) {
    console.log(JSON.stringify(timeline, null, 2))
    return
  }

  console.log('\n╔══════════════════════════════════════╗')
  console.log('║         Debug — Timeline              ║')
  console.log('╚══════════════════════════════════════╝\n')

  for (const pt of timeline) {
    renderPhaseBlock(pt)
  }
}

function renderPhaseBlock(pt: PhaseTimeline): void {
  const started = new Date(pt.started_at).toISOString().replace('T', ' ').substring(0, 19)
  const durationStr = pt.duration_ms != null ? ' [' + formatDuration(pt.duration_ms) + ']' : ''
  const statusIcon = pt.errors.length > 0 ? '\x1b[31m✗\x1b[0m' : pt.ended_at ? '\x1b[32m✓\x1b[0m' : '\x1b[33m⟳\x1b[0m'

  console.log(statusIcon + ' \x1b[1m' + pt.phase + '\x1b[0m  ' + started + durationStr)

  for (const m of pt.microtasks) {
    const icon = m.status === 'ok' ? '  \x1b[32m✓\x1b[0m' : '  \x1b[31m✗\x1b[0m'
    console.log(icon + ' [' + m.id + '] ' + m.description.substring(0, 60))
  }

  for (const a of pt.agents) {
    const icon = a.status === 'ok' ? '  \x1b[34m⊙\x1b[0m' : '  \x1b[31m⊗\x1b[0m'
    const dur = a.duration_ms != null ? ' (' + formatDuration(a.duration_ms) + ')' : ''
    console.log(icon + ' agent:' + a.name + dur)
  }

  for (const err of pt.errors.slice(0, 3)) {
    console.log('  \x1b[31m! ' + err.substring(0, 80) + '\x1b[0m')
  }

  console.log()
}

function renderEvents(cwd: string, refId: string | undefined, isJson: boolean): void {
  const eventsDb = join(cwd, '.coreops', 'debug', 'events.db')

  if (!existsSync(eventsDb)) {
    console.log('Nenhum evento registrado ainda.')
    return
  }

  const store = createProjectEventStore(cwd)
  const events = refId ? store.getByRef(refId) : store.list(100)
  store.close()

  if (isJson) {
    console.log(JSON.stringify(events, null, 2))
    return
  }

  const title = refId ? 'Eventos: ' + refId : 'Eventos recentes'
  console.log('\n╔══════════════════════════════════════╗')
  console.log('║  Debug — ' + title.padEnd(28) + '║')
  console.log('╚══════════════════════════════════════╝\n')

  if (events.length === 0) {
    console.log('Nenhum evento encontrado.')
    return
  }

  for (const e of events) {
    const ts = new Date(e.timestamp).toISOString().replace('T', ' ').substring(0, 19)
    const status = e.status ? ' [' + e.status + ']' : ''
    const dur = e.duration_ms != null ? ' ' + formatDuration(e.duration_ms) : ''
    const ref = e.ref_id ? ' ref:' + e.ref_id : ''
    console.log('  ' + ts + ' ' + colorEvent(e.type) + status + ref + dur)
  }
}

// ----------------------------------------------------------
// Helpers
// ----------------------------------------------------------

function formatDuration(ms: number): string {
  if (ms < 1000) return ms + 'ms'
  if (ms < 60_000) return (ms / 1000).toFixed(1) + 's'
  return Math.floor(ms / 60_000) + 'm ' + Math.floor((ms % 60_000) / 1000) + 's'
}

function colorLine(line: string): string {
  if (line.includes('ERROR')) return '\x1b[31m' + line + '\x1b[0m'
  if (line.includes('STATE CHANGE')) return '\x1b[33m' + line + '\x1b[0m'
  if (line.includes('COMPLETED')) return '\x1b[32m' + line + '\x1b[0m'
  if (line.includes('STARTED')) return '\x1b[36m' + line + '\x1b[0m'
  return line
}

function colorEvent(type: string): string {
  if (type.includes('failed') || type.includes('error')) return '\x1b[31m' + type + '\x1b[0m'
  if (type.includes('completed') || type.includes('ok')) return '\x1b[32m' + type + '\x1b[0m'
  if (type.includes('started')) return '\x1b[36m' + type + '\x1b[0m'
  return type
}
