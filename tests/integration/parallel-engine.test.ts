import { test, expect, describe } from 'bun:test'
import { ParallelExecutionEngine, resolveNextWave, hasUnresolvableDependencies } from '../../src/core/parallel-engine.ts'
import type { Microtask } from '../../src/core/types.ts'

function makeMicrotask(id: string, deps: string[] = []): Microtask {
  return {
    id,
    task_id: 'task-1',
    description: `Microtask ${id}`,
    dependencies: deps,
    concurrency_group: null,
    status: 'pending',
    retry_count: 0,
    created_at: new Date().toISOString(),
    completed_at: null,
  }
}

describe('resolveNextWave', () => {
  test('retorna todas as microtasks sem deps quando completed está vazio', () => {
    const tasks = [makeMicrotask('a'), makeMicrotask('b'), makeMicrotask('c', ['a'])]
    const wave = resolveNextWave(tasks, new Set(), 0)
    expect(wave.map((m) => m.id)).toEqual(['a', 'b'])
  })

  test('retorna microtask com dep satisfeita', () => {
    const tasks = [makeMicrotask('c', ['a'])]
    const wave = resolveNextWave(tasks, new Set(['a']), 0)
    expect(wave.map((m) => m.id)).toEqual(['c'])
  })

  test('respeita max_concurrency', () => {
    const tasks = [makeMicrotask('a'), makeMicrotask('b'), makeMicrotask('c')]
    const wave = resolveNextWave(tasks, new Set(), 2)
    expect(wave.length).toBe(2)
  })

  test('retorna vazio quando todas têm deps pendentes', () => {
    const tasks = [makeMicrotask('b', ['a']), makeMicrotask('c', ['b'])]
    const wave = resolveNextWave(tasks, new Set(), 0)
    expect(wave).toHaveLength(0)
  })
})

describe('hasUnresolvableDependencies', () => {
  test('retorna false quando há wave disponível', () => {
    const tasks = [makeMicrotask('a'), makeMicrotask('b', ['a'])]
    expect(hasUnresolvableDependencies(tasks, new Set())).toBe(false)
  })

  test('retorna true em dependência circular', () => {
    const tasks = [makeMicrotask('a', ['b']), makeMicrotask('b', ['a'])]
    expect(hasUnresolvableDependencies(tasks, new Set())).toBe(true)
  })
})

describe('ParallelExecutionEngine', () => {
  test('executa microtasks independentes em paralelo (mesma onda)', async () => {
    const order: string[] = []
    const startTimes: Record<string, number> = {}
    const engine = new ParallelExecutionEngine()

    const tasks = [makeMicrotask('a'), makeMicrotask('b'), makeMicrotask('c')]

    await engine.run(tasks, async (m) => {
      startTimes[m.id] = Date.now()
      await new Promise((r) => setTimeout(r, 20))
      order.push(m.id)
    })

    // Todas 3 devem ter sido iniciadas quase ao mesmo tempo (dentro de 15ms)
    const times = Object.values(startTimes)
    const spread = Math.max(...times) - Math.min(...times)
    expect(spread).toBeLessThan(15)
    expect(order).toHaveLength(3)
  })

  test('respeita ordem de dependências entre ondas', async () => {
    const order: string[] = []
    const engine = new ParallelExecutionEngine()

    const tasks = [
      makeMicrotask('a'),
      makeMicrotask('b', ['a']),
      makeMicrotask('c', ['b']),
    ]

    await engine.run(tasks, async (m) => {
      order.push(m.id)
    })

    expect(order).toEqual(['a', 'b', 'c'])
  })

  test('executa onda mista: independentes em paralelo, dependentes depois', async () => {
    const waves: string[][] = []
    const engine = new ParallelExecutionEngine({
      max_concurrency: 0,
      onWaveStart: (_, ids) => { waves.push([...ids]) },
    })

    const tasks = [
      makeMicrotask('a'),
      makeMicrotask('b'),
      makeMicrotask('c', ['a', 'b']),
    ]

    await engine.run(tasks, async () => {})

    expect(waves).toHaveLength(2)
    expect(waves[0]!.sort()).toEqual(['a', 'b'])
    expect(waves[1]).toEqual(['c'])
  })

  test('continua execução mesmo quando uma microtask falha', async () => {
    const executed: string[] = []
    const engine = new ParallelExecutionEngine()

    const tasks = [makeMicrotask('a'), makeMicrotask('b'), makeMicrotask('c', ['a'])]

    const { failed } = await engine.run(tasks, async (m) => {
      executed.push(m.id)
      if (m.id === 'a') throw new Error('falhou')
    })

    expect(failed).toContain('a')
    expect(executed).toContain('b')
    // c depende de a (que falhou mas foi marcada como processed)
    expect(executed).toContain('c')
  })

  test('respeita max_concurrency por onda', async () => {
    const concurrent: number[] = []
    let active = 0
    const engine = new ParallelExecutionEngine({ max_concurrency: 2 })

    const tasks = [makeMicrotask('a'), makeMicrotask('b'), makeMicrotask('c'), makeMicrotask('d')]

    await engine.run(tasks, async () => {
      active++
      concurrent.push(active)
      await new Promise((r) => setTimeout(r, 10))
      active--
    })

    expect(Math.max(...concurrent)).toBeLessThanOrEqual(2)
  })

  test('lida com dependências circulares sem deadlock (fallback sequencial)', async () => {
    const executed: string[] = []
    const engine = new ParallelExecutionEngine()

    // a→b e b→a: circular
    const tasks = [makeMicrotask('a', ['b']), makeMicrotask('b', ['a'])]

    await engine.run(tasks, async (m) => {
      executed.push(m.id)
    })

    expect(executed).toHaveLength(2)
  })

  test('emite eventos de onda corretamente', async () => {
    const waveEvents: Array<{ wave: number; ids: string[] }> = []
    const engine = new ParallelExecutionEngine({
      onWaveStart: (wave, ids) => { waveEvents.push({ wave, ids }) },
    })

    const tasks = [makeMicrotask('x'), makeMicrotask('y', ['x'])]
    await engine.run(tasks, async () => {})

    expect(waveEvents).toHaveLength(2)
    expect(waveEvents[0]!.wave).toBe(1)
    expect(waveEvents[1]!.wave).toBe(2)
  })
})
