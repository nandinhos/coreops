// ============================================================
// CoreOps — State Store
// Persistência atômica do ProjectState com backup automático
// ============================================================

import { readFileSync, writeFileSync, existsSync, copyFileSync } from 'node:fs'
import type { ProjectState } from '../core/types.ts'
import { WorkspaceManager } from './workspace-manager.ts'

export class StateStore {
  private readonly statePath: string
  private readonly backupPath: string

  constructor(private readonly workspace: WorkspaceManager) {
    this.statePath = workspace.getStatePath()
    this.backupPath = this.statePath.replace('.json', '.bak.json')
  }

  exists(): boolean {
    return existsSync(this.statePath)
  }

  read(): ProjectState | null {
    if (!this.exists()) return null
    try {
      const raw = readFileSync(this.statePath, 'utf-8')
      return JSON.parse(raw) as ProjectState
    } catch {
      // Tentar recuperar do backup
      if (existsSync(this.backupPath)) {
        const raw = readFileSync(this.backupPath, 'utf-8')
        return JSON.parse(raw) as ProjectState
      }
      return null
    }
  }

  write(state: ProjectState): void {
    // Criar backup do estado anterior
    if (existsSync(this.statePath)) {
      copyFileSync(this.statePath, this.backupPath)
    }

    // Escrita atômica via arquivo temporário
    const tmp = this.statePath + '.tmp'
    writeFileSync(tmp, JSON.stringify(state, null, 2), 'utf-8')

    const { renameSync } = require('node:fs') as typeof import('node:fs')
    renameSync(tmp, this.statePath)
  }

  patch(partial: Partial<ProjectState>): ProjectState {
    const current = this.read()
    if (!current) throw new Error('Estado do projeto não encontrado. Execute `coreops start` primeiro.')

    const updated: ProjectState = {
      ...current,
      ...partial,
      last_updated: new Date().toISOString(),
    }
    this.write(updated)
    return updated
  }
}
