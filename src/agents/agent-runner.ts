// ============================================================
// CoreOps — Agent Runner
// Ciclo de vida: spawn → inject context → execute → log → destroy
// ============================================================

import type { AgentType } from './agent-registry.ts'
import { AgentRegistry } from './agent-registry.ts'
import { EventBus } from '../core/event-bus.ts'
import { HistoryLog } from '../workspace/history-log.ts'

export interface RunOptions {
  timeout_ms?: number
}

export class AgentRunner {
  constructor(
    private readonly registry: AgentRegistry,
    private readonly eventBus: EventBus,
    private readonly history: HistoryLog,
    private readonly defaultTimeout = 120_000,
  ) {}

  async run<I, O>(type: AgentType, input: I, options: RunOptions = {}): Promise<O> {
    const agent = this.registry.resolve<I, O>(type)
    const timeout = options.timeout_ms ?? this.defaultTimeout

    await this.eventBus.emit('agent_spawned', { agent: type })

    try {
      const result = await this.withTimeout(agent.execute(input), timeout, type)

      this.history.agentExecuted(type, 'ok')
      await this.eventBus.emit('agent_completed', { agent: type })

      return result
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      this.history.agentExecuted(type, 'error')
      this.history.error(type, message)

      await this.eventBus.emit('agent_failed', { agent: type, error: message })
      throw error
    }
  }

  private withTimeout<T>(promise: Promise<T>, ms: number, agentName: string): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(
        () => reject(new Error(`Agente ${agentName} excedeu timeout de ${ms}ms`)),
        ms,
      )

      promise.then(
        (value) => {
          clearTimeout(timer)
          resolve(value)
        },
        (error: unknown) => {
          clearTimeout(timer)
          reject(error)
        },
      )
    })
  }
}
