# CoreOps

**Orquestração cognitiva de desenvolvimento de software.**

O CoreOps coordena agentes de IA especializados através de um pipeline determinístico, quebrando features complexas em microtarefas executáveis — sem precisar de API key separada quando rodando dentro do Claude Code CLI ou Gemini CLI.

---

## Como funciona

```
IDEA → BRAINSTORM → PLANNING → ARCHITECTURE → TDD → CODING → REVIEW → QA → DEPLOY → DONE
```

Cada fase é executada por agentes especializados:

| Fase | Agente | O que faz |
|------|--------|-----------|
| PLANNING | Planner | Gera plano de tarefas com objetivo e estratégia |
| TDD | MicrotaskGenerator | Quebra tarefas em microtasks com DAG de dependências e `concurrency_group` |
| CODING | ParallelEngine + Coder + Reviewer + Tester + Validator + Debugger | Executa microtasks em ondas paralelas, escreve, revisa, testa e valida |
| REVIEW | Reviewer | Revisão final do código produzido |

Agentes opcionais (ativados por env vars):

| Agente | Variável | Função |
|--------|----------|--------|
| SecurityAgent | `COREOPS_SECURITY=true` | Scan OWASP Top 10 em cada microtask |
| RefactorAgent | `COREOPS_REFACTOR=true` | Refactoring automático pós-validação |
| DocumentationAgent | `COREOPS_DOCS=true` | Geração de JSDoc/TSDoc |

---

## Instalação

```bash
# Clonar e instalar dependências
git clone <repo>
cd coreops
bun install

# Instalar globalmente (disponível como `coreops` no terminal)
bun link
```

**Pré-requisito:** rodar dentro de uma sessão LLM ativa:
- Claude Code CLI (detectado via `CLAUDECODE` env var)
- Gemini CLI (detectado via `GEMINI_CLI_IDE_SERVER_PORT`)
- Ou `ANTHROPIC_API_KEY` configurada no `.env` (fallback)

> O CoreOps detecta automaticamente o LLM do ambiente — sem spawnar processos externos.

---

## Uso rápido

```bash
# Iniciar um novo projeto (interativo)
coreops start

# Ou com flags
coreops start --name "minha-api" --description "API REST de usuários com JWT"

# Avançar para a próxima fase (avança + executa automação)
coreops next

# Ver estado atual
coreops status

# Ver tarefas e microtasks
coreops backlog

# Ver métricas do pipeline
coreops metrics

# Debug: histórico de execução e timeline
coreops debug --timeline
coreops debug --tail 20

# Memória persistente entre projetos
coreops memory list
coreops memory search "autenticação"
coreops memory add --title "Usar JWT RS256" --content "..." --type decision

# Iniciar servidor REST (controle via HTTP)
coreops serve --port 3000
```

---

## API REST

Com `coreops serve --port 3000` rodando:

| Endpoint | Método | Descrição |
|----------|--------|-----------|
| `/` | GET | Info da API |
| `/status` | GET | Estado atual do projeto |
| `/backlog` | GET | Tasks e microtasks |
| `/start` | POST | Iniciar projeto `{ name, description }` |
| `/next` | POST | Avançar e executar próxima fase |
| `/metrics` | GET | Métricas de execução |
| `/memory` | GET | Busca na memória (`?q=termo`) |
| `/events` | GET | Eventos recentes (`?limit=50`) |
| `/timeline` | GET | Timeline por fase |

```bash
# Exemplos
curl http://localhost:3000/status
curl -X POST http://localhost:3000/next
curl "http://localhost:3000/memory?q=autenticacao"
```

---

## Configuração

Copie `.env.example` para `.env` e ajuste conforme necessário:

```bash
cp .env.example .env
```

| Variável | Padrão | Descrição |
|----------|--------|-----------|
| `COREOPS_ADAPTER` | auto | `claude-cli`, `gemini-cli`, ou `anthropic-api` |
| `COREOPS_MODEL` | — | Modelo específico (ex: `claude-sonnet-4-6`) |
| `COREOPS_LOG_LEVEL` | `info` | `debug`, `info`, `warn`, `error` |
| `COREOPS_MAX_RETRIES` | `3` | Tentativas por microtask |
| `COREOPS_AGENT_TIMEOUT` | `120000` | Timeout de agente em ms |
| `COREOPS_SECURITY` | `false` | Ativar SecurityAgent (OWASP) |
| `COREOPS_REFACTOR` | `false` | Ativar RefactorAgent |
| `COREOPS_DOCS` | `false` | Ativar DocumentationAgent (JSDoc) |
| `COREOPS_LLM_CACHE` | `true` | Cache SQLite de respostas do LLM |
| `COREOPS_PORT` | `3000` | Porta do servidor REST |
| `ANTHROPIC_API_KEY` | — | Necessário apenas sem Claude/Gemini CLI |

---

## Arquitetura

```
src/
├── cli/              # Entrypoint e comandos (start, next, status, serve, ...)
├── core/             # Orchestrator, StateMachine, EventBus, Types, ParallelEngine
├── agents/           # Todos os agentes (Planner, Coder, Reviewer, ...)
├── llm/              # Adapters + detectCurrentLLM() + Cache
├── workspace/        # Persistência local em .coreops/
├── memory/           # Memory Layer global (~/.coreops/memory.db, SQLite FTS5)
├── debug/            # EventStore (.coreops/debug/events.db)
├── observability/    # Métricas calculadas do EventStore
├── sandbox/          # Execução com timeout e limites de output
└── server/           # API REST (Bun.serve)
```

Estado do projeto persiste em `.coreops/` (gitignored):
```
.coreops/
├── state/            # project_state.json + backup automático
├── backlog/          # backlog.json (tasks + microtasks)
├── history/          # history.log
└── debug/            # events.db (SQLite — timeline e métricas)
```

Memória global persiste em `~/.coreops/`:
```
~/.coreops/
├── memory.db         # SQLite FTS5 — decisões, padrões e lições entre projetos
└── llm-cache.db      # SQLite — cache de respostas do LLM (TTL: 7 dias)
```

---

## Desenvolvimento

```bash
bun test            # 116 testes
bun run typecheck   # 0 erros TypeScript
bun run dev         # Modo watch
```

---

## Stack

- **Runtime:** [Bun](https://bun.sh) — TypeScript nativo, SQLite built-in, HTTP server
- **LLM:** Auto-detecta Claude Code CLI → Gemini CLI → Anthropic API
- **Persistência:** SQLite via `bun:sqlite` — sem ORMs, sem servidores externos
- **Testes:** `bun test` — 116 testes, sem mocks de rede
