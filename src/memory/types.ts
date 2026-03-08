// ============================================================
// CoreOps — Memory Layer Types
// Persistência de decisões e padrões entre projetos (SQLite)
// ============================================================

export type MemoryType = 'decision' | 'pattern' | 'lesson' | 'context'

export interface Memory {
  id: string
  project: string
  phase: string
  type: MemoryType
  title: string
  content: string
  tags: string[] // Armazenado como JSON no SQLite
  created_at: number // Unix timestamp ms
}

export interface MemoryRow {
  id: string
  project: string
  phase: string
  type: string
  title: string
  content: string
  tags: string // JSON string
  created_at: number
}

export interface AddMemoryInput {
  project: string
  phase: string
  type: MemoryType
  title: string
  content: string
  tags?: string[]
}
