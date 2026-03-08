// ============================================================
// CoreOps — Fallback Adapter
// Implementa Padrão Strategy com Chain of Responsibility.
// Tenta cada adaptador na sequência definida até que um tenha sucesso.
// ============================================================

import type { LLMAdapter, LLMRequest, LLMResponse } from './types.ts'

export class FallbackAdapter implements LLMAdapter {
    constructor(private readonly adapters: LLMAdapter[]) {
        if (adapters.length === 0) {
            throw new Error('FallbackAdapter requer pelo menos um adaptador na cadeia.')
        }
    }

    async complete(request: LLMRequest): Promise<LLMResponse> {
        const errors: Error[] = []

        for (const adapter of this.adapters) {
            try {
                // Tenta executar a chamada no adaptador atual
                const response = await adapter.complete(request)
                // Se der sucesso, retorna imediatamente e encerra a cadeia
                return response
            } catch (error) {
                // Se der erro (ex: Limite de Quota, Timeout), guarda o erro e tenta o próximo
                console.warn(`[CoreOps] Aviso: Falha no adaptador ${adapter.constructor.name}, tentando próximo da fila...`, error instanceof Error ? error.message : error)
                errors.push(error instanceof Error ? error : new Error(String(error)))
            }
        }

        // Se todos falharem, reporta a quebra geral agrupando os erros
        throw new Error(
            'Todos os adaptadores LLM falharam na cadeia de Fallback.\nErros reportados:\n' +
            errors.map((e, index) => `[Tentativa ${index + 1}]: ${e.message}`).join('\n')
        )
    }
}
