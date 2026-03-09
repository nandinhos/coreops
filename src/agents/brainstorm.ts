// ============================================================
// CoreOps — BrainstormAgent (Modo Superpowers)
// Refinamento Socrático: perguntas de clarification antes do design
// ============================================================

import type { Agent } from './agent.ts'
import type { LLMAdapter } from '../llm/types.ts'
import type { BrainstormResult, BrainstormSession, BrainstormSessionUpdate } from '../core/types.ts'
import { existsSync } from 'node:fs'
import { join } from 'node:path'

export interface BrainstormInput {
  project: string
  description: string
  workspace_path: string
}

const SYSTEM_PROMPT = `Você é o BrainstormAgent do CoreOps, seguindo a metodologia Superpowers.

Sua missão é refinar ideias através de DIÁLOGO antes de qualquer implementação.

FLUXO OBRIGATÓRIO:
1. Explore o contexto do projeto
2. Faça PERGUNTAS DE CLARIFICAÇÃO (máximo 3) uma de cada vez
3. Proponha 2-3 ABORDAGENS com trade-offs quando entender suficiente
4. Após escolha do usuário, apresente DESIGN em seções incrementais
5. Após aprovação FINAL, gere o BrainstormResult

REGRAS CRÍTICAS:
-Faça APENAS UMA PERGUNTA por resposta
- Preferência por múltipla escolha quando possível
- Perguntas devem cobrir: propósito, restrições, critérios de sucesso
- NÃO avance para implementation até aprovação explícita

Retorne JSON com:
{
  "refined_description": "Descrição se entender suficiente, ou vazio",
  "open_questions": ["pergunta de clarification 1"] ou [],
  "proposed_approaches": ["abordagem 1", "abordagem 2"] ou [],
  "awaiting_choice": true/false,
  "session_state": "initial" | "clarifying" | "approaches" | "design" | "approved"
}`

const SYSTEM_PROMPT_APPROACHES = `O usuário escolheu uma abordagem. Apresente o design em 3 seções:

1. **Arquitetura** - Componentes principais
2. **Fluxo de Dados** - Como dados são processados
3. **Estratégia de Testes** - Como validar

Cada seção: 50-100 palavras. Pergunte após cada uma: "Esta seção está ok?".

Retorne JSON:
{
  "design_sections": [
    {"title": "Arquitetura", "content": "...", "approved": false},
    {"title": "Fluxo de Dados", "content": "...", "approved": false},
    {"title": "Estratégia de Testes", "content": "...", "approved": false}
  ],
  "current_section": 0,
  "session_state": "design"
}`

const SYSTEM_PROMPT_FINAL = `Todas as seções do design foram aprovadas. Gere o BrainstormResult FINAL:

{
  "refined_description": "Descrição técnica completa",
  "acceptance_criteria": ["Critério verificável 1", "Critério 2", "Critério 3"],
  "constraints": ["Restrição técnica"],
  "out_of_scope": ["Feature fora do escopo"],
  "project_mode": "greenfield",
  "codebase_summary": null,
  "open_questions": [],
  "tech_stack_detected": []
}`

function detectTechStack(workspacePath: string): string[] {
  const detected: string[] = []
  const detectors = [
    { pattern: 'artisan', tech: 'laravel' },
    { pattern: 'composer.json', tech: 'php' },
    { pattern: 'package.json', tech: 'node' },
    { pattern: 'bun.lock', tech: 'bun' },
    { pattern: 'tsconfig.json', tech: 'typescript' },
    { pattern: 'next.config', tech: 'nextjs' },
    { pattern: 'go.mod', tech: 'golang' },
    { pattern: 'Cargo.toml', tech: 'rust' },
    { pattern: 'prisma', tech: 'prisma' },
    { pattern: 'filament', tech: 'filament' },
  ]

  for (const { pattern, tech } of detectors) {
    if (existsSync(join(workspacePath, pattern)) && !detected.includes(tech)) {
      detected.push(tech)
    }
  }

  return detected
}

function isGreenfield(workspacePath: string): boolean {
  try {
    const entries = require('node:fs').readdirSync(workspacePath)
      .filter((e: string) => e !== '.coreops' && e !== '.git' && !e.startsWith('.'))
    return entries.length === 0
  } catch {
    return true
  }
}

function parseJsonResponse(content: string): any {
  const cleaned = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
  const match = cleaned.match(/\{[\s\S]*\}/)
  if (!match) return {}
  try {
    return JSON.parse(match[0])
  } catch {
    return {}
  }
}

export class BrainstormAgent implements Agent<BrainstormInput, BrainstormResult> {
  readonly name = 'brainstorm'
  constructor(private readonly llm: LLMAdapter) {}

