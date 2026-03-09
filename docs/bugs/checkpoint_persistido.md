# Relatório Técnico - Erro Coreops MCP

## Problema Identificado
O checkpoint manual de **BRAINSTORM** fica preso em loop, mesmo após `coreops_answer` retornar `resolved: true`.

## Sintomas
1. `coreops_answer` retorna `{"resolved": true, "pending": []}`
2. `coreops_next` retorna `{"can_advance": true, "message": "Checkpoint manual resolvido. Pode avançar"}`
3. Mas `coreops_status` sempre mostra `pending_checkpoint` com o mesmo checkpoint
4. O `brainstorm_session.state` permanece `"clarifying"`

## Sequência de Eventos
```
1. project_started (IDEA) ✓
2. phase_started (BRAINSTORM)
3. brainstorm_completed
4. checkpoint_created (manual: true)
5. phase_completed (BRAINSTORM)
6. checkpoint_resolved (múltiplas vezes)
7. project_started (IDEA) - recomeço
8. phase_started (BRAINSTORM)
9. checkpoint_created (pergunta memória)
10. checkpoint_resolved (várias vezes)
11. TRAVADO - mesmo comportamento
```

## Possíveis Causas
1. **Estado fantasma**: O MCP pode estar cacheando o checkpoint anterior
2. **Fase interativa**: `brainstorm_session.interactive: true` pode requerer avançado manual diferente
3. **API bug**: O `can_advance: true` não está realmente liberando o avanço

## Tentativas Realizadas
- `coreops_answer` com `confirm: true`
- `coreops_answer` com resposta exata
- Múltiplas chamadas `coreops_next`
- Recomeçar projeto (`coreops_start`)
- Verificar eventos (`coreops_events`)

## Dados do Checkpoint Travado
```json
{
  "phase": "BRAINSTORM",
  "questions": [
    {
      "id": "q1",
      "question": "Considerando o uso de SQLite para memória persistente, você prefere um modelo de histórico linear (apenas as últimas mensagens) ou uma estrutura que já preveja busca semântica (RAG local com embeddings) para 'lembrar' de fatos passados a longo prazo?",
      "required": true
    }
  ],
  "answers": {
    "q1": "Histórico linear"
  },
  "resolved": true,
  "manual": true
}
```

## Sugestões de Refinamento
1. Adicionar flag de "forçar avanço" (`force: true`)
2. Expor função `coreops_checkpoint_clear()`
3. Adicionar debug mode para ver estado interno
4. Separar checkpoint manual do automático
5. Retornar reason/cause quando `can_advance: false`
6. Expor idempotency key para evitar duplicação de respostas

## Comandos Úteis para Debug
```bash
# Ver eventos
coreops_events(limit: 10)

# Ver status completo
coreops_status()

# Verificar pending
coreops_next()  # se can_advance: false, investigar reason
```
