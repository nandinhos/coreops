// ============================================================
// CoreOps — Workspace Manager
// Gerencia a estrutura de diretórios .coreops/
// ============================================================

import { existsSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'

export const COREOPS_DIR = '.coreops'

export const DIRS = {
  root: COREOPS_DIR,
  state: join(COREOPS_DIR, 'state'),
  backlog: join(COREOPS_DIR, 'backlog'),
  logs: join(COREOPS_DIR, 'logs'),
  history: join(COREOPS_DIR, 'history'),
  debug: join(COREOPS_DIR, 'debug'),
} as const

export class WorkspaceManager {
  constructor(private readonly basePath: string = process.cwd()) {}

  resolve(relativePath: string): string {
    return join(this.basePath, relativePath)
  }

  init(): void {
    for (const dir of Object.values(DIRS)) {
      const fullPath = this.resolve(dir)
      if (!existsSync(fullPath)) {
        mkdirSync(fullPath, { recursive: true })
      }
    }
  }

  isInitialized(): boolean {
    return existsSync(this.resolve(DIRS.root))
  }

  getStatePath(): string {
    return this.resolve(join(DIRS.state, 'project_state.json'))
  }

  getBacklogPath(): string {
    return this.resolve(join(DIRS.backlog, 'backlog.json'))
  }

  getHistoryPath(): string {
    return this.resolve(join(DIRS.history, 'history.log'))
  }

  getLogsPath(): string {
    return this.resolve(DIRS.logs)
  }

  getDebugPath(): string {
    return this.resolve(DIRS.debug)
  }
}
