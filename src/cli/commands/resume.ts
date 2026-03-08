// ============================================================
// CoreOps CLI — resume command
// coreops resume
// ============================================================

import { Orchestrator } from '../../core/orchestrator.ts'
import { loadConfig } from '../../core/types.ts'

export async function resumeCommand(): Promise<void> {
  const config = loadConfig()
  const orchestrator = new Orchestrator(config)

  if (!orchestrator.isInitialized()) {
    console.error('Nenhum projeto encontrado. Execute `coreops start` primeiro.')
    process.exit(1)
  }

  try {
    const state = await orchestrator.resumeProject()

    console.log(`\nProjeto "${state.project}" retomado.`)
    console.log(`Fase atual: ${state.current_phase}`)
    console.log(`Tarefas: ${state.tasks_completed}/${state.tasks_total} concluídas`)
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    console.error(`Erro ao retomar projeto: ${msg}`)
    process.exit(1)
  }
}
