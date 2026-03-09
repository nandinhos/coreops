// ============================================================
// CoreOps — Reviewer Agent
// Code review automatizado — aprova ou rejeita com feedback
// ============================================================

import { BaseAgent } from './agent.ts'
import type { LLMAdapter } from '../llm/types.ts'
import { parseJsonResponse } from '../llm/anthropic-adapter.ts'
import type { CodePatch, CodeReview, Microtask, Skill } from '../core/types.ts'
import { buildSkillContext } from '../skills/skill-registry.ts'

export interface ReviewerInput {
  patches: CodePatch[]
  microtask: Microtask
}

const SYSTEM_PROMPT = `Você é o Reviewer Agent do CoreOps — revisor técnico especializado.

PAPEL: Revisar patches de código gerados pelo Coder Agent e determinar se estão corretos.

VERIFICA:
- bugs óbvios e erros de lógica
- inconsistências de tipagem TypeScript
- violações de princípios SOLID
- código duplicado desnecessário
- falhas de segurança básicas
- aderência à microtask especificada

REGRAS:
- Seja criterioso mas justo
- Aprove se o código implementa corretamente a microtask sem bugs óbvios
- Rejeite apenas se houver problemas reais, não estéticos
- Retorne APENAS JSON válido

FORMATO:
\`\`\`json
{
  "approved": true,
  "feedback": "Código implementa corretamente a microtask.",
  "issues": [],
  "suggestions": ["Considere adicionar validação de null para X"]
}
\`\`\``

export class ReviewerAgent extends BaseAgent<ReviewerInput, CodeReview> {
  readonly name = 'reviewer'

  constructor(
    private readonly llm: LLMAdapter,
    private readonly skills: Skill[] = [],
  ) {
    super()
  }

  async execute(input: ReviewerInput): Promise<CodeReview> {
    const patchesText = input.patches
      .map((p) => `### ${p.file} (${p.action})\n\`\`\`\n${p.content}\n\`\`\`\nMotivo: ${p.reason}`)
      .join('\n\n')

    const response = await this.llm.complete({
      system: SYSTEM_PROMPT + buildSkillContext('reviewer', this.skills),
      messages: [
        {
          role: 'user',
          content: `Microtask: ${input.microtask.description}\n\nPatches gerados:\n\n${patchesText}\n\nRevise o código acima.`,
        },
      ],
      max_tokens: 2048,
    })

    const raw = parseJsonResponse<Partial<CodeReview>>(response.content)

    return {
      approved: raw.approved ?? false,
      feedback: raw.feedback ?? 'Sem feedback.',
      issues: raw.issues ?? [],
      suggestions: raw.suggestions ?? [],
    }
  }
}
