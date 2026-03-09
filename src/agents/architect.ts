// ============================================================
// CoreOps — ArchitectAgent
// Define a arquitetura técnica do projeto antes da geração de microtasks
// ============================================================

import type { Agent } from './agent.ts'
import type { LLMAdapter } from '../llm/types.ts'
import type { ArchitectureSpec, ExecutionPlan, BrainstormResult } from '../core/types.ts'

export interface ArchitectInput {
  plan: ExecutionPlan
  brainstorm_result?: BrainstormResult | null
  workspace_path: string
}

const SYSTEM_PROMPT = `Você é o ArchitectAgent do CoreOps — especialista em arquitetura de software.

Sua missão: Dado um plano de execução, definir a arquitetura técnica que guiará a implementação.

Você deve definir:
1. Padrões de design a serem aplicados
2. Estrutura de pastas do projeto
3. Decisões técnicas fundamentais (banco de dados, autenticação, cache, etc.)
4. Convenções de nomenclatura e organização
5. Abstrações-chave (classes/módulos principais com responsabilidades e caminhos)

Retorne APENAS um JSON válido com esta estrutura:
{
  "patterns": ["repository-pattern", "dependency-injection", "service-layer"],
  "folder_structure": "src/\\n  controllers/\\n  services/\\n  repositories/\\n  models/",
  "tech_decisions": [
    {
      "concern": "banco de dados",
      "decision": "PostgreSQL via Prisma ORM",
      "rationale": "Schema forte, migrations automáticas, TypeScript nativo"
    }
  ],
  "conventions": [
    "PascalCase para classes e interfaces",
    "camelCase para funções e variáveis",
    "kebab-case para nomes de arquivos"
  ],
  "key_abstractions": [
    {
      "name": "UserRepository",
      "responsibility": "Acesso ao banco de dados para entidade User",
      "file_path": "src/repositories/user.repository.ts"
    }
  ]
}

Regras:
- "patterns" deve ter pelo menos 2 padrões relevantes para o projeto
- "tech_decisions" deve cobrir: banco de dados, autenticação (se aplicável), validação de dados
- "key_abstractions" deve listar as 3-8 classes/módulos mais importantes
- Seja específico sobre caminhos de arquivo (use a stack detectada pelo brainstorm)`

function parseJsonResponse(content: string): ArchitectureSpec {
  const cleaned = content
    .replace(/```json\n?/g, '')
    .replace(/```\n?/g, '')
    .trim()

  const match = cleaned.match(/\{[\s\S]*\}/)
  if (!match) throw new Error('JSON não encontrado na resposta do ArchitectAgent')

  const parsed = JSON.parse(match[0])

  return {
    patterns: Array.isArray(parsed.patterns) ? parsed.patterns : [],
    folder_structure: String(parsed.folder_structure ?? ''),
    tech_decisions: Array.isArray(parsed.tech_decisions)
      ? parsed.tech_decisions.map((d: any) => ({
          concern: String(d.concern ?? ''),
          decision: String(d.decision ?? ''),
          rationale: String(d.rationale ?? ''),
        }))
      : [],
    conventions: Array.isArray(parsed.conventions) ? parsed.conventions : [],
    key_abstractions: Array.isArray(parsed.key_abstractions)
      ? parsed.key_abstractions.map((a: any) => ({
          name: String(a.name ?? ''),
          responsibility: String(a.responsibility ?? ''),
          file_path: String(a.file_path ?? ''),
        }))
      : [],
  }
}

export class ArchitectAgent implements Agent<ArchitectInput, ArchitectureSpec> {
  readonly name = 'architect'
  constructor(private readonly llm: LLMAdapter) {}

  async execute(input: ArchitectInput): Promise<ArchitectureSpec> {
    const br = input.brainstorm_result

    const stackContext = br?.tech_stack_detected?.length
      ? '\n**Stack detectada:** ' + br.tech_stack_detected.join(', ')
      : ''

    const brainstormContext = br
      ? [
          '\n**Contexto do Brainstorm:**',
          'Modo: ' + br.project_mode,
          'Descrição refinada: ' + br.refined_description,
          br.codebase_summary ? 'Codebase existente: ' + br.codebase_summary : '',
          'Restrições: ' + (br.constraints.join('; ') || 'nenhuma'),
        ].filter(Boolean).join('\n')
      : ''

    const tasksText = input.plan.tasks
      .map((t, i) => `${i + 1}. ${t.title}: ${t.description}`)
      .join('\n')

    const userMessage = `
**Projeto:** ${input.plan.project}
**Objetivo:** ${input.plan.objective}
**Estratégia:** ${input.plan.strategy}${stackContext}${brainstormContext}

**Tarefas do plano:**
${tasksText}

**Workspace:** ${input.workspace_path}

Defina a arquitetura técnica para implementar este plano.
`

    const response = await this.llm.complete({
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userMessage }],
      max_tokens: 3072,
    })

    return parseJsonResponse(response.content)
  }
}
