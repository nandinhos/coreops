// ============================================================
// CoreOps — Tester Agent
// Gera testes automaticamente para o código produzido
// ============================================================

import { BaseAgent } from './agent.ts'
import type { LLMAdapter } from '../llm/types.ts'
import { parseJsonResponse } from '../llm/anthropic-adapter.ts'
import type { CodePatch, TestFile, Microtask, Skill } from '../core/types.ts'
import { buildSkillContext } from '../skills/skill-registry.ts'

export interface TesterInput {
  patches: CodePatch[]
  microtask: Microtask
}

const SYSTEM_PROMPT = `Você é o Tester Agent do CoreOps — especialista em geração de testes automatizados.

PAPEL: Gerar testes para o código implementado, usando bun test (compatível com Jest).

TIPOS DE TESTE:
- unit tests para funções e classes
- edge cases (null, undefined, valores extremos)
- casos de erro esperados

REGRAS:
- Use \`import { expect, test, describe } from 'bun:test'\`
- Teste apenas o que foi implementado na microtask
- Mínimo de 3 casos de teste por arquivo de código
- Retorne APENAS JSON válido

FORMATO:
\`\`\`json
[
  {
    "file": "tests/unit/user.test.ts",
    "content": "import { expect, test, describe } from 'bun:test'\n...",
    "test_count": 3
  }
]
\`\`\``

export class TesterAgent extends BaseAgent<TesterInput, TestFile[]> {
  readonly name = 'tester'

  constructor(
    private readonly llm: LLMAdapter,
    private readonly skills: Skill[] = [],
  ) {
    super()
  }

  async execute(input: TesterInput): Promise<TestFile[]> {
    const patchesText = input.patches
      .filter((p) => p.action !== 'delete')
      .map((p) => `### ${p.file}\n\`\`\`\n${p.content}\n\`\`\``)
      .join('\n\n')

    const response = await this.llm.complete({
      system: SYSTEM_PROMPT + buildSkillContext('tester', this.skills),
      messages: [
        {
          role: 'user',
          content: `Microtask: ${input.microtask.description}\n\nCódigo implementado:\n\n${patchesText}\n\nGere os testes para este código.`,
        },
      ],
      max_tokens: 4096,
    })

    const raw = parseJsonResponse<Partial<TestFile>[]>(response.content)

    return raw.map((t) => ({
      file: t.file ?? 'tests/unit/generated.test.ts',
      content: t.content ?? '',
      test_count: t.test_count ?? 0,
    }))
  }
}
