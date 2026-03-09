import { describe, test, expect, beforeEach, afterEach } from 'bun:test'
import { ErrorStore, normalizeError } from '../../src/memory/error-store.ts'
import { rmSync, mkdirSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

describe('ErrorStore', () => {
  let store: ErrorStore
  let tmpDir: string

  beforeEach(() => {
    tmpDir = join(tmpdir(), 'coreops-test-' + Date.now())
    mkdirSync(tmpDir, { recursive: true })
    store = new ErrorStore(join(tmpDir, 'errors.db'))
  })

  afterEach(() => {
    store.close()
    rmSync(tmpDir, { recursive: true, force: true })
  })

  describe('normalizeError', () => {
    test('normaliza line numbers', () => {
      const input = 'Error at line 42: something failed'
      const result = normalizeError(input)
      expect(result).toContain('line n')
    })

    test('normaliza line:col patterns', () => {
      const input = 'src/app.ts:15:20: error'
      const result = normalizeError(input)
      expect(result).not.toContain('15:20')
      expect(result).toContain('n:n')
    })

    test('normaliza UUIDs', () => {
      const input = 'error-id: 123e4567-e89b-12d3-a456-426614174000'
      const result = normalizeError(input)
      expect(result).not.toContain('123e4567')
      expect(result).toContain('uuid')
    })

    test('normaliza file paths', () => {
      const input = 'Error in /home/user/project/src/services/auth.ts'
      const result = normalizeError(input)
      expect(result).not.toContain('auth.ts')
      expect(result).toContain('/file.ext')
    })

    test('limita a 300 caracteres', () => {
      const input = 'a'.repeat(500)
      const result = normalizeError(input)
      expect(result.length).toBeLessThanOrEqual(300)
    })

    test('remove excesso de espaços', () => {
      const input = 'error    with    many     spaces'
      const result = normalizeError(input)
      expect(result).not.toContain('    ')
    })
  })

  describe('record', () => {
    test('salva novo erro no banco', () => {
      const record = store.record('TypeError: undefined', 'Variável não inicializada', 'Inicializar variável', 'test-project')

      expect(record.id).toBeDefined()
      expect(record.error_signature).toBeDefined()
    })

    test('retorna erro existente com occurrence_count incrementado', () => {
      store.record('TypeError: undefined', 'Variável não inicializada', 'Inicializar variável', 'test-project')
      const second = store.record('TypeError: undefined', 'Variável não inicializada', 'Inicializar variável', 'test-project')

      expect(second.occurrence_count).toBe(2)
    })
  })

  describe('findSimilar', () => {
    test('encontra erros similares por assinatura', () => {
      store.record('ReferenceError: x is not defined', 'Variável não declarada', 'Declarar variável antes de usar', 'my-api')

      const matches = store.findSimilar('ReferenceError: y is not defined')
      expect(matches.length).toBeGreaterThan(0)
    })

    test('retorna array vazio para erros não encontrados', () => {
      const matches = store.findSimilar('Erro completamente diferente xyz123')
      expect(matches).toHaveLength(0)
    })

    test('retorna resultados ordenados por occurrence_count', () => {
      store.record('SyntaxError: unexpected token', 'Token inválido', 'Corrigir token', 'test')
      store.record('SyntaxError: unexpected token', 'Token inválido', 'Corrigir token', 'test')

      const matches = store.findSimilar('SyntaxError: unexpected token')
      expect(matches.length).toBeGreaterThan(0)
      expect(matches[0]!.occurrence_count).toBeGreaterThanOrEqual(1)
    })
  })

  describe('bumpOccurrence', () => {
    test('incrementa contador de ocorrências', () => {
      const record = store.record('Error test bump', 'Causa', 'Fix', 'proj')
      const initial = store.getById(record.id)
      expect(initial?.occurrence_count).toBe(1)

      store.bumpOccurrence(record.id)

      const after = store.getById(record.id)
      expect(after?.occurrence_count).toBe(2)
    })
  })

  describe('getById', () => {
    test('retorna erro por id', () => {
      const created = store.record('Error getById test', 'Cause', 'Fix', 'proj')
      const found = store.getById(created.id)

      expect(found).not.toBeNull()
      expect(found?.root_cause).toBe('Cause')
    })

    test('retorna null para id inexistente', () => {
      const found = store.getById('inexistente-id')
      expect(found).toBeNull()
    })
  })

  describe('list', () => {
    test('lista erros ordenados por last_seen_at', () => {
      store.record('Error 1', 'Cause 1', 'Fix 1', 'proj')
      store.record('Error 2', 'Cause 2', 'Fix 2', 'proj')

      const list = store.list(10)
      expect(list.length).toBe(2)
    })

    test('limita resultados', () => {
      for (let i = 0; i < 5; i++) {
        store.record(`Error ${i}`, `Cause ${i}`, `Fix ${i}`, 'proj')
      }

      const list = store.list(3)
      expect(list.length).toBe(3)
    })
  })

  describe('projeto específico', () => {
    test('associa erros a projetos diferentes com erros distintos', () => {
      store.record('Error A para projeto A', 'Cause A', 'Fix A', 'project-a')
      store.record('Error B para projeto B', 'Cause B', 'Fix B', 'project-b')

      const list = store.list(10)
      const projects = list.map(r => r.project)

      expect(projects).toContain('project-a')
      expect(projects).toContain('project-b')
    })
  })
})
