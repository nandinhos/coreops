import { describe, test, expect, mock } from 'bun:test'
import { BrainstormAgent } from '../../src/agents/brainstorm.ts'
import type { LLMAdapter } from '../../src/llm/types.ts'

const QUESTION_RESPONSE = JSON.stringify({
  refined_description: '',
  open_questions: ['Qual é o problema que este sistema resolve?'],
  proposed_approaches: [],
  awaiting_choice: false,
  session_state: 'clarifying'
})

const APPROACHES_RESPONSE = JSON.stringify({
  refined_description: '',
  open_questions: [],
  proposed_approaches: [
    'API RESTful com Express e banco relacional',
    'Microservices com message queue'
  ],
  awaiting_choice: true,
  session_state: 'approaches'
})

const FINAL_RESPONSE = JSON.stringify({
  refined_description: 'Sistema de gerenciamento de usuários com autenticação JWT',
  acceptance_criteria: [
    'Usuário pode se registrar com email e senha',
    'Usuário pode fazer login e receber JWT válido',
    'Token expira em 24h',
  ],
  constraints: ['Usar bcrypt para hash de senha'],
  out_of_scope: ['Recuperação de senha via email'],
  project_mode: 'greenfield',
  codebase_summary: null,
  open_questions: [],
  tech_stack_detected: ['typescript', 'bun'],
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

describe('BrainstormAgent (Modo Superpowers)', () => {
  test('faz pergunta de clarification quando descrição é vaga', async () => {
    const llm = mockLLM(QUESTION_RESPONSE)
    const agent = new BrainstormAgent(llm)

    const result = await agent.execute({
      project: 'user-auth',
      description: 'Sistema de autenticação',
      workspace_path: '/tmp',
    })

    expect(result.open_questions.length).toBeGreaterThan(0)
    expect(result._is_interactive).toBe(true)
    expect(result._session_state).toBe('clarifying')
  })

  test('propõe abordagens quando entende suficiente', async () => {
    const llm = mockLLM(APPROACHES_RESPONSE)
    const agent = new BrainstormAgent(llm)

    const result = await agent.execute({
      project: 'test',
      description: 'CRUD de produtos',
      workspace_path: '/tmp',
    })

    expect(result.open_questions[0]).toContain('Abordagens propostas')
    expect(result._approaches).toBeDefined()
    expect(result._approaches?.length).toBe(2)
  })

  test('retorna resultado final quando LLM gera sem perguntas', async () => {
    const llm = mockLLM(FINAL_RESPONSE)
    const agent = new BrainstormAgent(llm)

    const result = await agent.execute({
      project: 'test',
      description: 'Sistema completo com autenticação JWT e CRUD de tarefas',
      workspace_path: '/tmp',
    })

    expect(result.open_questions).toHaveLength(0)
    expect(result.refined_description).toContain('JWT')
    expect(result.acceptance_criteria.length).toBeGreaterThan(0)
  })

  test('detecta tech stack automaticamente', async () => {
    const llm = mockLLM(QUESTION_RESPONSE)
    const agent = new BrainstormAgent(llm)

    const result = await agent.execute({
      project: 'test',
      description: 'Sistema em Laravel',
      workspace_path: '/tmp',
    })

    expect(Array.isArray(result.tech_stack_detected)).toBe(true)
  })

  test('campos obrigatórios sempre presentes', async () => {
    const llm = mockLLM(FINAL_RESPONSE)
    const agent = new BrainstormAgent(llm)

    const result = await agent.execute({
      project: 'test',
      description: 'Teste',
      workspace_path: '/tmp',
    })

    expect(result).toHaveProperty('refined_description')
    expect(result).toHaveProperty('acceptance_criteria')
    expect(result).toHaveProperty('constraints')
    expect(result).toHaveProperty('out_of_scope')
    expect(result).toHaveProperty('project_mode')
    expect(result).toHaveProperty('tech_stack_detected')
  })
})
