// ============================================================
// CoreOps — SkillRegistry
// Sistema de skills reutilizáveis para especialização de agentes
// ============================================================

import type { Skill } from '../core/types.ts'
import { existsSync } from 'node:fs'
import { join } from 'node:path'

import { LARAVEL_SKILL } from './defaults/laravel.ts'
import { LIVEWIRE_SKILL } from './defaults/livewire.ts'
import { REACT_SKILL } from './defaults/react.ts'
import { NODE_EXPRESS_SKILL } from './defaults/node-express.ts'
import { FILAMENT_SKILL } from './defaults/filament.ts'

const DEFAULT_SKILLS: Skill[] = [
  LARAVEL_SKILL,
  LIVEWIRE_SKILL,
  REACT_SKILL,
  NODE_EXPRESS_SKILL,
  FILAMENT_SKILL,
]

export function loadDefaultSkills(): Skill[] {
  return DEFAULT_SKILLS
}

export function detectSkills(workspacePath: string, techStack: string[] = []): Skill[] {
  const detected: Skill[] = []
  const allSkills = loadDefaultSkills()
  const stackLower = techStack.map(t => t.toLowerCase())

  for (const skill of allSkills) {
    // Verificar por arquivo/diretório no workspace
    const fileMatch = skill.detect_patterns.some(pattern =>
      existsSync(join(workspacePath, pattern))
    )

    // Verificar por tech stack detectada pelo brainstorm
    const stackMatch = skill.detect_patterns.some(pattern =>
      stackLower.some(tech => tech.includes(pattern.toLowerCase()) || pattern.toLowerCase().includes(tech))
    )

    if (fileMatch || stackMatch) {
      detected.push(skill)
    }
  }

  return detected
}

export function getSkillsForAgent(agentName: string, skills: Skill[]): Skill[] {
  return skills.filter(s => s.applies_to.includes(agentName))
}

export function buildSkillContext(agentName: string, skills: Skill[]): string {
  const applicable = getSkillsForAgent(agentName, skills)
  if (applicable.length === 0) return ''

  return [
    '\n---',
    '## Conhecimento Especializado de Domínio',
    ...applicable.map(s => `### ${s.name}\n${s.context_injection}`),
  ].join('\n')
}
