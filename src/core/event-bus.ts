// ============================================================
// CoreOps — Event Bus
// Sistema pub/sub interno para comunicação entre componentes
// ============================================================

import type { EventType, SystemEvent } from './types.ts'
import { randomUUID } from 'node:crypto'

type EventHandler = (event: SystemEvent) => void | Promise<void>

export class EventBus {
  private handlers = new Map<EventType, Set<EventHandler>>()
  private history: SystemEvent[] = []

  on(type: EventType, handler: EventHandler): void {
    if (!this.handlers.has(type)) {
      this.handlers.set(type, new Set())
    }
    this.handlers.get(type)!.add(handler)
  }

  off(type: EventType, handler: EventHandler): void {
    this.handlers.get(type)?.delete(handler)
  }

  async emit(type: EventType, payload: Record<string, unknown> = {}): Promise<void> {
    const event: SystemEvent = {
      id: randomUUID(),
      type,
      timestamp: new Date().toISOString(),
      payload,
    }

    this.history.push(event)

    const handlers = this.handlers.get(type)
    if (handlers) {
      await Promise.all([...handlers].map((h) => h(event)))
    }
  }

  getHistory(): SystemEvent[] {
    return [...this.history]
  }

  clearHistory(): void {
    this.history = []
  }
}

// Singleton global do sistema
export const eventBus = new EventBus()
