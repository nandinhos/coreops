import { describe, test, expect, beforeEach, afterEach } from 'bun:test'
import { loadDefaultSkills, detectSkills, getSkillsForAgent, buildSkillContext } from '../../src/skills/skill-registry.ts'
import { rmSync, mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

describe('SkillRegistry', () => {
  let tmpDir: string

  beforeEach(() => {
    tmpDir = join(tmpdir(), 'coreops-skill-test-' + Date.now())
    mkdirSync(tmpDir, { recursive: true })
  })

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true })
  })

  describe('loadDefaultSkills', () => {
    test('retorna array com skills padrão', () => {
      const skills = loadDefaultSkills()

      expect(skills.length).toBeGreaterThan(0)
      expect(skills.some(s => s.id === 'laravel')).toBe(true)
      expect(skills.some(s => s.id === 'livewire')).toBe(true)
      expect(skills.some(s => s.id === 'react')).toBe(true)
      expect(skills.some(s => s.id === 'node-express')).toBe(true)
      expect(skills.some(s => s.id === 'filament')).toBe(true)
    })

    test('cada skill tem campos obrigatórios', () => {
      const skills = loadDefaultSkills()

      for (const skill of skills) {
        expect(skill.id).toBeDefined()
        expect(skill.name).toBeDefined()
        expect(Array.isArray(skill.applies_to)).toBe(true)
        expect(Array.isArray(skill.detect_patterns)).toBe(true)
        expect(typeof skill.context_injection).toBe('string')
      }
    })

    test('skills aplicam-se a agentes corretos', () => {
      const laravel = loadDefaultSkills().find(s => s.id === 'laravel')!

      expect(laravel.applies_to).toContain('coder')
      expect(laravel.applies_to).toContain('reviewer')
      expect(laravel.applies_to).toContain('tester')
    })
  })

  describe('detectSkills', () => {
    test('detecta Laravel por arquivo artisan', () => {
      writeFileSync(join(tmpDir, 'artisan'), '')
      writeFileSync(join(tmpDir, 'composer.json'), '{}')

      const skills = detectSkills(tmpDir)

      expect(skills.some(s => s.id === 'laravel')).toBe(true)
    })

    test('detecta Laravel por tech stack', () => {
      const skills = detectSkills('/nonexistent', ['laravel', 'php'])

      expect(skills.some(s => s.id === 'laravel')).toBe(true)
    })

    test('detecta Livewire por arquivo de componente', () => {
      mkdirSync(join(tmpDir, 'app', 'Livewire'), { recursive: true })
      writeFileSync(join(tmpDir, 'app', 'Livewire', 'Counter.php'), '')

      const skills = detectSkills(tmpDir)

      expect(skills.some(s => s.id === 'livewire')).toBe(true)
    })

    test('detecta React por diretório components', () => {
      mkdirSync(join(tmpDir, 'src', 'components'), { recursive: true })

      const skills = detectSkills(tmpDir)

      expect(skills.some(s => s.id === 'react')).toBe(true)
    })

    test('detecta Node/Express por estrutura', () => {
      mkdirSync(join(tmpDir, 'src', 'routes'), { recursive: true })
      writeFileSync(join(tmpDir, 'package.json'), JSON.stringify({ dependencies: { express: '^4.0.0' } }))

      const skills = detectSkills(tmpDir)

      expect(skills.some(s => s.id === 'node-express')).toBe(true)
    })

    test('retorna array vazio para workspace vazio', () => {
      const skills = detectSkills('/nonexistent', [])

      expect(skills).toHaveLength(0)
    })

    test('detecta múltiplas skills simultaneamente', () => {
      writeFileSync(join(tmpDir, 'artisan'), '')
      writeFileSync(join(tmpDir, 'composer.json'), '{}')
      mkdirSync(join(tmpDir, 'app', 'Livewire'), { recursive: true })

      const skills = detectSkills(tmpDir)

      expect(skills.length).toBeGreaterThanOrEqual(2)
      expect(skills.some(s => s.id === 'laravel')).toBe(true)
      expect(skills.some(s => s.id === 'livewire')).toBe(true)
    })

    test('detecção é case-insensitive para tech stack', () => {
      const skillsLower = detectSkills('/nonexistent', ['LARAVEL', 'PHP'])
      const skillsMixed = detectSkills('/nonexistent', ['Laravel', 'React'])

      expect(skillsLower.some(s => s.id === 'laravel')).toBe(true)
      expect(skillsMixed.some(s => s.id === 'laravel')).toBe(true)
      expect(skillsMixed.some(s => s.id === 'react')).toBe(true)
    })
  })

  describe('getSkillsForAgent', () => {
    test('retorna skills que se aplicam ao agente', () => {
      const skills = loadDefaultSkills()
      const laravelSkills = getSkillsForAgent('coder', skills)

      expect(laravelSkills.some(s => s.id === 'laravel')).toBe(true)
    })

    test('retorna array vazio para agente sem skills', () => {
      const skills = loadDefaultSkills()
      const unknownAgentSkills = getSkillsForAgent('unknown-agent', skills)

      expect(unknownAgentSkills).toHaveLength(0)
    })

    test('retorna múltiplas skills para mesmo agente', () => {
      writeFileSync(join(tmpDir, 'artisan'), '')
      writeFileSync(join(tmpDir, 'composer.json'), '{}')
      mkdirSync(join(tmpDir, 'app', 'Livewire'), { recursive: true })

      const skills = detectSkills(tmpDir)
      const coderSkills = getSkillsForAgent('coder', skills)

      expect(coderSkills.length).toBeGreaterThanOrEqual(2)
    })
  })

  describe('buildSkillContext', () => {
    test('retorna string vazia para agente sem skills', () => {
      const context = buildSkillContext('coder', [])

      expect(context).toBe('')
    })

    test('retorna contexto formatado com skills', () => {
      const skills = loadDefaultSkills().filter(s => s.id === 'laravel')
      const context = buildSkillContext('coder', skills)

      expect(context).toContain('## Conhecimento Especializado de Domínio')
      expect(context).toContain('Laravel 12')
    })

    test('inclui context_injection de cada skill', () => {
      const skills = loadDefaultSkills().filter(s => s.id === 'laravel')
      const context = buildSkillContext('coder', skills)

      expect(context).toContain('app/Http/Controllers/')
    })

    test('concatena múltiplas skills', () => {
      const skills = loadDefaultSkills().filter(s => s.id === 'laravel' || s.id === 'livewire')
      const context = buildSkillContext('coder', skills)

      expect(context).toContain('Laravel 12')
      expect(context).toContain('Livewire')
    })
  })
})
