// ============================================================
// CoreOps — History Log
// Registro imutável de transições de estado e eventos relevantes
// ============================================================

import { appendFileSync } from 'node:fs'
import { WorkspaceManager } from './workspace-manager.ts'

export class HistoryLog {
  private readonly path: string

  constructor(workspace: WorkspaceManager) {
    this.path = workspace.getHistoryPath()
  }

  append(message: string): void {
    const timestamp = new Date().toISOString().replace('T', ' ').substring(0, 19)
    appendFileSync(this.path, `${timestamp} ${message}\n`, 'utf-8')
  }

  stateChange(from: string, to: string): void {
    this.append(`STATE CHANGE: ${from} → ${to}`)
  }

  projectStarted(name: string): void {
    this.append(`PROJECT STARTED: ${name}`)
  }

  projectResumed(name: string, phase: string): void {
    this.append(`PROJECT RESUMED: ${name} at phase ${phase}`)
  }

  agentExecuted(agent: string, status: 'ok' | 'error'): void {
    this.append(`AGENT: ${agent} [${status.toUpperCase()}]`)
  }

  microtaskCompleted(id: string, description: string): void {
    this.append(`MICROTASK COMPLETED: [${id}] ${description}`)
  }

  error(context: string, message: string): void {
    this.append(`ERROR in ${context}: ${message}`)
  }
}
