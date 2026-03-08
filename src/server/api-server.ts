// ============================================================
// CoreOps — Production API Server
// REST HTTP via Bun.serve() — controla o Orchestrator remotamente
// ============================================================

import { Orchestrator } from '../core/orchestrator.ts'
import { loadConfig, PipelinePhase } from '../core/types.ts'
import { computeMetrics } from '../observability/metrics.ts'

export interface ServerOptions {
  port: number
  host?: string
}

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

function notFound(message = 'Not found'): Response {
  return json({ error: message }, 404)
}

function badRequest(message: string): Response {
  return json({ error: message }, 400)
}

function internalError(message: string): Response {
  return json({ error: message }, 500)
}

export function createApiServer(orchestrator: Orchestrator, options: ServerOptions) {
  const { port, host = '0.0.0.0' } = options

  const server = Bun.serve({
    port,
    hostname: host,

    async fetch(req: Request): Promise<Response> {
      const url = new URL(req.url)
      const path = url.pathname
      const method = req.method.toUpperCase()

      // CORS básico para desenvolvimento
      if (method === 'OPTIONS') {
        return new Response(null, {
          status: 204,
          headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type',
          },
        })
      }

      try {
        // GET /
        if (path === '/' && method === 'GET') {
          return json({
            name: 'CoreOps API',
            version: '1.0.0',
            endpoints: [
              'GET  /status',
              'GET  /backlog',
              'POST /next',
              'POST /start',
              'GET  /metrics',
              'GET  /memory',
              'GET  /events',
              'GET  /timeline',
            ],
          })
        }

        // GET /status
        if (path === '/status' && method === 'GET') {
          if (!orchestrator.isInitialized()) {
            return json({ initialized: false, message: 'Nenhum projeto ativo.' }, 200)
          }
          const status = orchestrator.getStatus()
          return json({ initialized: true, ...status })
        }

        // GET /backlog
        if (path === '/backlog' && method === 'GET') {
          const store = orchestrator.getBacklogStore()
          const tasks = store.getTasks()
          const microtasks = store.getMicrotasks()
          return json({ tasks, microtasks, total_tasks: tasks.length, total_microtasks: microtasks.length })
        }

        // POST /next — avança para a próxima fase e a executa
        if (path === '/next' && method === 'POST') {
          if (!orchestrator.isInitialized()) {
            return badRequest('Nenhum projeto inicializado. Use /start ou `coreops start`.')
          }

          const state = await orchestrator.advancePhase()
          const phase = state.current_phase as PipelinePhase

          // Fases com execução automática
          const autoPhases: PipelinePhase[] = [
            PipelinePhase.PLANNING,
            PipelinePhase.TDD,
            PipelinePhase.CODING,
            PipelinePhase.REVIEW,
          ]

          if (autoPhases.includes(phase)) {
            await orchestrator.runPhase(phase)
            return json({ phase, status: 'executed', message: 'Fase ' + phase + ' executada.' })
          }

          return json({ phase, status: 'advanced', message: 'Fase ' + phase + ' requer intervenção manual.' })
        }

        // POST /start — iniciar novo projeto
        if (path === '/start' && method === 'POST') {
          let body: { name?: string; description?: string } = {}
          try {
            body = (await req.json()) as { name?: string; description?: string }
          } catch {
            return badRequest('Body JSON inválido. Envie { "name": "...", "description": "..." }')
          }

          if (!body.name || !body.description) {
            return badRequest('Campos obrigatórios: name, description')
          }

          const state = await orchestrator.startProject(body.name, body.description)
          return json({ message: 'Projeto iniciado.', state }, 201)
        }

        // GET /metrics
        if (path === '/metrics' && method === 'GET') {
          const eventStore = orchestrator.getEventStore()
          const events = eventStore.list(1000)
          const projectName = orchestrator.isInitialized()
            ? orchestrator.getStatus().project
            : 'unknown'
          const metrics = computeMetrics(events, projectName)
          return json(metrics)
        }

        // GET /memory?q=&project=&limit=
        if (path === '/memory' && method === 'GET') {
          const memStore = orchestrator.getMemoryStore()
          const q = url.searchParams.get('q')
          const project = url.searchParams.get('project') ?? undefined
          const limit = parseInt(url.searchParams.get('limit') ?? '20')

          const results = q
            ? memStore.search(q, project)
            : memStore.list(project, limit)

          return json({ count: results.length, results })
        }

        // GET /events?limit=&phase=
        if (path === '/events' && method === 'GET') {
          const eventStore = orchestrator.getEventStore()
          const limit = parseInt(url.searchParams.get('limit') ?? '50')
          const events = eventStore.list(limit)
          return json({ count: events.length, events })
        }

        // GET /timeline
        if (path === '/timeline' && method === 'GET') {
          const eventStore = orchestrator.getEventStore()
          const timeline = eventStore.getTimeline()
          return json({ phases: timeline.length, timeline })
        }

        return notFound('Endpoint não encontrado: ' + method + ' ' + path)
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        return internalError(message)
      }
    },
  })

  return server
}
