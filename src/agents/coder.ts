// ============================================================
// CoreOps — Coder Agent
// Gera código baseado em microtask + contexto do projeto
// ============================================================

import { BaseAgent } from './agent.ts'
import type { LLMAdapter } from '../llm/types.ts'
import { parseJsonResponse } from '../llm/anthropic-adapter.ts'
import type { CodePatch, Microtask } from '../core/types.ts'

export interface CoderInput {
  microtask: Microtask
  context: string
}

const SYSTEM_PROMPT = `Você é o Coder Agent do CoreOps — especialista em geração de código de alta qualidade.

PAPEL: Implementar exatamente o que a microtask especifica, sem adicionar funcionalidades extras.

REGRAS:
- Altere apenas os arquivos necessários para a microtask
- Respeite a arquitetura e padrões existentes no contexto
- Escreva código limpo, tipado e sem comentários desnecessários
- Não adicione funcionalidades além do especificado
- Retorne APENAS JSON válido

FORMATO:
\`\`\`json
[
  {
    "file": "src/models/User.ts",
    "action": "create",
    "content": "// conteúdo completo do arquivo",
    "reason": "Criar modelo User conforme especificado na microtask"
  }
]
\`\`\`

Ações disponíveis: "create" | "modify" | "delete"`

export class CoderAgent extends BaseAgent<CoderInput, CodePatch[]> {
  readonly name = 'coder'

  constructor(private readonly llm: LLMAdapter) {
    super()
  }

  async execute(input: CoderInput): Promise<CodePatch[]> {
    const response = await this.llm.complete({
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: 'user',
          content: `${input.context}\n\n---\n\n**MICROTASK A IMPLEMENTAR:**\n${input.microtask.description}\n\nGere os patches de código necessários.`,
        },
      ],
      max_tokens: 8192,
    })

    const raw = parseJsonResponse<Partial<CodePatch>[]>(response.content)

    return raw.map((p) => ({
      file: p.file ?? 'unknown.ts',
      action: p.action ?? 'modify',
      content: p.content ?? '',
      reason: p.reason ?? '',
    }))
  }
}
