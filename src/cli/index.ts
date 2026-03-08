#!/usr/bin/env bun
// ============================================================
// CoreOps CLI — Entrypoint
// coreops <command> [options]
// ============================================================

import { startCommand } from './commands/start.ts'
import { resumeCommand } from './commands/resume.ts'
import { statusCommand } from './commands/status.ts'
import { nextCommand } from './commands/next.ts'
import { backlogCommand } from './commands/backlog.ts'
import { debugCommand } from './commands/debug.ts'
import { memoryCommand } from './commands/memory.ts'
import { metricsCommand } from './commands/metrics.ts'
import { serveCommand } from './commands/serve.ts'
import { initProjectCommand } from './commands/init-project.ts'
import { VERSION } from '../core/version.ts'

const HELP = `
CoreOps v${VERSION} — Orquestração cognitiva de desenvolvimento de software

Uso: coreops <command> [options]

Comandos:
  start             Iniciar novo projeto
  resume            Retomar projeto existente
  status            Ver estado atual do projeto
  next              Avançar para próxima fase do pipeline
  backlog           Listar tarefas e microtasks
  debug [id]        Ver histórico de execução
  metrics           Ver métricas de desempenho do pipeline
  memory            Gerenciar memória persistente entre projetos
  serve             Iniciar servidor REST (API HTTP)
  init              Configurar CoreOps em outro projeto (--mcp para integração MCP)

Opções globais:
  --json            Output em formato JSON
  --verbose         Output detalhado
  --help            Mostrar ajuda

Exemplos:
  coreops start --name "meu-projeto" --description "API REST de usuários"
  coreops status
  coreops next
  coreops backlog --json
  coreops debug
  coreops memory
  coreops memory add --title "Usar JWT" --content "Auth via JWT RS256" --type decision
  coreops memory search "autenticação"
  coreops serve --port 3000
`

async function main() {
  const args = process.argv.slice(2)
  const command = args[0]
  const rest = args.slice(1)

  // Flags globais
  const verbose = args.includes('--verbose') || args.includes('-v')

  if (verbose) {
    process.env['COREOPS_LOG_LEVEL'] = 'debug'
  }

  if (!command || args.includes('--help') || args.includes('-h')) {
    console.log(HELP)
    process.exit(0)
  }

  if (args.includes('--version') || args.includes('-V')) {
    console.log(`coreops v${VERSION}`)
    process.exit(0)
  }

  switch (command) {
    case 'start':
      await startCommand(rest)
      break

    case 'resume':
      await resumeCommand()
      break

    case 'status':
      statusCommand(rest)
      break

    case 'next':
      await nextCommand()
      break

    case 'backlog':
      backlogCommand(rest)
      break

    case 'debug':
      debugCommand(rest)
      break

    case 'metrics':
      metricsCommand(rest)
      break

    case 'memory':
      memoryCommand(rest)
      break

    case 'serve':
      await serveCommand(rest)
      break

    case 'init':
      initProjectCommand(rest)
      break

    default:
      console.error(`Comando desconhecido: ${command}`)
      console.log(`Execute \`coreops --help\` para ver os comandos disponíveis.`)
      process.exit(1)
  }
}

main().catch((error) => {
  console.error('Erro fatal:', error instanceof Error ? error.message : error)
  process.exit(1)
})
