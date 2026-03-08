// ============================================================
// CoreOps — Gemini CLI Adapter
// Usa o `gemini` CLI já autenticado (Google AI)
// Não requer API key — usa a sessão ativa do usuário
// ============================================================

import type { LLMAdapter, LLMRequest, LLMResponse } from './types.ts'

export class GeminiCliAdapter implements LLMAdapter {
  constructor(private readonly model?: string) {}

  async complete(request: LLMRequest): Promise<LLMResponse> {
    const fullPrompt = this.buildPrompt(request)

    const args: string[] = [fullPrompt]

    if (this.model) {
      args.push('--model', this.model)
    }

    const proc = Bun.spawn(['gemini', ...args], {
      stdout: 'pipe',
      stderr: 'pipe',
    })

    const [stdout, stderr] = await Promise.all([
      new Response(proc.stdout).text(),
      new Response(proc.stderr).text(),
    ])

    const exitCode = await proc.exited

    if (exitCode !== 0) {
      throw new Error(`Gemini CLI falhou (exit ${exitCode}): ${stderr.trim() || stdout.trim()}`)
    }

    const content = stdout.trim()
    if (!content) {
      throw new Error('Gemini CLI retornou resposta vazia.')
    }

    return {
      content,
      model: this.model ?? 'gemini-cli',
      input_tokens: 0,
      output_tokens: 0,
    }
  }

  private buildPrompt(request: LLMRequest): string {
    const parts: string[] = []

    if (request.system) {
      parts.push(`${request.system}\n`)
    }

    for (const msg of request.messages) {
      parts.push(msg.content)
    }

    return parts.join('\n\n')
  }

  static async isAvailable(): Promise<boolean> {
    try {
      const proc = Bun.spawn(['gemini', '--version'], {
        stdout: 'pipe',
        stderr: 'pipe',
      })
      const exitCode = await proc.exited
      return exitCode === 0
    } catch {
      return false
    }
  }
}
