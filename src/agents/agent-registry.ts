// ============================================================
// CoreOps — Agent Registry
// Registro dinâmico de agentes disponíveis no sistema
// ============================================================

import type { Agent } from './agent.ts'

export type AgentType =
  | 'planner'
  | 'microtask-generator'
  | 'context-builder'
  | 'coder'
  | 'reviewer'
  | 'tester'
  | 'validator'
  | 'debugger'
  // Phase 8: Advanced Agents
  | 'security'
  | 'refactor'
  | 'documentation'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export class AgentRegistry {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private agents = new Map<AgentType, Agent<any, any>>()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  register<I, O>(type: AgentType, agent: Agent<I, O>): void {
    this.agents.set(type, agent)
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  resolve<I, O>(type: AgentType): Agent<I, O> {
    const agent = this.agents.get(type)
    if (!agent) {
      throw new Error(`Agente não registrado: ${type}`)
    }
    return agent as Agent<I, O>
  }

  has(type: AgentType): boolean {
    return this.agents.has(type)
  }

  list(): AgentType[] {
    return [...this.agents.keys()]
  }
}
