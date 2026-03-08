// ============================================================
// CoreOps CLI — start command
// coreops start [--name <n>] [--description <d>]
// ============================================================

import * as readline from 'readline'
import { Orchestrator } from '../../core/orchestrator.ts'
import { loadConfig } from '../../core/types.ts'

export async function startCommand(args: string[]): Promise<void> {
  const rawName = getArg(args, '--name') ?? getArg(args, '-n')
  const rawDesc = getArg(args, '--description') ?? getArg(args, '-d')

  const name = rawName ?? (await prompt('Nome do projeto: '))
  if (!name.trim()) {
    console.error('Erro: Nome do projeto é obrigatório.')
    process.exit(1)
  }

  const descInput = rawDesc ?? (await prompt(`Descrição (Enter para usar "${name}"): `))
  const description = descInput.trim() || name.trim()

  const config = loadConfig()
  const orchestrator = new Orchestrator(config)

  if (orchestrator.isInitialized()) {
    console.error('Projeto já inicializado. Use `coreops resume` para continuar.')
    process.exit(1)
  }

  try {
    const state = await orchestrator.startProject(name.trim(), description.trim())

    console.log(`\nProjeto "${state.project}" iniciado com sucesso!`)
    console.log(`Fase atual: ${state.current_phase}`)
    console.log(`\nPróximos passos:`)
    console.log(`  coreops status    — ver estado atual`)
    console.log(`  coreops next      — avançar para próxima fase`)
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    console.error(`Erro ao iniciar projeto: ${msg}`)
    process.exit(1)
  }
}

function getArg(args: string[], flag: string): string | undefined {
  const idx = args.indexOf(flag)
  if (idx !== -1 && idx + 1 < args.length) {
    return args[idx + 1]
  }
  const entry = args.find((a) => a.startsWith(`${flag}=`))
  return entry?.split('=').slice(1).join('=')
}

function prompt(question: string): Promise<string> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close()
      resolve(answer)
    })
  })
}
