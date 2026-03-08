// ============================================================
// CoreOps — Security Agent
// Analisa patches de código contra OWASP Top 10 e vulnerabilidades comuns
// ============================================================

import { BaseAgent } from './agent.ts'
import type { LLMAdapter } from '../llm/types.ts'
import { parseJsonResponse } from '../llm/anthropic-adapter.ts'
import type { CodePatch } from '../core/types.ts'

export type SecuritySeverity = 'low' | 'medium' | 'high' | 'critical'

export interface SecurityIssue {
  file: string
  line?: number
  rule: string
  description: string
  severity: SecuritySeverity
  suggestion: string
}

export interface SecurityReport {
  safe: boolean
  issues: SecurityIssue[]
  severity: SecuritySeverity | null // nível máximo encontrado
  summary: string
}

export interface SecurityInput {
  patches: CodePatch[]
  context?: string
}

const SYSTEM_PROMPT = `Você é o Security Agent do CoreOps — especialista em segurança de aplicações.

PAPEL: Analisar patches de código em busca de vulnerabilidades de segurança.

VERIFICA (OWASP Top 10 e boas práticas):
- A01 Broken Access Control — falta de verificação de permissões
- A02 Cryptographic Failures — secrets hardcoded, hash fraco (MD5/SHA1), HTTP em vez de HTTPS
- A03 Injection — SQL injection, command injection, eval() com input externo
- A04 Insecure Design — validação ausente em inputs externos
- A07 Authentication Failures — senhas em texto plano, JWTs sem validação
- A09 Logging Failures — log de dados sensíveis (senhas, tokens, CPF)
- Outros: prototype pollution, regex DoS (ReDoS), path traversal

REGRAS:
- Foque em vulnerabilidades reais, não teóricas
- Ignore imports e estrutura de projeto (foco no código executável)
- Se o código parece seguro, diga isso claramente
- Retorne APENAS JSON válido

FORMATO:
\`\`\`json
{
  "safe": true,
  "issues": [],
  "severity": null,
  "summary": "Código analisado. Nenhuma vulnerabilidade encontrada."
}
\`\`\`

Para issues:
\`\`\`json
{
  "safe": false,
  "issues": [
    {
      "file": "src/auth.ts",
      "line": 42,
      "rule": "A02-hardcoded-secret",
      "description": "API key hardcoded na string literal",
      "severity": "critical",
      "suggestion": "Use variável de ambiente: process.env.API_KEY"
    }
  ],
  "severity": "critical",
  "summary": "1 vulnerabilidade crítica encontrada."
}
\`\`\``

export class SecurityAgent extends BaseAgent<SecurityInput, SecurityReport> {
  readonly name = 'security'

  constructor(private readonly llm: LLMAdapter) {
    super()
  }

  async execute(input: SecurityInput): Promise<SecurityReport> {
    const patchesText = input.patches
      .map((p) => `### ${p.file} (${p.action})\n\`\`\`\n${p.content}\n\`\`\``)
      .join('\n\n')

    const response = await this.llm.complete({
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: 'user',
          content: `Analise os seguintes patches de código em busca de vulnerabilidades de segurança:\n\n${patchesText}`,
        },
      ],
      max_tokens: 2048,
    })

    const raw = parseJsonResponse<Partial<SecurityReport>>(response.content)

    const issues: SecurityIssue[] = (raw.issues ?? []).map((i) => ({
      file: i.file ?? 'unknown',
      line: i.line,
      rule: i.rule ?? 'unknown',
      description: i.description ?? '',
      severity: i.severity ?? 'low',
      suggestion: i.suggestion ?? '',
    }))

    const severity = computeMaxSeverity(issues)

    return {
      safe: raw.safe ?? issues.length === 0,
      issues,
      severity,
      summary: raw.summary ?? (issues.length === 0 ? 'Nenhuma vulnerabilidade encontrada.' : `${issues.length} issue(s) encontrado(s).`),
    }
  }
}

function computeMaxSeverity(issues: SecurityIssue[]): SecuritySeverity | null {
  if (issues.length === 0) return null
  const order: SecuritySeverity[] = ['low', 'medium', 'high', 'critical']
  let max = 0
  for (const i of issues) {
    const idx = order.indexOf(i.severity)
    if (idx > max) max = idx
  }
  return order[max] ?? null
}
