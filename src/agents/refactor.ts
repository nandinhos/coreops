// ============================================================
// CoreOps — Refactor Agent
// Sugere e aplica melhorias de refactoring em código aprovado
// ============================================================

import { BaseAgent } from './agent.ts'
import type { LLMAdapter } from '../llm/types.ts'
import { parseJsonResponse } from '../llm/anthropic-adapter.ts'
import type { CodePatch } from '../core/types.ts'

export interface RefactorImprovement {
  file: string
  type: 'rename' | 'extract' | 'simplify' | 'dedup' | 'typing' | 'structure'
  description: string
  impact: 'low' | 'medium' | 'high'
}

export interface RefactorResult {
  refactored: CodePatch[]
  improvements: RefactorImprovement[]
  summary: string
  changed: boolean
}

export interface RefactorInput {
  patches: CodePatch[]
  context?: string
}

const SYSTEM_PROMPT = `Você é o Refactor Agent do CoreOps — especialista em qualidade e legibilidade de código.

PAPEL: Melhorar o código já aprovado sem alterar seu comportamento externo.

APLICA (somente quando o benefício é claro):
- Extrair funções longas em funções menores e nomeadas
- Eliminar código duplicado (DRY)
- Melhorar nomes de variáveis/funções para maior clareza
- Simplificar condicionais complexas
- Adicionar tipos TypeScript onde ausentes e fáceis de inferir
- Remover código morto óbvio

NÃO FAZ:
- Não muda lógica de negócio
- Não adiciona features
- Não refatora se o código já está claro
- Não faz refactoring cosmético (espaços, ponto-e-vírgula)

REGRAS:
- Se o código já está bom, retorne os patches originais sem mudança
- Prefira refactoring de alto impacto e baixo risco
- Retorne APENAS JSON válido

FORMATO:
\`\`\`json
{
  "refactored": [
    {
      "file": "src/auth.ts",
      "action": "modify",
      "content": "// conteúdo completo do arquivo refatorado",
      "reason": "Extraído função validateToken para melhor legibilidade"
    }
  ],
  "improvements": [
    {
      "file": "src/auth.ts",
      "type": "extract",
      "description": "Extraída função validateToken da função login",
      "impact": "medium"
    }
  ],
  "summary": "1 melhoria aplicada.",
  "changed": true
}
\`\`\``

export class RefactorAgent extends BaseAgent<RefactorInput, RefactorResult> {
  readonly name = 'refactor'

  constructor(private readonly llm: LLMAdapter) {
    super()
  }

  async execute(input: RefactorInput): Promise<RefactorResult> {
    const patchesText = input.patches
      .map((p) => `### ${p.file}\n\`\`\`\n${p.content}\n\`\`\``)
      .join('\n\n')

    const contextNote = input.context ? `\nContexto adicional:\n${input.context.substring(0, 2000)}\n` : ''

    const response = await this.llm.complete({
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: 'user',
          content: `Refatore o código abaixo se houver melhorias claras de qualidade:${contextNote}\n\n${patchesText}`,
        },
      ],
      max_tokens: 4096,
    })

    const raw = parseJsonResponse<Partial<RefactorResult>>(response.content)

    const refactored: CodePatch[] = (raw.refactored ?? input.patches).map((p) => ({
      file: p.file ?? 'unknown',
      action: p.action ?? 'modify',
      content: p.content ?? '',
      reason: p.reason ?? 'Refactoring',
    }))

    const improvements: RefactorImprovement[] = (raw.improvements ?? []).map((i) => ({
      file: i.file ?? 'unknown',
      type: i.type ?? 'simplify',
      description: i.description ?? '',
      impact: i.impact ?? 'low',
    }))

    return {
      refactored,
      improvements,
      summary: raw.summary ?? 'Sem alterações de refactoring.',
      changed: raw.changed ?? improvements.length > 0,
    }
  }
}
