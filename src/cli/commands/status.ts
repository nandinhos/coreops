// ============================================================
// CoreOps CLI — status command
// coreops status [--json]
// ============================================================

import { Orchestrator } from '../../core/orchestrator.ts'
import { loadConfig } from '../../core/types.ts'

export function statusCommand(args: string[]): void {
  const jsonMode = args.includes('--json')

  const config = loadConfig()
  const orchestrator = new Orchestrator(config)

  if (!orchestrator.isInitialized()) {
    console.error('Nenhum projeto encontrado. Execute `coreops start` primeiro.')
    process.exit(1)
  }

  try {
    const status = orchestrator.getStatus()

    if (jsonMode) {
      console.log(JSON.stringify(status, null, 2))
      return
    }

    console.log(`\n╔══════════════════════════════════════╗`)
    console.log(`║           CoreOps Status              ║`)
    console.log(`╚══════════════════════════════════════╝`)
    console.log(``)
    console.log(`Projeto:        ${status.project}`)
    console.log(`Descrição:      ${status.description}`)
    console.log(`LLM:            ${status.llm_source ?? 'desconhecido'}`)
    console.log(`Fase atual:     ${status.current_phase}`)
    console.log(`Próxima fase:   ${status.next_phase ?? 'Concluído'}`)
    console.log(``)
    console.log(`Tarefas:        ${status.tasks_completed}/${status.tasks_total} concluídas`)
    console.log(`Pendentes:      ${status.tasks_pending}`)
    console.log(``)

    if (status.phases_completed.length > 0) {
      console.log(`Fases concluídas:`)
      for (const phase of status.phases_completed) {
        console.log(`  ✓ ${phase}`)
      }
    }

    console.log(``)
    console.log(`Fases pendentes:`)
    for (const phase of status.phases_pending) {
      const isCurrent = phase === status.next_phase
      console.log(`  ${isCurrent ? '→' : ' '} ${phase}`)
    }

    console.log(``)
    if (status.context) {
      const ctx = status.context
      console.log(`Contexto:`)
      if (ctx.project_mode) {
        console.log(`  Modo:        ${ctx.project_mode}`)
      }
      if (ctx.tech_stack && ctx.tech_stack.length > 0) {
        console.log(`  Stack:       ${ctx.tech_stack.join(', ')}`)
      }
      if (ctx.plan_objective) {
        console.log(`  Objetivo:    ${ctx.plan_objective}`)
      } else if (ctx.refined_description) {
        console.log(`  Descrição:   ${ctx.refined_description}`)
      }
      if (ctx.acceptance_criteria && ctx.acceptance_criteria.length > 0) {
        console.log(`  Critérios:`)
        for (const c of ctx.acceptance_criteria) {
          console.log(`    • ${c}`)
        }
      }
      console.log(``)
    }

    if (status.pending_checkpoint) {
      const cp = status.pending_checkpoint
      console.log(`⚠️  Checkpoint pendente (${cp.phase}):`)
      for (const q of cp.questions) {
        const answered = cp.answers[q.id]
        const mark = answered ? '✓' : '?'
        console.log(`  ${mark} [${q.id}] ${q.question}`)
        if (answered) console.log(`       → ${answered}`)
      }
      console.log(``)
    }

    console.log(`Iniciado em: ${new Date(status.started_at).toLocaleString('pt-BR')}`)
    console.log(`Atualizado:  ${new Date(status.last_updated).toLocaleString('pt-BR')}`)
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    console.error(`Erro: ${msg}`)
    process.exit(1)
  }
}
