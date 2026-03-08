// ============================================================
// CoreOps CLI — serve command
// coreops serve [--port 3000] [--host 0.0.0.0]
// ============================================================

import { Orchestrator } from '../../core/orchestrator.ts'
import { loadConfig } from '../../core/types.ts'
import { createApiServer } from '../../server/api-server.ts'

export async function serveCommand(args: string[]): Promise<void> {
  const portArg = args.find((_, i) => args[i - 1] === '--port')
  const hostArg = args.find((_, i) => args[i - 1] === '--host')
  const port = parseInt(portArg ?? process.env['COREOPS_PORT'] ?? '3000')
  const host = hostArg ?? process.env['COREOPS_HOST'] ?? '0.0.0.0'

  if (isNaN(port) || port < 1 || port > 65535) {
    console.error('Porta inválida: ' + portArg)
    process.exit(1)
  }

  const config = loadConfig()
  const orchestrator = new Orchestrator(config)

  const server = createApiServer(orchestrator, { port, host })

  console.log(`\n╔══════════════════════════════════════╗`)
  console.log(`║        CoreOps API Server             ║`)
  console.log(`╚══════════════════════════════════════╝`)
  console.log(``)
  console.log(`Endereço:  http://${host === '0.0.0.0' ? 'localhost' : host}:${port}`)
  console.log(``)
  console.log(`Endpoints disponíveis:`)
  console.log(`  GET  /          — informações da API`)
  console.log(`  GET  /status    — status do projeto atual`)
  console.log(`  GET  /backlog   — tarefas e microtasks`)
  console.log(`  POST /start     — iniciar projeto { name, description }`)
  console.log(`  POST /next      — avançar e executar próxima fase`)
  console.log(`  GET  /metrics   — métricas de execução`)
  console.log(`  GET  /memory    — busca na memória (?q=termo)`)
  console.log(`  GET  /events    — eventos recentes (?limit=50)`)
  console.log(`  GET  /timeline  — timeline por fase`)
  console.log(``)
  console.log(`Pressione Ctrl+C para encerrar.`)

  // Graceful shutdown
  process.on('SIGINT', () => {
    console.log('\n[CoreOps] Encerrando servidor...')
    server.stop()
    process.exit(0)
  })

  process.on('SIGTERM', () => {
    server.stop()
    process.exit(0)
  })
}
