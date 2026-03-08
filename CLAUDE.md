# CoreOps — Contexto do Projeto para Claude Code

> Este arquivo é carregado automaticamente em toda nova conversa.
> Mantém continuidade entre sessões.

---

## O que é o CoreOps

Plataforma de orquestração cognitiva para desenvolvimento de software assistido por IA.
Coordena agentes especializados através de um pipeline determinístico de 10 fases (IDEA → DONE),
quebrando tarefas complexas em microtarefas executáveis.

**Princípio central:** o CoreOps roda *dentro* de ambientes de IA (Claude Code CLI, Gemini CLI)
— não precisa de API key separada, usa o LLM do ambiente.

---

## Stack

- **Runtime:** Bun (TypeScript nativo, `bun:sqlite` built-in)
- **LLM:** auto-detecta `claude CLI` → `gemini CLI` → `ANTHROPIC_API_KEY`
- **Persistência:** `.coreops/` no projeto (JSON) + `~/.coreops/` global (SQLite)
- **Testes:** `bun test` — 116 testes passando, 0 erros TypeScript

---

## Estado atual da implementação

**TODAS AS FASES COMPLETAS** (2026-03-08).

### Componentes implementados

| Componente | Arquivo | Status |
|-----------|---------|--------|
| Core Types + Config | `src/core/types.ts` | ✓ |
| Event Bus | `src/core/event-bus.ts` | ✓ |
| State Machine | `src/core/state-machine.ts` | ✓ |
| Core Orchestrator | `src/core/orchestrator.ts` | ✓ |
| Agent interface + Runner + Registry | `src/agents/agent*.ts` | ✓ |
| Planner Agent | `src/agents/planner.ts` | ✓ |
| MicrotaskGenerator | `src/agents/microtask-generator.ts` | ✓ (gera DAG + concurrency_group) |
| ParallelExecutionEngine | `src/core/parallel-engine.ts` | ✓ Phase 11 (DAG waves + mutex) |
| ContextBuilder | `src/agents/context-builder.ts` | ✓ |
| Coder Agent | `src/agents/coder.ts` | ✓ |
| Reviewer Agent | `src/agents/reviewer.ts` | ✓ |
| Tester Agent | `src/agents/tester.ts` | ✓ |
| Validator Agent | `src/agents/validator.ts` | ✓ (usa Sandbox) |
| Debugger Agent | `src/agents/debugger.ts` | ✓ |
| SecurityAgent | `src/agents/security.ts` | ✓ Phase 8 (opt-in) |
| RefactorAgent | `src/agents/refactor.ts` | ✓ Phase 8 (opt-in) |
| DocumentationAgent | `src/agents/documentation.ts` | ✓ Phase 8 (opt-in) |
| LLM Adapters | `src/llm/` | ✓ Claude CLI + Gemini CLI + Anthropic |
| ResponseCache | `src/llm/response-cache.ts` | ✓ Phase 9 (SQLite, 7d TTL) |
| Adapter Factory | `src/llm/adapter-factory.ts` | ✓ (auto-detect + cache) |
| Workspace Manager | `src/workspace/workspace-manager.ts` | ✓ |
| State + Backlog + History | `src/workspace/` | ✓ |
| Execution Sandbox | `src/sandbox/sandbox.ts` | ✓ Phase 4 (timeout + kill) |
| Memory Layer | `src/memory/memory-store.ts` | ✓ Phase 5 (SQLite FTS5 global) |
| Event Store | `src/debug/event-store.ts` | ✓ Phase 7 (SQLite, timeline) |
| Metrics | `src/observability/metrics.ts` | ✓ Phase 6 |
| API Server | `src/server/api-server.ts` | ✓ Phase 10 (Bun.serve REST) |
| CLI entrypoint | `src/cli/index.ts` | ✓ |
| CLI: start (interativo) | `src/cli/commands/start.ts` | ✓ |
| CLI: resume | `src/cli/commands/resume.ts` | ✓ |
| CLI: status | `src/cli/commands/status.ts` | ✓ |
| CLI: next | `src/cli/commands/next.ts` | ✓ |
| CLI: backlog | `src/cli/commands/backlog.ts` | ✓ |
| CLI: debug | `src/cli/commands/debug.ts` | ✓ (--timeline, --events, --tail) |
| CLI: metrics | `src/cli/commands/metrics.ts` | ✓ |
| CLI: memory | `src/cli/commands/memory.ts` | ✓ |
| CLI: serve | `src/cli/commands/serve.ts` | ✓ Phase 10 |

