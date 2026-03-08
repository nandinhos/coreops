// ============================================================
// CoreOps — MemoryStore Unit Tests
// Usa banco in-memory (':memory:') para isolamento
// ============================================================

import { describe, test, expect, beforeEach, afterEach } from 'bun:test'
import { MemoryStore } from '../../src/memory/memory-store.ts'

let store: MemoryStore

beforeEach(() => {
  store = new MemoryStore(':memory:')
})

afterEach(() => {
  store.close()
})

describe('MemoryStore — basic operations', () => {
  test('add() retorna memória com id e timestamp', () => {
    const m = store.add({
      project: 'my-project',
      phase: 'PLANNING',
      type: 'decision',
      title: 'Usar PostgreSQL',
      content: 'Decidido usar PostgreSQL como banco principal pela robustez.',
      tags: ['db', 'postgres'],
    })

    expect(m.id).toHaveLength(12)
    expect(m.project).toBe('my-project')
    expect(m.phase).toBe('PLANNING')
    expect(m.type).toBe('decision')
    expect(m.title).toBe('Usar PostgreSQL')
    expect(m.tags).toEqual(['db', 'postgres'])
    expect(m.created_at).toBeLessThanOrEqual(Date.now())
  })

  test('add() funciona sem tags', () => {
    const m = store.add({
      project: 'proj',
      phase: 'CODING',
      type: 'lesson',
      title: 'Sempre validar input',
      content: 'Nunca confiar em input externo.',
    })
    expect(m.tags).toEqual([])
  })

  test('list() retorna entradas mais recentes primeiro', () => {
    store.add({ project: 'p', phase: 'IDEA', type: 'context', title: 'Primeiro', content: 'A' })
    store.add({ project: 'p', phase: 'IDEA', type: 'context', title: 'Segundo', content: 'B' })

    const memories = store.list()
    expect(memories.length).toBe(2)
    expect(memories[0]!.title).toBe('Segundo')
    expect(memories[1]!.title).toBe('Primeiro')
  })

  test('list() filtra por projeto', () => {
    store.add({ project: 'proj-a', phase: 'IDEA', type: 'context', title: 'A', content: 'a' })
    store.add({ project: 'proj-b', phase: 'IDEA', type: 'context', title: 'B', content: 'b' })
    store.add({ project: 'proj-a', phase: 'IDEA', type: 'context', title: 'C', content: 'c' })

    const memories = store.list('proj-a')
    expect(memories.length).toBe(2)
    expect(memories.every((m) => m.project === 'proj-a')).toBe(true)
  })

  test('getById() retorna a memória correta', () => {
    const added = store.add({
      project: 'proj',
      phase: 'CODING',
      type: 'pattern',
      title: 'Repository Pattern',
      content: 'Usar repository para abstrair acesso a dados.',
    })

    const found = store.getById(added.id)
    expect(found).not.toBeNull()
    expect(found!.id).toBe(added.id)
    expect(found!.title).toBe('Repository Pattern')
  })

  test('getById() retorna null para id inexistente', () => {
    expect(store.getById('nao-existe')).toBeNull()
  })

  test('delete() remove a memória', () => {
    const m = store.add({ project: 'p', phase: 'IDEA', type: 'context', title: 'Temp', content: 'Remover' })
    expect(store.delete(m.id)).toBe(true)
    expect(store.getById(m.id)).toBeNull()
  })

  test('delete() retorna false para id inexistente', () => {
    expect(store.delete('nao-existe')).toBe(false)
  })

  test('count() retorna total correto', () => {
    expect(store.count()).toBe(0)
    store.add({ project: 'p', phase: 'IDEA', type: 'context', title: 'T1', content: 'C1' })
    store.add({ project: 'p', phase: 'IDEA', type: 'context', title: 'T2', content: 'C2' })
    expect(store.count()).toBe(2)
  })

  test('count() filtra por projeto', () => {
    store.add({ project: 'a', phase: 'IDEA', type: 'context', title: 'T', content: 'C' })
    store.add({ project: 'b', phase: 'IDEA', type: 'context', title: 'T', content: 'C' })
    expect(store.count('a')).toBe(1)
    expect(store.count('b')).toBe(1)
  })

  test('projects() lista projetos únicos', () => {
    store.add({ project: 'alpha', phase: 'IDEA', type: 'context', title: 'T', content: 'C' })
    store.add({ project: 'beta', phase: 'IDEA', type: 'context', title: 'T', content: 'C' })
    store.add({ project: 'alpha', phase: 'IDEA', type: 'context', title: 'T2', content: 'C2' })

    const projects = store.projects()
    expect(projects).toContain('alpha')
    expect(projects).toContain('beta')
    expect(new Set(projects).size).toBe(projects.length) // sem duplicatas
  })
})

describe('MemoryStore — FTS search', () => {
  beforeEach(() => {
    store.add({
      project: 'api-users',
      phase: 'PLANNING',
      type: 'decision',
      title: 'Autenticação JWT',
      content: 'Decidido usar JWT com RS256 para autenticação stateless.',
      tags: ['auth', 'jwt'],
    })
    store.add({
      project: 'api-users',
      phase: 'CODING',
      type: 'pattern',
      title: 'Repository Pattern',
      content: 'Abstrair acesso a dados com repositórios para facilitar testes.',
      tags: ['pattern', 'ddd'],
    })
    store.add({
      project: 'ecommerce',
      phase: 'PLANNING',
      type: 'decision',
      title: 'Banco PostgreSQL',
      content: 'Usar PostgreSQL pela robustez e suporte a JSON.',
      tags: ['db'],
    })
  })

  test('search() encontra por título', () => {
    const results = store.search('JWT')
    expect(results.length).toBeGreaterThan(0)
    expect(results[0]!.title).toBe('Autenticação JWT')
  })

  test('search() encontra por conteúdo', () => {
    const results = store.search('repositórios')
    expect(results.length).toBe(1)
    expect(results[0]!.type).toBe('pattern')
  })

  test('search() filtra por projeto', () => {
    const all = store.search('PostgreSQL')
    expect(all.length).toBe(1)

    const fromWrong = store.search('PostgreSQL', 'api-users')
    expect(fromWrong.length).toBe(0)

    const fromRight = store.search('PostgreSQL', 'ecommerce')
    expect(fromRight.length).toBe(1)
  })

  test('search() retorna vazio para query sem match', () => {
    const results = store.search('xyzzy404')
    expect(results).toEqual([])
  })
})
