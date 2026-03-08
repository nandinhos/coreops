# CoreOps – Arquitetura de Produto

# 17 — Debug Mode

Este documento define o **modo de depuração completo do sistema**.

O objetivo é permitir **observabilidade total do comportamento dos agentes**, facilitando:

- diagnóstico de erros
- análise de decisões do LLM
- reprodução de execuções
- auditoria de mudanças
- melhoria contínua do sistema

O Debug Mode transforma o sistema em algo **completamente rastreável e explicável**.

---

# Objetivos do Debug Mode

Permitir visualizar:

- decisões dos agentes
- prompts enviados ao LLM
- respostas do LLM
- contexto utilizado
- arquivos modificados
- eventos do sistema
- erros ocorridos

---

# Níveis de Debug

O sistema possui **4 níveis de debug**.

| Level | Descrição |
|------|-----------|
| `off` | Debug desativado |
| `basic` | Eventos principais |
| `verbose` | Eventos + decisões |
| `trace` | Tudo: prompts, tokens e contexto |

---

# Configuração

```yaml
debug:
  level: verbose
  save_prompts: true
  save_responses: true
  save_context: true
  save_events: true
````

---

# Estrutura de Logs

Logs ficam armazenados em:

```
/debug
    /runs
        run-001
            events.json
            prompts.json
            responses.json
            context.json
            errors.json
```

---

# 1 — Event Log

Registra todos os eventos emitidos pelo sistema.

Exemplo:

```json
{
  "timestamp": "2025-02-10T10:15:23Z",
  "event": "MICROTASK_STARTED",
  "agent": "coder",
  "task_id": "task-12"
}
```

---

# 2 — Prompt Log

Armazena prompts enviados ao LLM.

Exemplo:

```json
{
  "agent": "coder",
  "prompt": "Generate a TypeScript service for authentication...",
  "tokens": 1240
}
```

---

# 3 — Response Log

Armazena respostas do modelo.

```json
{
  "agent": "coder",
  "response": "export class AuthService { ... }",
  "tokens": 890
}
```

---

# 4 — Context Log

Registra o contexto usado por cada agente.

Exemplo:

```json
{
  "task": "create login endpoint",
  "files": [
    "user.service.ts",
    "auth.controller.ts"
  ]
}
```

---

# 5 — Error Log

Armazena erros detectados.

```json
{
  "error": "TypeError: user undefined",
  "agent": "validator",
  "file": "auth.service.ts"
}
```

---

# Timeline de Execução

O Debug Mode permite reconstruir **toda a linha do tempo da execução**.

Exemplo:

```
10:15:23 — TASK_CREATED
10:15:24 — MICROTASK_GENERATED
10:15:25 — CONTEXT_BUILT
10:15:28 — CODE_GENERATED
10:15:29 — CODE_REVIEWED
10:15:31 — TEST_GENERATED
10:15:35 — VALIDATION_FAILED
10:15:36 — DEBUGGER_TRIGGERED
```

---

# Visualização de Execução

Pode ser exibido como **árvore de execução**.

```
Task: Implement Login
│
├─ Microtask: Create route
│   ├─ coder
│   ├─ reviewer
│   └─ tester
│
├─ Microtask: Create service
│   ├─ coder
│   └─ validator
```

---

# Replay de Execução

O Debug Mode permite **reexecutar uma execução anterior**.

Exemplo:

```bash
agent-cli replay run-001
```

Isso reproduz exatamente:

* prompts
* respostas
* decisões

---

# Comparação de Execuções

Permite comparar duas execuções.

```
run-001
run-002
```

Diferenças:

* prompts
* decisões
* arquivos gerados

---

# Snapshot de Estado

Snapshots capturam estado completo do sistema.

```
/snapshots
    snapshot-01
        memory.json
        context.json
        events.json
```

---

# Debug por Agente

Também é possível filtrar por agente.

```bash
agent-cli debug --agent=coder
```

Saída:

```
Coder Agent
Prompt size: 1320 tokens
Files used: 3
Output: 120 lines
```

---

# Debug de Microtask

```bash
agent-cli debug --task=task-14
```

Exibe:

* contexto
* prompt
* resposta
* arquivos alterados

---

# Token Usage Tracking

Debug Mode registra uso de tokens.

```json
{
  "agent": "coder",
  "input_tokens": 1320,
  "output_tokens": 850
}
```

---

# Análise de Performance

Relatórios de performance podem ser gerados.

Exemplo:

```
Total time: 45s
Agents used: 6
Microtasks: 12
Errors: 2
Retries: 1
```

---

# Modo de Segurança

Prompts podem conter dados sensíveis.

Configuração:

```yaml
debug:
  redact_sensitive: true
```

Isso remove:

* tokens
* chaves
* senhas
* secrets

---

# Benefícios do Debug Mode

* observabilidade completa
* reprodução de execuções
* análise de comportamento do LLM
* melhoria do sistema
* auditoria técnica

---

# Estrutura de Implementação

```
/debug
   logger.ts
   event-recorder.ts
   prompt-recorder.ts
   response-recorder.ts
   timeline.ts
```

---

# Integração com Observability

Debug Mode se integra com:

* **Logs**
* **Metrics**
* **Tracing**

Definidos no documento:

```
12-observability.md
```