---

## Arquitetura — decisões tomadas

### LLM Adapter (importante)
Auto-detecção em `src/llm/adapter-factory.ts`:
1. `claude --print` (ClaudeCliAdapter) — usa sessão já autenticada
2. `gemini` (GeminiCliAdapter) — usa sessão já autenticada
3. `ANTHROPIC_API_KEY` (AnthropicAdapter) — fallback direto

Cache SQLite (`~/.coreops/llm-cache.db`) ativo por padrão — desativar com `COREOPS_LLM_CACHE=false`.

### Paralelismo de Microtasks (Phase 11)
`ParallelExecutionEngine` (`src/core/parallel-engine.ts`) resolve DAG de dependências em ondas.
- `Microtask.dependencies[]` define o grafo; `concurrency_group` agrupa semântica
- `max_concurrency: 0` = ilimitado por onda; qualquer valor > 0 limita slots simultâneos
- `BacklogStore.updateMicrotask()` serializado via `writeQueue` (mutex — sem race conditions)
- Eventos `wave_started` / `wave_completed` emitidos no EventBus
- Fallback sequencial automático em caso de dependências circulares

### Detecção de LLM (Phase 11)
`detectCurrentLLM()` em `src/llm/adapter-factory.ts` — identifica o LLM do ambiente via env vars
(sem spawnar processos). Resultado persistido em `ProjectState.llm_source` e exibido no `coreops status`.

### Advanced Agents (Phase 8)
Opt-in via env vars — não aumentam latência por padrão:
- `COREOPS_SECURITY=true` → SecurityAgent roda após Reviewer (bloqueia se `critical`)
- `COREOPS_REFACTOR=true` → RefactorAgent roda após validação bem-sucedida
- `COREOPS_DOCS=true` → DocumentationAgent roda após Refactor

### Memory Layer
`~/.coreops/memory.db` — global entre projetos, SQLite com FTS5.
Orchestrator salva automaticamente: context (startProject), decision (planning), pattern (sucesso), lesson (debug).
ContextBuilder lê memórias relevantes automaticamente.

### EventStore + Metrics
`.coreops/debug/events.db` — eventos SQLite por projeto.
`computeMetrics()` calcula agora a partir dos eventos brutos (fase durations, agent success rates, microtask rates).

### Persistência
```
.coreops/                      # por projeto (gitignored)
  state/project_state.json     # + .bak.json automático
  backlog/backlog.json
  history/history.log
  debug/events.db
~/.coreops/                    # global
  memory.db
  llm-cache.db
```

---

## Comandos essenciais

```bash
bun test                          # 103 testes
bun run typecheck                 # 0 erros TypeScript

bun run src/cli/index.ts --help
bun run src/cli/index.ts start
bun run src/cli/index.ts next
bun run src/cli/index.ts status
bun run src/cli/index.ts metrics
bun run src/cli/index.ts debug --timeline
bun run src/cli/index.ts memory list
bun run src/cli/index.ts serve --port 3000

# CLI global (após bun link)
coreops --help
```

---

## Melhorias possíveis (não implementadas)

- Auth/API key no servidor REST
- Dashboard web (frontend para o API server)
- Multi-projeto simultâneo
- Execução Docker real no Sandbox (atualmente valida com tsc + bun test)
- Streaming de eventos via SSE no API server

---

## Convenções de código

- Tipos centrais em `src/core/types.ts`
- Agentes recebem `LLMAdapter` (interface), não implementação concreta
- Escritas de estado são atômicas (`.tmp` + rename)
- `bun test` — `import { test, expect, describe } from 'bun:test'`
- Sem comentários óbvios, apenas onde a lógica não é auto-evidente
- Testes unitários usam `:memory:` para SQLite — nunca tocam disco real
