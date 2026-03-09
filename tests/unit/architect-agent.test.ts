import { describe, test, expect, mock } from 'bun:test'
import { ArchitectAgent } from '../../src/agents/architect.ts'
import type { LLMAdapter } from '../../src/llm/types.ts'
import type { ExecutionPlan, BrainstormResult, Task } from '../../src/core/types.ts'
import { PipelinePhase } from '../../src/core/types.ts'

const VALID_ARCHITECTURE_RESPONSE = JSON.stringify({
  patterns: ['repository-pattern', 'service-layer', 'dependency-injection'],
  folder_structure: 'src/\n  controllers/\n  services/\n  repositories/\n  models/\n  middleware/',
  tech_decisions: [
    {
      concern: 'banco de dados',
      decision: 'PostgreSQL via Prisma ORM',
      rationale: 'Schema forte, migrations automáticas, TypeScript nativo'
    },
    {
      concern: 'autenticação',
      decision: 'JWT com refresh tokens',
      rationale: 'Stateless, ideal para APIs REST'
    }
  ],
  conventions: [
    'PascalCase para classes e interfaces',
    'camelCase para funções e variáveis',
    'kebab-case para nomes de arquivos'
  ],
  key_abstractions: [
    {
      name: 'UserRepository',
      responsibility: 'Acesso ao banco de dados para entidade User',
      file_path: 'src/repositories/user.repository.ts'
    },
    {
      name: 'AuthService',
      responsibility: 'Lógica de autenticação e autorização',
      file_path: 'src/services/auth.service.ts'
    }
  ]
})

function mockLLM(content: string): LLMAdapter {
  return {
    complete: mock(async () => ({
      content,
      model: 'test',
      input_tokens: 10,
      output_tokens: 10,
    })),
  }
}

function createMockPlan(): ExecutionPlan {
  return {
    project: 'user-api',
    objective: 'API de usuários com autenticação',
    strategy: 'Criar API RESTful com autenticação JWT',
    tasks: [
      {
        id: 't1',
        title: 'Criar estrutura de pastas',
        description: 'Criar diretórios src/controllers, services, repositories',
        phase: PipelinePhase.CODING,
        status: 'pending',
        priority: 'high',
        created_at: new Date().toISOString(),
        completed_at: null,
      },
      {
        id: 't2',
        title: 'Implementar UserRepository',
        description: 'Criar repositório para entidade User',
        phase: PipelinePhase.CODING,
        status: 'pending',
        priority: 'high',
        created_at: new Date().toISOString(),
        completed_at: null,
      }
    ],
  }
}

function createMockBrainstormResult(): BrainstormResult {
  return {
    refined_description: 'API RESTful para gerenciamento de usuários',
    acceptance_criteria: ['CRUD completo', 'Autenticação JWT', 'Validação de dados'],
    constraints: ['Usar TypeScript', 'Node.js 20+'],
    out_of_scope: ['Frontend', 'Cache'],
    project_mode: 'greenfield',
    codebase_summary: null,
    open_questions: [],
    tech_stack_detected: ['typescript', 'nodejs', 'postgresql'],
  }
}

describe('ArchitectAgent', () => {
  test('retorna ArchitectureSpec válido', async () => {
    const llm = mockLLM(VALID_ARCHITECTURE_RESPONSE)
    const agent = new ArchitectAgent(llm)

    const result = await agent.execute({
      plan: createMockPlan(),
      workspace_path: '/tmp',
    })

    expect(result.patterns).toContain('repository-pattern')
    expect(result.patterns).toContain('service-layer')
    expect(result.folder_structure).toContain('src/')
    expect(result.tech_decisions).toHaveLength(2)
    expect(result.tech_decisions[0]?.concern).toBe('banco de dados')
    expect(result.conventions).toContain('PascalCase para classes e interfaces')
    expect(result.key_abstractions).toHaveLength(2)
    expect(result.key_abstractions[0]?.name).toBe('UserRepository')
  })

  test('inclui contexto do brainstorm_result quando fornecido', async () => {
    const llm = mockLLM(VALID_ARCHITECTURE_RESPONSE)
    const agent = new ArchitectAgent(llm)

    const plan = createMockPlan()
    const brainstorm = createMockBrainstormResult()

    const result = await agent.execute({
      plan,
      brainstorm_result: brainstorm,
      workspace_path: '/tmp',
    })

    expect(result.patterns).toBeDefined()
    expect(result.key_abstractions).toBeDefined()
  })

  test('lida com resposta JSON dentro de markdown code block', async () => {
    const wrappedResponse = '```json\n' + VALID_ARCHITECTURE_RESPONSE + '\n```'
    const llm = mockLLM(wrappedResponse)
    const agent = new ArchitectAgent(llm)

    const result = await agent.execute({
      plan: createMockPlan(),
      workspace_path: '/tmp',
    })

    expect(result.patterns).toBeDefined()
    expect(result.folder_structure).toBeTruthy()
  })

  test('key_abstractions contém file_path válido', async () => {
    const llm = mockLLM(VALID_ARCHITECTURE_RESPONSE)
    const agent = new ArchitectAgent(llm)

    const result = await agent.execute({
      plan: createMockPlan(),
      workspace_path: '/tmp',
    })

    for (const abstraction of result.key_abstractions) {
      expect(abstraction.file_path).toBeTruthy()
      expect(abstraction.name).toBeTruthy()
      expect(abstraction.responsibility).toBeTruthy()
    }
  })

  test('tech_decisions contém concern, decision e rationale', async () => {
    const llm = mockLLM(VALID_ARCHITECTURE_RESPONSE)
    const agent = new ArchitectAgent(llm)

    const result = await agent.execute({
      plan: createMockPlan(),
      workspace_path: '/tmp',
    })

    for (const decision of result.tech_decisions) {
      expect(decision.concern).toBeTruthy()
      expect(decision.decision).toBeTruthy()
      expect(decision.rationale).toBeTruthy()
    }
  })

  test('retorna arrays vazios quando resposta incompleta', async () => {
    const incompleteResponse = JSON.stringify({
      patterns: ['mvc'],
    })

    const llm = mockLLM(incompleteResponse)
    const agent = new ArchitectAgent(llm)

    const result = await agent.execute({
      plan: createMockPlan(),
      workspace_path: '/tmp',
    })

    expect(Array.isArray(result.patterns)).toBe(true)
    expect(typeof result.folder_structure).toBe('string')
    expect(Array.isArray(result.tech_decisions)).toBe(true)
    expect(Array.isArray(result.conventions)).toBe(true)
    expect(Array.isArray(result.key_abstractions)).toBe(true)
  })
})
