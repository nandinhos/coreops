// ============================================================
// CoreOps CLI — memory command
// coreops memory [list|search|add] [options]
// ============================================================

import { MemoryStore } from '../../memory/memory-store.ts'
import type { Memory, MemoryType } from '../../memory/types.ts'

export function memoryCommand(args: string[]): void {
  const subcommand = args[0] ?? 'list'
  const isGlobal = args.includes('--global') || args.includes('-g')
  const isJson = args.includes('--json')

  // Detectar projeto atual pelo state.json se existir
  const currentProject = detectCurrentProject()

  const store = new MemoryStore()

  try {
    switch (subcommand) {
      case 'list':
        runList(store, isGlobal ? undefined : currentProject, isJson)
        break

      case 'search': {
        const query = args[1]
        if (!query || query.startsWith('--')) {
          console.error('Uso: coreops memory search <query>')
          process.exit(1)
        }
        runSearch(store, query, isGlobal ? undefined : currentProject, isJson)
        break
      }

      case 'add':
        runAdd(store, args.slice(1), currentProject)
        break

      case 'projects':
        runProjects(store, isJson)
        break

      default:
        // Se não é subcomando conhecido, trata como query de busca
        runSearch(store, subcommand, isGlobal ? undefined : currentProject, isJson)
    }
  } finally {
    store.close()
  }
}

function runList(store: MemoryStore, project: string | undefined, isJson: boolean): void {
  const memories = store.list(project)

  if (isJson) {
    console.log(JSON.stringify(memories, null, 2))
    return
  }

  if (memories.length === 0) {
    const scope = project ? `projeto "${project}"` : 'todos os projetos'
    console.log(`Nenhuma memória registrada para ${scope}.`)
    console.log(`\nUse: coreops memory add --title "..." --content "..."`)
    return
  }

  const scope = project ? `"${project}"` : 'global'
  console.log(`\nMemórias [${scope}] — ${memories.length} entrada(s)\n`)
  printMemories(memories)
}

function runSearch(
  store: MemoryStore,
  query: string,
  project: string | undefined,
  isJson: boolean,
): void {
  const memories = store.search(query, project)

  if (isJson) {
    console.log(JSON.stringify(memories, null, 2))
    return
  }

  if (memories.length === 0) {
    console.log(`Nenhuma memória encontrada para "${query}".`)
    return
  }

  console.log(`\nBusca: "${query}" — ${memories.length} resultado(s)\n`)
  printMemories(memories)
}

function runAdd(store: MemoryStore, args: string[], currentProject: string): void {
  const title = getArg(args, '--title') ?? getArg(args, '-t')
  const content = getArg(args, '--content') ?? getArg(args, '-c')
  const type = (getArg(args, '--type') ?? 'context') as MemoryType
  const phase = getArg(args, '--phase') ?? 'UNKNOWN'
  const tagsRaw = getArg(args, '--tags')
  const project = getArg(args, '--project') ?? currentProject
  const tags = tagsRaw ? tagsRaw.split(',').map((t) => t.trim()) : []

  if (!title || !content) {
    console.error('Uso: coreops memory add --title "..." --content "..." [--type decision] [--phase PLANNING] [--tags "tag1,tag2"]')
    process.exit(1)
  }

  const VALID_TYPES: MemoryType[] = ['decision', 'pattern', 'lesson', 'context']
  if (!VALID_TYPES.includes(type)) {
    console.error(`Tipo inválido: "${type}". Use: ${VALID_TYPES.join(', ')}`)
    process.exit(1)
  }

  const memory = store.add({ project, phase, type, title, content, tags })
  console.log(`\nMemória adicionada [${memory.id}]`)
  console.log(`  Projeto: ${memory.project}`)
  console.log(`  Tipo:    ${memory.type}`)
  console.log(`  Título:  ${memory.title}`)
}

function runProjects(store: MemoryStore, isJson: boolean): void {
  const projects = store.projects()

  if (isJson) {
    console.log(JSON.stringify(projects, null, 2))
    return
  }

  if (projects.length === 0) {
    console.log('Nenhum projeto com memórias registradas.')
    return
  }

  console.log('\nProjetos com memórias:\n')
  for (const p of projects) {
    const count = store.count(p)
    console.log(`  ${p} (${count} entrada(s))`)
  }
}

function printMemories(memories: Memory[]): void {
  const typeIcon: Record<string, string> = {
    decision: '🏛',
    pattern: '🔄',
    lesson: '📚',
    context: '📝',
  }

  for (const m of memories) {
    const icon = typeIcon[m.type] ?? '·'
    const date = new Date(m.created_at).toLocaleDateString('pt-BR')
    const tags = m.tags.length > 0 ? ` [${m.tags.join(', ')}]` : ''
    console.log(`  ${icon} [${m.id}] ${m.title}${tags}`)
    console.log(`     Projeto: ${m.project} | Fase: ${m.phase} | ${date}`)
    console.log(`     ${m.content.replace(/\n/g, '\n     ')}`)
    console.log()
  }
}

function getArg(args: string[], flag: string): string | undefined {
  const idx = args.indexOf(flag)
  if (idx !== -1 && idx + 1 < args.length && !args[idx + 1]!.startsWith('--')) {
    return args[idx + 1]
  }
  const entry = args.find((a) => a.startsWith(`${flag}=`))
  return entry?.split('=').slice(1).join('=')
}

function detectCurrentProject(): string {
  try {
    const { readFileSync, existsSync } = require('node:fs') as typeof import('node:fs')
    const { join } = require('node:path') as typeof import('node:path')
    const statePath = join(process.cwd(), '.coreops', 'state', 'project_state.json')
    if (existsSync(statePath)) {
      const state = JSON.parse(readFileSync(statePath, 'utf-8')) as { project?: string }
      return state.project ?? 'unknown'
    }
  } catch {
    // sem projeto ativo
  }
  return 'unknown'
}
