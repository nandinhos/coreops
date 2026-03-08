# CoreOps – Arquitetura de Produto

# Full System Flow

# 18 — Full System Flow

Este documento descreve **o fluxo completo do sistema**, do momento em que o usuário faz uma requisição até a entrega do resultado final.

Ele conecta **todos os componentes definidos anteriormente**:

- CLI Interface
- Event System
- Agents
- Memory Layer
- Sandbox
- Observability
- Debug Mode

O objetivo é fornecer uma **visão end-to-end da arquitetura operacional**.

---

# Visão Geral

Fluxo principal:

```

User Request
│
▼
CLI Interface
│
▼
Orchestrator
│
▼
Planner
│
▼
Microtask Generator
│
▼
Execution Loop
│
├─ Context Builder
├─ Coder
├─ Reviewer
├─ Tester
├─ Validator
└─ Debugger
│
▼
Memory Update
│
▼
Final Result

````

---

# Fase 1 — Entrada do Usuário

O usuário interage com o sistema via **CLI**.

Exemplo:

```bash
agent-cli implement "create login endpoint"
````

Entrada recebida:

```ts
interface UserRequest {
  id: string
  timestamp: string
  command: string
  description: string
}
```

Evento emitido:

```
USER_REQUEST_RECEIVED
```

---

# Fase 2 — Inicialização da Execução

O **Orchestrator** inicia uma nova execução.

Ações:

* cria `execution_id`
* inicializa contexto
* registra início

Estrutura:

```ts
interface ExecutionContext {
  executionId: string
  request: UserRequest
  status: "running"
}
```

Evento emitido:

```
EXECUTION_STARTED
```

---

# Fase 3 — Planejamento

O **Planner Agent** analisa a solicitação e gera um plano.

Entrada:

```
Create login endpoint
```

Saída:

```
1. Criar rota /login
2. Criar LoginController
3. Criar AuthService
4. Criar testes
```

Evento:

```
PLAN_GENERATED
```

---

# Fase 4 — Geração de Microtasks

O **Microtask Generator** divide o plano em tarefas menores.

Exemplo:

```
Task: Criar AuthService
```

Microtasks:

```
1. Criar classe AuthService
2. Implementar método login
3. Validar credenciais
```

Evento:

```
MICROTASKS_CREATED
```

---

# Fase 5 — Loop de Execução

Cada microtask entra em um **loop de execução controlado**.

```
for each microtask
```

Pipeline:

```
Context Builder
      │
      ▼
Coder
      │
      ▼
Reviewer
      │
      ▼
Tester
      │
      ▼
Validator
```

---

# Fase 6 — Construção de Contexto

O **Context Builder** prepara o prompt ideal.

Inclui:

* descrição da microtask
* arquivos relevantes
* memória
* padrões do projeto

Exemplo:

```json
{
  "task": "implement login method",
  "files": [
    "user.service.ts",
    "auth.controller.ts"
  ]
}
```

Evento:

```
CONTEXT_BUILT
```

---

# Fase 7 — Geração de Código

O **Coder Agent** gera o código.

Saída:

```
diff de código
```

Exemplo:

```diff
+ export class AuthService {
+   login(email: string, password: string) {}
+ }
```

Evento:

```
CODE_GENERATED
```

---

# Fase 8 — Code Review

O **Reviewer Agent** valida o código.

Checa:

* padrões
* bugs
* inconsistências
* complexidade

Resultado:

```
approved | rejected
```

Evento:

```
CODE_REVIEW_COMPLETED
```

---

# Fase 9 — Geração de Testes

O **Tester Agent** cria testes.

Tipos:

* unit
* integration
* edge cases

Evento:

```
TESTS_GENERATED
```

---

# Fase 10 — Validação

O **Validator Agent** executa:

* build
* lint
* testes
* type checking

Resultados possíveis:

```
VALIDATION_SUCCESS
VALIDATION_FAILED
```

---

# Fase 11 — Debug

Se falhar:

```
VALIDATION_FAILED
```

O **Debugger Agent** é acionado.

Ele:

* analisa logs
* identifica causa
* propõe correção

Fluxo:

```
Debugger
   │
   ▼
Nova execução da microtask
```

Evento:

```
DEBUGGER_TRIGGERED
```

---

# Fase 12 — Atualização de Memória

Após sucesso:

O **Memory Manager** registra:

* decisões
* padrões
* soluções aplicadas

Exemplo:

```json
{
  "pattern": "authentication-service",
  "language": "typescript"
}
```

Evento:

```
MEMORY_UPDATED
```

---

# Fase 13 — Finalização

Quando todas microtasks terminam:

```
EXECUTION_COMPLETED
```

Resultado entregue ao usuário.

Exemplo:

```
✔ Login endpoint criado
✔ Testes gerados
✔ Build aprovado
```

---

# Fluxo Completo em Diagrama

```
User
 │
 ▼
CLI
 │
 ▼
Orchestrator
 │
 ▼
Planner
 │
 ▼
Microtask Generator
 │
 ▼
Execution Loop
 │
 ├─ Context Builder
 ├─ Coder
 ├─ Reviewer
 ├─ Tester
 ├─ Validator
 └─ Debugger
 │
 ▼
Memory Manager
 │
 ▼
Final Output
```

---

# Integração com Observability

Durante todo o fluxo são registrados:

* logs
* métricas
* eventos
* traces

Documentado em:

```
12-observability.md
```

---

# Integração com Debug Mode

Se `debug_mode = enabled`, o sistema registra:

* prompts
* respostas
* contexto
* decisões

Documentado em:

```
17-debug-mode.md
```

---

# Propriedades Importantes

## Execução Determinística

Mesmo input → mesmo fluxo.

---

## Execução Resiliente

Erros acionam automaticamente:

```
Debugger
Retry
```

---

## Modularidade

Cada agente é independente.
