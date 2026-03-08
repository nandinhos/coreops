// ============================================================
// CoreOps — LLM Adapter Factory
// Auto-detecta qual LLM está disponível no ambiente atual
//
// Ordem de preferência:
//   1. claude CLI  (Claude Code — sessão já autenticada)
//   2. gemini CLI  (Gemini CLI  — sessão já autenticada)
//   3. Anthropic API direta (ANTHROPIC_API_KEY configurada)
//
// O sistema funciona sem API key quando rodando dentro
// de um ambiente de IA como Claude Code ou Gemini CLI.
// ============================================================

import type { LLMAdapter } from './types.ts'
import { ClaudeCliAdapter } from './claude-cli-adapter.ts'
import { GeminiCliAdapter } from './gemini-cli-adapter.ts'
import { AnthropicAdapter } from './anthropic-adapter.ts'
import { ResponseCache, CachedLLMAdapter } from './response-cache.ts'
import { FallbackAdapter } from './fallback-adapter.ts'

export type AdapterSource = 'claude-cli' | 'gemini-cli' | 'anthropic-api' | 'fallback-chain'

export interface AdapterResult {
  adapter: LLMAdapter
  source: AdapterSource
}

export async function createAdapter(config: {
  anthropic_api_key?: string
  model?: string
  prefer?: AdapterSource
  enable_cache?: boolean
}): Promise<AdapterResult> {
  let adaptersList: LLMAdapter[] = []

  // Obter as disponibilidades ativas no sistema host
  const [claudeAvailable, geminiAvailable] = await Promise.all([
    ClaudeCliAdapter.isAvailable(),
    GeminiCliAdapter.isAvailable(),
  ])

  // Preferência explícita via config ou variável de ambiente
  let prefer = config.prefer ?? (process.env['COREOPS_ADAPTER'] as AdapterSource | undefined)

  // Auto-detecção inteligente do chat/CLI ativo (quando o usuário não fixa a variável manualmente)
  if (!prefer) {
    if (process.env['GEMINI_CLI_IDE_SERVER_PORT'] || process.env['ANTIGRAVITY_AGENT']) {
      prefer = 'gemini-cli' // Identificou motor do Gemini CLI no processo
    } else if (process.env['CLAUDE_CODE_SSE_PORT']) {
      prefer = 'claude-cli' // Identificou motor do Claude Code no processo
    }
  }

  // Tratando as prioridades da fila de processamento:
  // Colocamos o motor da sessão ativa/preferido no topo, e os demais (se disponíveis) como fallback

  // 1. Inserindo o prioritário (se houver e estiver disponível)
  if (prefer === 'claude-cli' && claudeAvailable) {
    adaptersList.push(new ClaudeCliAdapter(config.model))
  } else if (prefer === 'gemini-cli' && geminiAvailable) {
    adaptersList.push(new GeminiCliAdapter(config.model))
  } else if (prefer === 'anthropic-api' && config.anthropic_api_key) {
    adaptersList.push(new AnthropicAdapter(config.anthropic_api_key, config.model))
  }

  // 2. Inserindo os demais como Fallback
  if (prefer !== 'claude-cli' && claudeAvailable) {
    adaptersList.push(new ClaudeCliAdapter(config.model))
  }
  if (prefer !== 'gemini-cli' && geminiAvailable) {
    adaptersList.push(new GeminiCliAdapter(config.model))
  }
  if (prefer !== 'anthropic-api' && config.anthropic_api_key) {
    adaptersList.push(new AnthropicAdapter(config.anthropic_api_key, config.model))
  }

  // Se nada foi auto-detectado (não tem CLIs nem API Keys)
  if (adaptersList.length === 0) {
    throw new Error(
      'Nenhum LLM disponível. O CoreOps precisa de um dos seguintes:\n' +
      '  • claude CLI instalado (Claude Code) — recomendado\n' +
      '  • gemini CLI instalado (Gemini CLI)\n' +
      '  • ANTHROPIC_API_KEY configurada no .env\n\n' +
      'Execute `claude --version` para verificar se o Claude Code está instalado.',
    )
  }

  // Cria o adaptador Fallback com toda a cadeia instanciada
  let finalAdapter: LLMAdapter = new FallbackAdapter(adaptersList)

  // Envolver com cache se habilitado
  if (config.enable_cache) {
    const cache = new ResponseCache()
    finalAdapter = new CachedLLMAdapter(finalAdapter, cache)
  }

  return { adapter: finalAdapter, source: 'fallback-chain' }
}
