// ============================================================
// CoreOps — Sandbox Unit Tests
// ============================================================

import { describe, test, expect } from 'bun:test'
import { Sandbox } from '../../src/sandbox/sandbox.ts'

const sandbox = new Sandbox()

describe('Sandbox — basic execution', () => {
  test('executa comando bem-sucedido', async () => {
    const result = await sandbox.run('echo', ['hello'])
    expect(result.success).toBe(true)
    expect(result.exit_code).toBe(0)
    expect(result.stdout.trim()).toBe('hello')
    expect(result.timed_out).toBe(false)
    expect(result.duration_ms).toBeGreaterThan(0)
  })

  test('captura saída de stderr', async () => {
    // ls em diretório inexistente gera stderr
    const result = await sandbox.run('ls', ['/caminho/que/nao/existe/xyz'])
    expect(result.success).toBe(false)
    expect(result.exit_code).not.toBe(0)
    expect(result.stderr.length).toBeGreaterThan(0)
  })

  test('retorna exit_code correto em falha', async () => {
    const result = await sandbox.run('false', [])
    expect(result.success).toBe(false)
    expect(result.exit_code).not.toBe(0)
  })

  test('combina stdout e stderr em output', async () => {
    const result = await sandbox.run('echo', ['test'])
    expect(result.output).toContain('test')
  })

  test('respeita cwd', async () => {
    const result = await sandbox.run('pwd', [], { cwd: '/tmp' })
    expect(result.success).toBe(true)
    expect(result.stdout.trim()).toBe('/tmp')
  })
})

describe('Sandbox — timeout', () => {
  test('mata processo após timeout', async () => {
    const result = await sandbox.run('sleep', ['10'], { timeout_ms: 100 })
    expect(result.timed_out).toBe(true)
    expect(result.success).toBe(false)
    expect(result.exit_code).toBe(-1)
  })

  test('não faz timeout em processo rápido', async () => {
    const result = await sandbox.run('echo', ['ok'], { timeout_ms: 5000 })
    expect(result.timed_out).toBe(false)
    expect(result.success).toBe(true)
  })
})

describe('Sandbox — output limits', () => {
  test('trunca output grande', async () => {
    // Gerar ~10KB de output
    const result = await sandbox.run('yes', ['x'], {
      timeout_ms: 200,
      max_output_bytes: 100,
    })
    // Processo vai ser morto por timeout ou output truncado
    // O importante é que output respeita o limite aproximado
    expect(result.stdout.length).toBeLessThanOrEqual(200) // margem para a mensagem de truncagem
  })
})
