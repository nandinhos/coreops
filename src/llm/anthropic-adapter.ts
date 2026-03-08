// ============================================================
// CoreOps — Anthropic LLM Adapter
// Integração com a API da Anthropic (Claude)
// ============================================================

import Anthropic from '@anthropic-ai/sdk'
import type { LLMAdapter, LLMRequest, LLMResponse } from './types.ts'

export class AnthropicAdapter implements LLMAdapter {
  private readonly client: Anthropic
  private readonly model: string

  constructor(apiKey: string, model = 'claude-sonnet-4-6') {
    this.client = new Anthropic({ apiKey })
    this.model = model
  }

  async complete(request: LLMRequest): Promise<LLMResponse> {
    const maxRetries = 3
    let lastError: Error | null = null

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const response = await this.client.messages.create({
          model: this.model,
          max_tokens: request.max_tokens ?? 8192,
          system: request.system,
          messages: request.messages.map((m) => ({
            role: m.role,
            content: m.content,
          })),
        })

        const textBlock = response.content.find((b) => b.type === 'text')
        if (!textBlock || textBlock.type !== 'text') {
          throw new Error('Resposta do Claude não contém bloco de texto.')
        }

        return {
          content: textBlock.text,
          model: response.model,
          input_tokens: response.usage.input_tokens,
          output_tokens: response.usage.output_tokens,
        }
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error))

        // Não retry em erros de autenticação ou bad request
        const errorMessage = lastError.message.toLowerCase()
        if (
          errorMessage.includes('authentication') ||
          errorMessage.includes('invalid_api_key') ||
          errorMessage.includes('bad request')
        ) {
          throw lastError
        }

        if (attempt < maxRetries) {
          const delay = Math.pow(2, attempt) * 1000
          await new Promise((resolve) => setTimeout(resolve, delay))
        }
      }
    }

    throw lastError ?? new Error('Falha desconhecida no LLM adapter.')
  }
}

// Helper para parsear JSON da resposta do LLM com segurança
export function parseJsonResponse<T>(content: string): T {
  // Extrair JSON de blocos de código se necessário
  const jsonMatch = content.match(/```(?:json)?\n?([\s\S]*?)\n?```/)
  const jsonStr = jsonMatch ? jsonMatch[1]! : content

  try {
    return JSON.parse(jsonStr.trim()) as T
  } catch {
    throw new Error(`Resposta do LLM não é JSON válido:\n${jsonStr.substring(0, 200)}...`)
  }
}
