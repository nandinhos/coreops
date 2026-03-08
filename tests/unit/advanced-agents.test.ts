// ============================================================
// CoreOps — Advanced Agents Unit Tests (Phase 8)
// Testa estrutura e contratos dos agentes sem chamar o LLM
// ============================================================

import { describe, test, expect } from 'bun:test'
import { SecurityAgent } from '../../src/agents/security.ts'
import { RefactorAgent } from '../../src/agents/refactor.ts'
import { DocumentationAgent } from '../../src/agents/documentation.ts'
import type { LLMAdapter, LLMResponse } from '../../src/llm/types.ts'
import type { CodePatch } from '../../src/core/types.ts'

// Mock LLM que retorna JSON fixo
function mockLLM(responseContent: string): LLMAdapter {
  return {
    complete: async () => ({ content: responseContent, model: 'mock', input_tokens: 10, output_tokens: 10 } satisfies LLMResponse),
  }
}

const samplePatch: CodePatch = {
  file: 'src/auth.ts',
  action: 'create',
  content: `export function login(user: string, pass: string) {\n  return user === 'admin' && pass === '1234'\n}`,
  reason: 'Criar função de login',
}

// ----------------------------------------------------------
// SecurityAgent
// ----------------------------------------------------------

describe('SecurityAgent', () => {
  test('retorna safe=true quando nenhuma issue encontrada', async () => {
    const llm = mockLLM('```json\n{"safe":true,"issues":[],"severity":null,"summary":"Código seguro."}\n```')
    const agent = new SecurityAgent(llm)
    const result = await agent.execute({ patches: [samplePatch] })

    expect(result.safe).toBe(true)
    expect(result.issues).toEqual([])
    expect(result.severity).toBeNull()
  })

  test('retorna safe=false com issues quando há vulnerabilidade', async () => {
    const llm = mockLLM(`\`\`\`json
{
  "safe": false,
  "issues": [{
    "file": "src/auth.ts",
    "line": 2,
    "rule": "A02-hardcoded-secret",
    "description": "Senha hardcoded",
    "severity": "critical",
    "suggestion": "Use env var"
  }],
  "severity": "critical",
  "summary": "1 vulnerabilidade crítica."
}
\`\`\``)
    const agent = new SecurityAgent(llm)
    const result = await agent.execute({ patches: [samplePatch] })

    expect(result.safe).toBe(false)
    expect(result.issues.length).toBe(1)
    expect(result.severity).toBe('critical')
    expect(result.issues[0]!.rule).toBe('A02-hardcoded-secret')
  })

  test('computa severity máxima corretamente', async () => {
    const llm = mockLLM(`\`\`\`json
{
  "safe": false,
  "issues": [
    {"file":"f.ts","rule":"A","description":"","severity":"low","suggestion":""},
    {"file":"f.ts","rule":"B","description":"","severity":"high","suggestion":""}
  ],
  "severity": "high",
  "summary": "2 issues."
}
\`\`\``)
    const agent = new SecurityAgent(llm)
    const result = await agent.execute({ patches: [samplePatch] })
    expect(result.severity).toBe('high')
  })
})

// ----------------------------------------------------------
// RefactorAgent
// ----------------------------------------------------------

describe('RefactorAgent', () => {
  test('retorna patches originais quando sem mudança', async () => {
    const llm = mockLLM(`\`\`\`json
{
  "refactored": [{"file":"src/auth.ts","action":"modify","content":"// mesmo","reason":"sem mudança"}],
  "improvements": [],
  "summary": "Sem alterações.",
  "changed": false
}
\`\`\``)
    const agent = new RefactorAgent(llm)
    const result = await agent.execute({ patches: [samplePatch] })

    expect(result.changed).toBe(false)
    expect(result.improvements).toEqual([])
  })

  test('retorna refactored com improvements quando há mudança', async () => {
    const llm = mockLLM(`\`\`\`json
{
  "refactored": [{"file":"src/auth.ts","action":"modify","content":"// refatorado","reason":"Extraída função"}],
  "improvements": [{"file":"src/auth.ts","type":"extract","description":"Extraída função validateCredentials","impact":"medium"}],
  "summary": "1 melhoria aplicada.",
  "changed": true
}
\`\`\``)
    const agent = new RefactorAgent(llm)
    const result = await agent.execute({ patches: [samplePatch] })

    expect(result.changed).toBe(true)
    expect(result.improvements.length).toBe(1)
    expect(result.improvements[0]!.type).toBe('extract')
    expect(result.refactored[0]!.content).toBe('// refatorado')
  })
})

// ----------------------------------------------------------
// DocumentationAgent
// ----------------------------------------------------------

describe('DocumentationAgent', () => {
  test('ignora patches de teste', async () => {
    const llm = mockLLM('{"documented":[],"coverage":[],"summary":"Sem arquivos."}')
    const agent = new DocumentationAgent(llm)
    const testPatch: CodePatch = { ...samplePatch, file: 'src/auth.test.ts' }
    const result = await agent.execute({ patches: [testPatch] })

    // Arquivo de teste não deve ser enviado ao LLM
    expect(result.summary).toContain('Nenhum arquivo')
  })

  test('documenta arquivos de código', async () => {
    const llm = mockLLM(`\`\`\`json
{
  "documented": [{"file":"src/auth.ts","action":"modify","content":"/** Login */\\nexport function login() {}","reason":"JSDoc adicionado"}],
  "coverage": [{"file":"src/auth.ts","functions_documented":1,"functions_total":1,"coverage_pct":100}],
  "summary": "1 função documentada."
}
\`\`\``)
    const agent = new DocumentationAgent(llm)
    const result = await agent.execute({ patches: [samplePatch] })

    expect(result.documented.length).toBe(1)
    expect(result.coverage[0]!.coverage_pct).toBe(100)
    expect(result.summary).toContain('documentada')
  })
})
