// ============================================================
// CoreOps CLI — backlog command
// coreops backlog [--json]
// ============================================================

import { Orchestrator } from '../../core/orchestrator.ts'
import { loadConfig } from '../../core/types.ts'

export function backlogCommand(args: string[]): void {
  const jsonMode = args.includes('--json')

  const config = loadConfig()
  const orchestrator = new Orchestrator(config)

  if (!orchestrator.isInitialized()) {
    console.error('Nenhum projeto encontrado. Execute `coreops start` primeiro.')
    process.exit(1)
  }

  try {
    const backlog = orchestrator.getBacklogStore()
    const plan = backlog.getPlan()
    const tasks = backlog.getTasks()
    const microtasks = backlog.getMicrotasks()

    if (jsonMode) {
      console.log(JSON.stringify({ plan, tasks, microtasks }, null, 2))
      return
    }

    if (!plan) {
      console.log('Backlog vazio. Execute a fase PLANNING com `coreops next`.')
      return
    }

    console.log(`\n╔══════════════════════════════════════╗`)
    console.log(`║              Backlog                  ║`)
    console.log(`╚══════════════════════════════════════╝`)
    console.log(``)
    console.log(`Objetivo: ${plan.objective}`)
    console.log(`Estratégia: ${plan.strategy}`)
    console.log(``)
    console.log(`Tarefas (${tasks.length}):`)

    for (const task of tasks) {
      const icon = task.status === 'completed' ? '✓' : task.status === 'failed' ? '✗' : '○'
      console.log(`  ${icon} [${task.priority.toUpperCase()}] ${task.title}`)
      console.log(`     ${task.description}`)
    }

    if (microtasks.length > 0) {
      console.log(`\nMicrotasks (${microtasks.length}):`)
      for (const mt of microtasks) {
        const icon = mt.status === 'completed' ? '✓' : mt.status === 'failed' ? '✗' : '○'
        console.log(`  ${icon} [${mt.id}] ${mt.description}`)
        if (mt.dependencies.length > 0) {
          console.log(`     deps: ${mt.dependencies.join(', ')}`)
        }
      }
    }
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    console.error(`Erro: ${msg}`)
    process.exit(1)
  }
}
