// ============================================================
// CoreOps CLI — next command
// coreops next
// Avança para próxima fase e executa automação disponível
// ============================================================

import { Orchestrator } from '../../core/orchestrator.ts'
import { loadConfig } from '../../core/types.ts'

export async function nextCommand(): Promise<void> {
  const config = loadConfig()
  const orchestrator = new Orchestrator(config)

  if (!orchestrator.isInitialized()) {
    console.error('Nenhum projeto encontrado. Execute `coreops start` primeiro.')
    process.exit(1)
  }

  try {
    const status = orchestrator.getStatus()

    if (!status.next_phase) {
      console.log('Pipeline concluído! Projeto em estado DONE.')
      return
    }

    console.log(`Avançando: ${status.current_phase} → ${status.next_phase}`)

    // Avançar estado
    const newState = await orchestrator.advancePhase()

    // Executar automação da fase
    await orchestrator.runPhase(newState.current_phase)

    console.log(`\nFase ${newState.current_phase} concluída.`)
    console.log(`Execute \`coreops status\` para ver o estado atual.`)
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    console.error(`Erro: ${msg}`)
    process.exit(1)
  }
}
