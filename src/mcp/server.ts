// ============================================================
// CoreOps — MCP Server
// Interface Standard para Controle do Orquestrador
// ============================================================

import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js'
import { appendFileSync } from 'node:fs'
import { Orchestrator } from '../core/orchestrator.ts'
import { loadConfig } from '../core/types.ts'
import { VERSION } from '../core/version.ts'

const config = loadConfig()
const orchestrator = new Orchestrator(config)

const server = new Server(
  {
    name: 'coreops',
    version: VERSION,
  },
  {
    capabilities: {
      tools: {},
    },
  },
)

// ----------------------------------------------------------
// Definição das Ferramentas
// ----------------------------------------------------------

const TOOLS = [
  { name: 'coreops_status', description: 'Status do projeto', inputSchema: { type: 'object', properties: {} } },
  { name: 'coreops_start', description: 'Inicia projeto', inputSchema: { type: 'object', properties: { name: { type: 'string', description: 'Nome do projeto' }, description: { type: 'string', description: 'Descrição' } }, required: ['name', 'description'] } },
  {
    name: 'coreops_next',
    description: 'Avança fase do pipeline. Se retornar requires_input: true, use coreops_answer para responder as perguntas antes de avançar.',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'coreops_answer',
    description: 'Responde às perguntas do checkpoint para desbloquear o avanço de fase. Para checkpoints MANUAIS (artesanato), passe confirm: true para confirmar explicitamente.',
    inputSchema: {
      type: 'object',
      properties: {
        answers: {
          type: 'object',
          description: 'Mapa de id da pergunta → resposta. Ex: { "q1": "PostgreSQL", "q2": "JWT" }',
          additionalProperties: { type: 'string' },
        },
        confirm: {
          type: 'boolean',
          description: 'OBRIGATÓRIO para checkpoints manuais: confirme explicitamente que você (usuário) está respondendo, não o LLM automaticamente.',
        },
      },
      required: ['answers'],
    },
  },
  { name: 'coreops_backlog', description: 'Exibe o backlog de tarefas', inputSchema: { type: 'object', properties: {} } },
  { name: 'coreops_metrics', description: 'Exibe métricas do projeto', inputSchema: { type: 'object', properties: {} } },
  { name: 'coreops_events', description: 'Lista eventos recentes', inputSchema: { type: 'object', properties: { limit: { type: 'number', description: 'Qtd de eventos' } } } },
  { name: 'coreops_memory_add', description: 'Adiciona memória global', inputSchema: { type: 'object', properties: { title: { type: 'string' }, content: { type: 'string' }, type: { type: 'string' }, project: { type: 'string' } }, required: ['title', 'content', 'type'] } },
  { name: 'coreops_memory_search', description: 'Busca memória global', inputSchema: { type: 'object', properties: { query: { type: 'string' }, project: { type: 'string' } }, required: ['query'] } },
]

// ----------------------------------------------------------
// Handlers
// ----------------------------------------------------------

function ok(data: unknown) {
  return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] }
}

function err(message: string) {
  return { content: [{ type: 'text', text: `Erro: ${message}` }], isError: true }
}

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: TOOLS,
}))

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args = {} } = request.params

  try {
    switch (name) {
      case 'coreops_status':
        if (!orchestrator.isInitialized()) {
          return ok({ initialized: false, message: 'Projeto não inicializado.' })
        }
        return ok(orchestrator.getStatus())

      case 'coreops_start': {
        const { name: pName, description } = request.params.arguments as any
        const state = await orchestrator.startProject(pName, description)
        return { content: [{ type: 'text', text: JSON.stringify(state, null, 2) }] }
      }

      case 'coreops_next': {
        const result = await orchestrator.next()
        return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] }
      }

      case 'coreops_answer': {
        const { answers, confirm } = (request.params.arguments || {}) as { answers: Record<string, string>; confirm?: boolean }
        const resolution = orchestrator.resolveCheckpoint(answers, confirm)
        return { content: [{ type: 'text', text: JSON.stringify(resolution, null, 2) }] }
      }

      case 'coreops_backlog':
        return { content: [{ type: 'text', text: JSON.stringify(orchestrator.getBacklog(), null, 2) }] }

      case 'coreops_metrics':
        return { content: [{ type: 'text', text: JSON.stringify(orchestrator.getMetrics(), null, 2) }] }

      case 'coreops_events': {
        const { limit } = (request.params.arguments || {}) as any
        return { content: [{ type: 'text', text: JSON.stringify(orchestrator.getRecentEvents(limit), null, 2) }] }
      }

      case 'coreops_memory_add': {
        const { title, content, type, project } = request.params.arguments as any
        await orchestrator.addMemory(title, content, type, project)
        return { content: [{ type: 'text', text: 'Memória adicionada com sucesso.' }] }
      }

      case 'coreops_memory_search': {
        const { query, project } = request.params.arguments as any
        const results = await orchestrator.searchMemory(query, project)
        return { content: [{ type: 'text', text: JSON.stringify(results, null, 2) }] }
      }

      default:
        return err(`Ferramenta desconhecida: ${name}`)
    }
  } catch (e) {
    return err(String(e))
  }
})

async function main() {
  const transport = new StdioServerTransport()
  await server.connect(transport)
}

main().catch((e) => {
  appendFileSync('/tmp/coreops_fatal.log', `[${new Date().toISOString()}] FATAL: ${String(e)}\n`)
  process.exit(1)
})