  async execute(input: BrainstormInput): Promise<BrainstormResult> {
    const techStack = detectTechStack(input.workspace_path)
    const projectMode = isGreenfield(input.workspace_path) ? 'greenfield' : 'refactoring'

    const initialContext = `**Projeto:** ${input.project}
**Descrição inicial:** ${input.description}
**Stack detectada:** ${techStack.join(', ') || 'não detectada'}
**Modo:** ${projectMode}

Inicie o processo de clarification com a primeira pergunta.`

    const response = await this.llm.complete({
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: initialContext }],
      max_tokens: 600,
    })

    const parsed = parseJsonResponse(response.content)

    if (parsed.open_questions && parsed.open_questions.length > 0) {
      return {
        refined_description: '',
        acceptance_criteria: [],
        constraints: [],
        out_of_scope: [],
        project_mode: projectMode as 'greenfield' | 'refactoring',
        codebase_summary: projectMode === 'refactoring' ? 'Projeto existente' : null,
        open_questions: parsed.open_questions,
        tech_stack_detected: techStack,
        _is_interactive: true,
        _session_state: 'clarifying',
      }
    }

    if (parsed.proposed_approaches && parsed.proposed_approaches.length > 0) {
      return {
        refined_description: '',
        acceptance_criteria: [],
        constraints: [],
        out_of_scope: [],
        project_mode: projectMode as 'greenfield' | 'refactoring',
        codebase_summary: null,
        open_questions: [
          `**Abordagens propostas:**\n${parsed.proposed_approaches.map((a: string, i: number) => `${i + 1}. ${a}`).join('\n')}\n\nQual abordagem você prefere? Responda com o número (1-${parsed.proposed_approaches.length}) ou descreva sua escolha.`
        ],
        tech_stack_detected: techStack,
        _is_interactive: true,
        _session_state: 'approaches',
        _approaches: parsed.proposed_approaches,
      }
    }

    return {
      refined_description: parsed.refined_description || input.description,
      acceptance_criteria: parsed.acceptance_criteria || ['Funcionalidade implementada'],
      constraints: parsed.constraints || [],
      out_of_scope: parsed.out_of_scope || [],
      project_mode: projectMode as 'greenfield' | 'refactoring',
      codebase_summary: projectMode === 'refactoring' ? 'Projeto existente' : null,
      open_questions: [],
      tech_stack_detected: techStack,
    }
  }
}

export class BrainstormClarifyingAgent implements Agent<BrainstormSessionUpdate, BrainstormResult> {
  readonly name = 'brainstorm_clarifying'
  constructor(private readonly llm: LLMAdapter) {}

  async execute(input: BrainstormSessionUpdate): Promise<BrainstormResult> {
    const { session, answer, project, workspace_path } = input
    const techStack = detectTechStack(workspace_path)
    
    const context = `**Projeto:** ${project}
**Histórico de Q&A:**
${session.questions_asked.map(q => `P: ${q.question}\nR: ${q.answer || 'pendente'}`).join('\n\n')}
**Última resposta:** ${answer}

Com base nesta resposta, faça a próxima pergunta de clarification OU (se entender suficiente) proponha 2-3 abordagens.`

    const response = await this.llm.complete({
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: context }],
      max_tokens: 600,
    })

    const parsed = parseJsonResponse(response.content)

    if (parsed.open_questions && parsed.open_questions.length > 0) {
      return {
        refined_description: '',
        acceptance_criteria: [],
        constraints: [],
        out_of_scope: [],
        project_mode: 'greenfield',
        codebase_summary: null,
        open_questions: parsed.open_questions,
        tech_stack_detected: techStack,
        _is_interactive: true,
        _session_state: 'clarifying',
      }
    }

    if (parsed.proposed_approaches && parsed.proposed_approaches.length > 0) {
      return {
        refined_description: '',
        acceptance_criteria: [],
        constraints: [],
        out_of_scope: [],
        project_mode: 'greenfield',
        codebase_summary: null,
        open_questions: [
          `**Abordagens propostas:**\n${parsed.proposed_approaches.map((a: string, i: number) => `${i + 1}. ${a}`).join('\n')}\n\nQual abordagem você prefere?`
        ],
        tech_stack_detected: techStack,
        _is_interactive: true,
        _session_state: 'approaches',
        _approaches: parsed.proposed_approaches,
      }
    }

    return {
      refined_description: parsed.refined_description || '',
      acceptance_criteria: parsed.acceptance_criteria || [],
      constraints: parsed.constraints || [],
      out_of_scope: parsed.out_of_scope || [],
      project_mode: 'greenfield',
      codebase_summary: null,
      open_questions: [],
      tech_stack_detected: techStack,
    }
  }
}
