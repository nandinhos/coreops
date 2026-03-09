// ============================================================
// CoreOps — Debugger Agent
// Analisa erros e propõe correções quando o Validator falha
// ============================================================

import { BaseAgent } from './agent.ts'
import type { LLMAdapter } from '../llm/types.ts'
import { parseJsonResponse } from '../llm/anthropic-adapter.ts'
import type { CodePatch, DebugAnalysis, Microtask } from '../core/types.ts'

export interface PriorSolution {
  root_cause: string
  fix_description: string
  occurrence_count: number
}

export interface DebuggerInput {
  errors: string[]
  patches: CodePatch[]
  microtask: Microtask
  prior_solution?: PriorSolution | null
}

const SYSTEM_PROMPT = `Você é o Debugger Agent do CoreOps — especialista em diagnóstico e correção de erros.

PAPEL: Analisar erros de validação/teste e propor correções precisas no código.

PROCESSO:
1. Identificar a causa raiz do erro
2. Determinar qual arquivo precisa ser corrigido
3. Gerar patch de correção mínimo e preciso

REGRAS:
- Corrija apenas o necessário para resolver o erro
- Não adicione funcionalidades extras
- Prefira correções simples e diretas
- Retorne APENAS JSON válido

FORMATO:
\`\`\`json
{
  "root_cause": "Variável user pode ser undefined antes de ser acessada",
  "analysis": "O erro ocorre na linha 42 porque...",
  "fix": [
    {
      "file": "src/services/auth.ts",
      "action": "modify",
      "content": "// arquivo corrigido completo",
      "reason": "Adicionado null check antes de acessar user.id"
    }
  ]
}
\`\`\``

export class DebuggerAgent extends BaseAgent<DebuggerInput, DebugAnalysis> {
  readonly name = 'debugger'

  constructor(private readonly llm: LLMAdapter) {
    super()
  }

  async execute(input: DebuggerInput): Promise<DebugAnalysis> {
    const errorsText = input.errors.join('\n')
    const patchesText = input.patches
      .map((p) => `### ${p.file}\n\`\`\`\n${p.content}\n\`\`\``)
      .join('\n\n')

    const priorContext = input.prior_solution
      ? [
          '\n**SOLUÇÃO ANTERIOR PARA ERRO SIMILAR (aplicada ' + input.prior_solution.occurrence_count + 'x):**',
          'Causa raiz: ' + input.prior_solution.root_cause,
          'Como foi resolvido: ' + input.prior_solution.fix_description,
          'Considere se esta solução se aplica antes de propor uma nova.',
          '',
        ].join('\n')
      : ''

    const response = await this.llm.complete({
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: 'user',
          content: `Microtask: ${input.microtask.description}\n\nErros encontrados:\n\`\`\`\n${errorsText}\n\`\`\`\n\nCódigo atual:\n\n${patchesText}${priorContext}\n\nAnalise e corrija os erros.`,
        },
      ],
      max_tokens: 4096,
    })

    const raw = parseJsonResponse<Partial<DebugAnalysis>>(response.content)

    return {
      root_cause: raw.root_cause ?? 'Causa raiz não identificada',
      analysis: raw.analysis ?? '',
      fix: (raw.fix ?? []).map((p) => ({
        file: p.file ?? 'unknown.ts',
        action: p.action ?? 'modify',
        content: p.content ?? '',
        reason: p.reason ?? '',
      })),
    }
  }
}
