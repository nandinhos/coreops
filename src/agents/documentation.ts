// ============================================================
// CoreOps — Documentation Agent
// Gera JSDoc/TSDoc para funções e classes em código aprovado
// ============================================================

import { BaseAgent } from './agent.ts'
import type { LLMAdapter } from '../llm/types.ts'
import { parseJsonResponse } from '../llm/anthropic-adapter.ts'
import type { CodePatch } from '../core/types.ts'

export interface DocCoverage {
  file: string
  functions_documented: number
  functions_total: number
  coverage_pct: number
}

export interface DocumentationResult {
  documented: CodePatch[]
  coverage: DocCoverage[]
  summary: string
}

export interface DocumentationInput {
  patches: CodePatch[]
}

const SYSTEM_PROMPT = `Você é o Documentation Agent do CoreOps — especialista em documentação técnica.

PAPEL: Adicionar JSDoc/TSDoc a funções, classes e interfaces em TypeScript/JavaScript.

ADICIONA:
- @param com tipo e descrição para cada parâmetro
- @returns com tipo e descrição do retorno
- @throws para erros esperados
- Descrição de uma linha no topo da função
- @example quando o uso não for óbvio

NÃO FAZ:
- Não documenta getters/setters simples
- Não documenta código auto-explicativo (ex: getId())
- Não adiciona comentários inline no corpo das funções
- Não modifica a lógica do código

REGRAS:
- Documente apenas funções/classes públicas e complexas
- Use português para as descrições
- Se o arquivo já tem boa documentação, retorne-o sem mudanças
- Retorne APENAS JSON válido

FORMATO:
\`\`\`json
{
  "documented": [
    {
      "file": "src/auth.ts",
      "action": "modify",
      "content": "// arquivo completo com JSDoc adicionado",
      "reason": "Adicionado JSDoc às funções públicas"
    }
  ],
  "coverage": [
    {
      "file": "src/auth.ts",
      "functions_documented": 3,
      "functions_total": 5,
      "coverage_pct": 60
    }
  ],
  "summary": "3 funções documentadas em 1 arquivo."
}
\`\`\``

export class DocumentationAgent extends BaseAgent<DocumentationInput, DocumentationResult> {
  readonly name = 'documentation'

  constructor(private readonly llm: LLMAdapter) {
    super()
  }

  async execute(input: DocumentationInput): Promise<DocumentationResult> {
    // Filtrar apenas arquivos de código (não testes)
    const codePatches = input.patches.filter(
      (p) => !p.file.includes('.test.') && !p.file.includes('.spec.') && p.action !== 'delete',
    )

    if (codePatches.length === 0) {
      return { documented: input.patches, coverage: [], summary: 'Nenhum arquivo de código para documentar.' }
    }

    const patchesText = codePatches
      .map((p) => `### ${p.file}\n\`\`\`typescript\n${p.content}\n\`\`\``)
      .join('\n\n')

    const response = await this.llm.complete({
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: 'user',
          content: `Adicione JSDoc/TSDoc às funções públicas nos arquivos abaixo:\n\n${patchesText}`,
        },
      ],
      max_tokens: 4096,
    })

    const raw = parseJsonResponse<Partial<DocumentationResult>>(response.content)

    const documented: CodePatch[] = (raw.documented ?? codePatches).map((p) => ({
      file: p.file ?? 'unknown',
      action: p.action ?? 'modify',
      content: p.content ?? '',
      reason: p.reason ?? 'Documentação adicionada',
    }))

    const coverage: DocCoverage[] = (raw.coverage ?? []).map((c) => ({
      file: c.file ?? 'unknown',
      functions_documented: c.functions_documented ?? 0,
      functions_total: c.functions_total ?? 0,
      coverage_pct: c.coverage_pct ?? 0,
    }))

    return {
      documented,
      coverage,
      summary: raw.summary ?? `${documented.length} arquivo(s) documentado(s).`,
    }
  }
}
