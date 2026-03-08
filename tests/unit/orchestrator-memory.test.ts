// ============================================================
// CoreOps — Orchestrator.addMemory() Unit Tests
// Testa validação de MemoryType e comportamento síncrono
// ============================================================

import { describe, test, expect, beforeAll } from 'bun:test'
import { mkdirSync } from 'node:fs'
import { Orchestrator } from '../../src/core/orchestrator.ts'
import { loadConfig } from '../../src/core/types.ts'

const TMP_DIR = '/tmp/coreops-orch-mem-test-' + Date.now()

let orchestrator: Orchestrator

beforeAll(async () => {
  mkdirSync(TMP_DIR, { recursive: true })
  const origCwd = process.cwd
  process.cwd = () => TMP_DIR
  const config = loadConfig()
  orchestrator = new Orchestrator(config)
  await orchestrator.startProject('test-proj', 'Teste de validação de memória')
  process.cwd = origCwd
})

describe('Orchestrator.addMemory() — validação de tipo', () => {
  test('aceita tipo válido: decision', async () => {
    await expect(
      orchestrator.addMemory('Título', 'Conteúdo', 'decision'),
    ).resolves.toBeUndefined()
  })

  test('aceita tipo válido: pattern', async () => {
    await expect(
      orchestrator.addMemory('Título', 'Conteúdo', 'pattern'),
    ).resolves.toBeUndefined()
  })

  test('aceita tipo válido: lesson', async () => {
    await expect(
      orchestrator.addMemory('Título', 'Conteúdo', 'lesson'),
    ).resolves.toBeUndefined()
  })

  test('aceita tipo válido: context', async () => {
    await expect(
      orchestrator.addMemory('Título', 'Conteúdo', 'context'),
    ).resolves.toBeUndefined()
  })

  test('rejeita tipo inválido com erro descritivo', async () => {
    await expect(
      orchestrator.addMemory('Título', 'Conteúdo', 'unknown-type'),
    ).rejects.toThrow(/invalid memory type/i)
  })

  test('rejeita string vazia como tipo', async () => {
    await expect(
      orchestrator.addMemory('Título', 'Conteúdo', ''),
    ).rejects.toThrow(/invalid memory type/i)
  })
})
