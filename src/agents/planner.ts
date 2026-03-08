// ============================================================
// CoreOps — Planner Agent
// Gera plano de execução estruturado a partir da requisição do usuário
// ============================================================

import { BaseAgent } from './agent.ts'
import type { LLMAdapter } from '../llm/types.ts'
import { parseJsonResponse } from '../llm/anthropic-adapter.ts'
import type { ExecutionPlan, Task } from '../core/types.ts'
import { PipelinePhase } from '../core/types.ts'
import { randomUUID } from 'node:crypto'

export interface PlannerInput {
  project: string
  description: string
  workspace_path: string
}

const SYSTEM_PROMPT = `Você é o Planner Agent do CoreOps — um sistema de orquestração de desenvolvimento de software assistido por IA.

PAPEL: Analisar o objetivo do projeto e gerar um plano de execução estruturado com tarefas claras e executáveis.

REGRAS:
- Gere entre 3 e 10 tarefas
- Cada tarefa deve ser específica, não vaga
- Tarefas devem ser ordenadas por dependência (de baixo nível para alto nível)
- Não escreva código — apenas planeje
- Retorne APENAS JSON válido, sem texto adicional

FORMATO DE SAÍDA:
\`\`\`json
{
  "project": "nome do projeto",
  "objective": "objetivo principal em uma frase",
  "strategy": "estratégia de implementação em 2-3 frases",
  "tasks": [
    {
      "id": "uuid",
      "title": "título da tarefa",
      "description": "descrição detalhada do que precisa ser feito",
      "phase": "CODING",
      "priority": "high",
      "status": "pending",
      "created_at": "ISO timestamp",
      "completed_at": null
    }
  ]
}
\`\`\``

export class PlannerAgent extends BaseAgent<PlannerInput, ExecutionPlan> {
  readonly name = 'planner'

  constructor(private readonly llm: LLMAdapter) {
    super()
  }

  async execute(input: PlannerInput): Promise<ExecutionPlan> {
    const userMessage = `
Projeto: ${input.project}
Descrição: ${input.description}
Workspace: ${input.workspace_path}

Gere um plano de execução detalhado para implementar este projeto.
`

    const response = await this.llm.complete({
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userMessage }],
      max_tokens: 4096,
    })

    const raw = parseJsonResponse<Partial<ExecutionPlan>>(response.content)

    // Garantir IDs e timestamps válidos
    const now = new Date().toISOString()
    const tasks: Task[] = (raw.tasks ?? []).map((t) => ({
      id: t.id ?? randomUUID().substring(0, 8),
      title: t.title ?? 'Tarefa sem título',
      description: t.description ?? '',
      phase: t.phase ?? PipelinePhase.CODING,
      priority: t.priority ?? 'medium',
      status: 'pending' as const,
      created_at: t.created_at ?? now,
      completed_at: null,
    }))

    return {
      project: raw.project ?? input.project,
      objective: raw.objective ?? input.description,
      strategy: raw.strategy ?? '',
      tasks,
    }
  }
}
