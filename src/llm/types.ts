// ============================================================
// CoreOps — LLM Adapter Types
// Abstração para chamadas a modelos de linguagem
// ============================================================

export interface LLMMessage {
  role: 'user' | 'assistant'
  content: string
}

export interface LLMRequest {
  messages: LLMMessage[]
  system?: string
  max_tokens?: number
  temperature?: number
}

export interface LLMResponse {
  content: string
  model: string
  input_tokens: number
  output_tokens: number
}

export interface LLMAdapter {
  complete(request: LLMRequest): Promise<LLMResponse>
}
