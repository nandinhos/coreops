// ============================================================
// CoreOps — Microtask Generator Agent
// Quebra tarefas em microtasks executáveis com dependências (DAG)
// ============================================================

import { BaseAgent } from './agent.ts'
import type { LLMAdapter } from '../llm/types.ts'
import { parseJsonResponse } from '../llm/anthropic-adapter.ts'
import type { Task, Microtask, ArchitectureSpec } from '../core/types.ts'
import { randomUUID } from 'node:crypto'

const SYSTEM_PROMPT = `Você é o Microtask Generator Agent do CoreOps.

PAPEL: Quebrar uma tarefa de desenvolvimento em microtasks pequenas, concretas e executáveis.

REGRAS:
- Cada microtask deve ser atômica — uma única ação técnica
- Microtasks devem ser independentes ou declarar dependências explícitas
- Use IDs curtos (ex: "mt-001") para referência em dependências
- Gere entre 2 e 8 microtasks por tarefa
- Retorne APENAS JSON válido

FORMATO:
\`\`\`json
[
  {
    "id": "mt-001",
    "task_id": "id-da-tarefa-pai",
    "description": "Criar arquivo src/models/User.ts com interface User",
    "dependencies": [],
    "concurrency_group": "setup",
    "status": "pending",
    "retry_count": 0,
    "created_at": "ISO timestamp",
    "completed_at": null
  },
  {
    "id": "mt-002",
    "task_id": "id-da-tarefa-pai",
    "description": "Criar UserRepository com métodos findById e save",
    "dependencies": ["mt-001"],
    "concurrency_group": "implementation",
    "status": "pending",
    "retry_count": 0,
    "created_at": "ISO timestamp",
    "completed_at": null
  }
]
\`\`\``

export interface MicrotaskGeneratorInput {
  task: Task
  architecture_spec?: ArchitectureSpec | null
}

export class MicrotaskGeneratorAgent extends BaseAgent<MicrotaskGeneratorInput | Task, Microtask[]> {
  readonly name = 'microtask-generator'

  constructor(private readonly llm: LLMAdapter) {
    super()
  }

  async execute(input: MicrotaskGeneratorInput | Task): Promise<Microtask[]> {
    // Suporte a ambos os formatos: Task direto (backward compat) ou MicrotaskGeneratorInput
    const task: Task = 'task' in input ? input.task : input
    const archSpec: ArchitectureSpec | null = 'architecture_spec' in input ? (input.architecture_spec ?? null) : null

    const archContext = archSpec
      ? [
          '\n**Arquitetura do projeto (use estes caminhos e padrões):**',
          'Padrões: ' + archSpec.patterns.join(', '),
          'Convenções: ' + archSpec.conventions.slice(0, 3).join('; '),
          'Abstrações-chave:',
          ...archSpec.key_abstractions.slice(0, 5).map(a => `  - ${a.name} → ${a.file_path}`),
          archSpec.folder_structure ? 'Estrutura:\n' + archSpec.folder_structure : '',
        ].filter(Boolean).join('\n')
      : ''

    const response = await this.llm.complete({
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: 'user',
          content: `Tarefa: ${task.title}\nDescrição: ${task.description}\nID: ${task.id}${archContext}\n\nGere as microtasks para implementar esta tarefa.`,
        },
      ],
      max_tokens: 4096,
    })

    const raw = parseJsonResponse<Partial<Microtask>[]>(response.content)
    const now = new Date().toISOString()

    return raw.map((m, i) => ({
      id: m.id ?? `mt-${String(i + 1).padStart(3, '0')}-${randomUUID().substring(0, 4)}`,
      task_id: m.task_id ?? task.id,
      description: m.description ?? `Microtask ${i + 1}`,
      dependencies: m.dependencies ?? [],
      concurrency_group: m.concurrency_group ?? null,
      status: 'pending' as const,
      retry_count: 0,
      created_at: m.created_at ?? now,
      completed_at: null,
    }))
  }
}
