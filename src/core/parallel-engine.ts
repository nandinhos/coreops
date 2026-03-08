// ============================================================
// CoreOps — Parallel Execution Engine
// Executa microtasks em ondas baseadas em grafo de dependências (DAG).
// Microtasks sem dependências pendentes rodam concorrentemente.
// ============================================================

import type { Microtask } from './types.ts'

export interface WaveResult {
  wave_number: number
  microtask_ids: string[]
  completed: string[]
  failed: string[]
}

export interface ParallelEngineOptions {
  /** Limite de concorrência por onda. 0 = ilimitado. */
  max_concurrency: number
  onWaveStart?: (wave: number, ids: string[]) => void | Promise<void>
  onWaveEnd?: (result: WaveResult) => void | Promise<void>
}

const DEFAULT_OPTIONS: ParallelEngineOptions = {
  max_concurrency: 0,
}

/**
 * Resolve a próxima onda de microtasks prontas para execução.
 * "Pronta" = todas as dependências estão no conjunto `completed`.
 */
export function resolveNextWave(
  remaining: Microtask[],
  completed: Set<string>,
  maxConcurrency: number,
): Microtask[] {
  const wave = remaining.filter((m) =>
    m.dependencies.every((dep) => completed.has(dep)),
  )

  if (maxConcurrency > 0) {
    return wave.slice(0, maxConcurrency)
  }

  return wave
}

/**
 * Verifica se há dependências circulares ou não resolvíveis no conjunto restante.
 */
export function hasUnresolvableDependencies(
  remaining: Microtask[],
  completed: Set<string>,
): boolean {
  return resolveNextWave(remaining, completed, 0).length === 0
}

export class ParallelExecutionEngine {
  private readonly options: ParallelEngineOptions

  constructor(options: Partial<ParallelEngineOptions> = {}) {
    this.options = { ...DEFAULT_OPTIONS, ...options }
  }

  /**
   * Executa todas as microtasks em ondas paralelas.
   * Chama `executor` para cada microtask e rastreia resultado.
   * Retorna ids das microtasks que falharam.
   */
  async run(
    microtasks: Microtask[],
    executor: (microtask: Microtask) => Promise<void>,
  ): Promise<{ failed: string[] }> {
    const completed = new Set<string>()
    const failed: string[] = []
    let remaining = [...microtasks]
    let waveNumber = 0

    while (remaining.length > 0) {
      const wave = resolveNextWave(remaining, completed, this.options.max_concurrency)

      if (wave.length === 0) {
        // Dependências circulares ou não resolvíveis — execução sequencial do restante
        for (const m of remaining) {
          try {
            await executor(m)
            completed.add(m.id)
          } catch {
            failed.push(m.id)
            completed.add(m.id) // marca como processada para não travar
          }
        }
        break
      }

      waveNumber++
      const waveIds = wave.map((m) => m.id)
      await this.options.onWaveStart?.(waveNumber, waveIds)

      const waveCompleted: string[] = []
      const waveFailed: string[] = []

      const results = await Promise.allSettled(wave.map((m) => executor(m)))

      results.forEach((result, i) => {
        const id = wave[i]!.id
        if (result.status === 'fulfilled') {
          completed.add(id)
          waveCompleted.push(id)
        } else {
          failed.push(id)
          waveFailed.push(id)
          completed.add(id) // marca como processada para não travar próximas ondas
        }
      })

      await this.options.onWaveEnd?.({
        wave_number: waveNumber,
        microtask_ids: waveIds,
        completed: waveCompleted,
        failed: waveFailed,
      })

      remaining = remaining.filter((m) => !completed.has(m.id))
    }

    return { failed }
  }
}
