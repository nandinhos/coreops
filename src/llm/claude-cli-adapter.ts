// ============================================================
// CoreOps — Claude CLI Adapter
// Usa o `claude --print` do Claude Code CLI já autenticado
// Não requer ANTHROPIC_API_KEY — usa a sessão ativa do usuário
// ============================================================

import type { LLMAdapter, LLMRequest, LLMResponse } from './types.ts'

export class ClaudeCliAdapter implements LLMAdapter {
  constructor(private readonly model?: string) {}

  async complete(request: LLMRequest): Promise<LLMResponse> {
    // Montar prompt combinando system + mensagens
    const fullPrompt = this.buildPrompt(request)

    const args = ['--print', fullPrompt]

    if (this.model) {
      args.push('--model', this.model)
    }

    // Sem chamadas interativas — modo não-interativo
    args.push('--output-format', 'text')

    const proc = Bun.spawn(['claude', ...args], {
      stdout: 'pipe',
      stderr: 'pipe',
    })

    const [stdout, stderr] = await Promise.all([
      new Response(proc.stdout).text(),
      new Response(proc.stderr).text(),
    ])

    const exitCode = await proc.exited

    if (exitCode !== 0) {
      throw new Error(`Claude CLI falhou (exit ${exitCode}): ${stderr.trim() || stdout.trim()}`)
    }

    const content = stdout.trim()
    if (!content) {
      throw new Error('Claude CLI retornou resposta vazia.')
    }

    return {
      content,
      model: this.model ?? 'claude-cli',
      input_tokens: 0,  // CLI não expõe contagem de tokens
      output_tokens: 0,
    }
  }

  private buildPrompt(request: LLMRequest): string {
    const parts: string[] = []

    if (request.system) {
      parts.push(`[SYSTEM]\n${request.system}\n[/SYSTEM]\n`)
    }

    for (const msg of request.messages) {
      if (msg.role === 'user') {
        parts.push(msg.content)
      } else {
        parts.push(`[ASSISTANT CONTEXT]\n${msg.content}\n[/ASSISTANT CONTEXT]`)
      }
    }

    return parts.join('\n\n')
  }

  static async isAvailable(): Promise<boolean> {
    try {
      const proc = Bun.spawn(['claude', '--version'], {
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
