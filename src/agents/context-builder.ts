// ============================================================
// CoreOps — Context Builder Agent
// Monta contexto otimizado para cada agente — arquivos + memória relevantes
// ============================================================

import { BaseAgent } from './agent.ts'
import type { Microtask } from '../core/types.ts'
import type { WorkspaceManager } from '../workspace/workspace-manager.ts'
import type { MemoryStore } from '../memory/memory-store.ts'
import { readdirSync, readFileSync, statSync, existsSync } from 'node:fs'
import { join, extname, relative } from 'node:path'

// Extensões de código que interessam ao contexto
const CODE_EXTENSIONS = new Set([
  '.ts', '.tsx', '.js', '.jsx', '.py', '.go', '.rs',
  '.java', '.kt', '.php', '.rb', '.cs', '.cpp', '.c', '.h',
  '.json', '.yaml', '.yml', '.toml', '.env.example',
  '.md', '.sql',
])

// Diretórios a ignorar
const IGNORE_DIRS = new Set([
  'node_modules', '.git', '.coreops', 'dist', 'out', 'build',
  '.next', '.nuxt', 'coverage', '.cache', '__pycache__',
])

// Limite de tokens aproximado (chars / 4)
const MAX_CONTEXT_CHARS = 80_000

export class ContextBuilderAgent extends BaseAgent<Microtask, string> {
  readonly name = 'context-builder'

  constructor(
    private readonly workspace: WorkspaceManager,
    private readonly memory?: MemoryStore,
  ) {
    super()
  }

  async execute(microtask: Microtask): Promise<string> {
    const cwd = process.cwd()
    const files = this.collectFiles(cwd)

    // Ordenar por relevância à microtask
    const scored = files.map((f) => ({
      file: f,
      score: this.scoreRelevance(f.path, f.content, microtask.description),
    }))

    scored.sort((a, b) => b.score - a.score)

    // Construir contexto com limite de tokens
    let context = `# Contexto para microtask\n\n`
    context += `**Microtask:** ${microtask.description}\n\n`
    context += `**ID:** ${microtask.id}\n\n`

    if (microtask.dependencies.length > 0) {
      context += `**Dependências:** ${microtask.dependencies.join(', ')}\n\n`
    }

    // Injetar memórias relevantes antes dos arquivos
    if (this.memory) {
      const memories = this.memory.search(microtask.description)
      if (memories.length > 0) {
        context += `---\n\n# Memórias Relevantes (de projetos anteriores)\n\n`
        for (const m of memories.slice(0, 5)) {
          context += `**[${m.type.toUpperCase()}] ${m.title}** (${m.phase})\n${m.content}\n\n`
        }
      }
    }

    context += `---\n\n# Arquivos do Projeto\n\n`

    let charCount = context.length

    for (const { file } of scored) {
      const fileBlock = `### ${file.relative}\n\`\`\`${file.ext}\n${file.content}\n\`\`\`\n\n`

      if (charCount + fileBlock.length > MAX_CONTEXT_CHARS) {
        break
      }

      context += fileBlock
      charCount += fileBlock.length
    }

    return context
  }

  private collectFiles(
    dir: string,
    result: Array<{ path: string; relative: string; content: string; ext: string }> = [],
  ) {
    if (!existsSync(dir)) return result

    let entries: string[]
    try {
      entries = readdirSync(dir)
    } catch {
      return result
    }

    for (const entry of entries) {
      const fullPath = join(dir, entry)

      try {
        const stat = statSync(fullPath)

        if (stat.isDirectory()) {
          if (!IGNORE_DIRS.has(entry)) {
            this.collectFiles(fullPath, result)
          }
          continue
        }

        const ext = extname(entry).toLowerCase()
        if (!CODE_EXTENSIONS.has(ext)) continue

        // Ignorar arquivos muito grandes (> 50kb)
        if (stat.size > 50_000) continue

        const content = readFileSync(fullPath, 'utf-8')
        result.push({
          path: fullPath,
          relative: relative(process.cwd(), fullPath),
          content,
          ext: ext.replace('.', '') || 'text',
        })
      } catch {
        // Ignorar arquivos que não podem ser lidos
      }
    }

    return result
  }

  private scoreRelevance(filePath: string, content: string, description: string): number {
    let score = 0
    const desc = description.toLowerCase()
    const path = filePath.toLowerCase()
    const contentLower = content.toLowerCase()

    // Extrair palavras-chave da descrição
    const keywords = desc
      .split(/\W+/)
      .filter((w) => w.length > 3)
      .filter((w) => !['criar', 'implementar', 'adicionar', 'fazer', 'with', 'from', 'that', 'this'].includes(w))

    for (const kw of keywords) {
      if (path.includes(kw)) score += 10
      if (contentLower.includes(kw)) score += 2
    }

    // Preferir arquivos TypeScript/código fonte
    if (path.endsWith('.ts') || path.endsWith('.tsx')) score += 3
    if (path.includes('/src/')) score += 2

    // Penalizar arquivos de teste (são gerados, não lidos como contexto)
    if (path.includes('.test.') || path.includes('.spec.')) score -= 5

    return score
  }
}
