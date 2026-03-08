// ============================================================
// CoreOps — Validator Agent
// Executa validação real: typecheck + testes em sandbox isolado
// ============================================================

import { BaseAgent } from './agent.ts'
import type { ValidationResult } from '../core/types.ts'
import { Sandbox } from '../sandbox/sandbox.ts'

const VALIDATOR_TIMEOUT_MS = 180_000 // 3 min para testes longos

export class ValidatorAgent extends BaseAgent<string, ValidationResult> {
  readonly name = 'validator'

  private readonly sandbox = new Sandbox()

  async execute(workspacePath: string): Promise<ValidationResult> {
    const start = Date.now()
    const errors: string[] = []
    const warnings: string[] = []

    // Typecheck
    const typecheckResult = await this.sandbox.run('bunx', ['tsc', '--noEmit'], {
      cwd: workspacePath,
      timeout_ms: 60_000,
    })

    if (typecheckResult.timed_out) {
      errors.push('[Timeout] TypeScript check excedeu 60 segundos.')
    } else if (!typecheckResult.success) {
      errors.push(...parseErrors(typecheckResult.output))
    }

    // Testes (apenas se typecheck passou)
    if (errors.length === 0) {
      const testResult = await this.sandbox.run('bun', ['test', '--bail'], {
        cwd: workspacePath,
        timeout_ms: VALIDATOR_TIMEOUT_MS,
      })

      if (testResult.timed_out) {
        errors.push('[Timeout] Testes excederam ' + Math.floor(VALIDATOR_TIMEOUT_MS / 1000) + ' segundos.')
      } else if (!testResult.success) {
        errors.push(...parseErrors(testResult.output))
      } else {
        const warnLines = testResult.output
          .split('\n')
          .filter((l) => l.toLowerCase().includes('warn'))
        warnings.push(...warnLines)
      }
    }

    return {
      success: errors.length === 0,
      errors,
      warnings,
      duration_ms: Date.now() - start,
    }
  }
}

function parseErrors(output: string): string[] {
  return output
    .split('\n')
    .filter((l) => l.trim().length > 0)
    .filter(
      (l) =>
        l.toLowerCase().includes('error') ||
        l.toLowerCase().includes('fail') ||
        l.toLowerCase().includes('✗') ||
        l.includes('×') ||
        l.includes('[Timeout]'),
    )
    .slice(0, 20)
}
