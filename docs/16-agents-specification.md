# CoreOps – Arquitetura de Produto

# 16 — Agents Specification

Este documento define **todos os agentes do sistema**, suas responsabilidades, interfaces e regras de operação.

O sistema utiliza **arquitetura multi-agente especializada**, onde cada agente possui **papel único, escopo limitado e responsabilidade clara**.

Isso reduz:

- alucinação
- decisões erradas
- perda de contexto
- ciclos de raciocínio longos

---

# Visão Geral dos Agentes

| Agent | Responsabilidade |
|------|------------------|
| **Orchestrator** | Controla todo o fluxo |
| **Planner** | Cria plano de execução |
| **Microtask Generator** | Quebra tarefas em microtasks |
| **Context Builder** | Monta contexto para agentes |
| **Coder** | Gera código |
| **Reviewer** | Revisão técnica |
| **Tester** | Geração de testes |
| **Validator** | Verifica execução |
| **Debugger** | Corrige erros |
| **Memory Manager** | Gerencia memória |
| **Doc Generator** | Gera documentação |

---

# Arquitetura Multi-Agent

```

User Request
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
├── Context Builder
├── Coder
├── Reviewer
├── Tester
├── Validator
└── Debugger

````

---

# 1 — Orchestrator Agent

O **Orchestrator** é o cérebro do sistema.

Responsável por:

- iniciar execução
- controlar fluxo
- decidir próximos passos
- coordenar agentes
- registrar eventos

### Responsabilidades

- iniciar pipeline
- carregar contexto
- ativar Planner
- controlar loop de execução
- encerrar tarefa

### Interface

```ts
interface OrchestratorAgent {
  execute(request: UserRequest): ExecutionResult
}
````

---

# 2 — Planner Agent

O **Planner** cria um **plano estruturado** para resolver o problema.

Ele não escreve código.

### Responsabilidades

* entender o objetivo
* analisar repositório
* definir estratégia
* gerar plano de tarefas

### Output

```ts
interface ExecutionPlan {
  tasks: Task[]
}
```

### Exemplo

```
1. Criar endpoint de login
2. Criar service de autenticação
3. Criar validação de senha
4. Criar testes
```

---

# 3 — Microtask Generator Agent

Transforma **tasks grandes em microtasks executáveis**.

### Exemplo

Task:

```
Criar endpoint login
```

Microtasks:

```
1. Criar rota POST /login
2. Criar LoginController
3. Criar DTO LoginRequest
4. Integrar AuthService
```

### Interface

```ts
interface Microtask {
  id: string
  description: string
  dependencies: string[]
}
```

---

# 4 — Context Builder Agent

Responsável por **montar o contexto ideal para cada agente**.

Evita:

* tokens desnecessários
* perda de foco
* excesso de informação

### Inputs

* microtask
* memória
* arquivos relevantes

### Output

```
Prompt contextualizado
```

---

# 5 — Coder Agent

Responsável por **gerar código**.

### Regras

* alterar apenas arquivos necessários
* respeitar arquitetura existente
* seguir padrões do projeto

### Input

```
microtask
context
arquivos relevantes
```

### Output

```
diff de código
```

---

# 6 — Reviewer Agent

Faz **code review automatizado**.

### Verifica

* bugs
* más práticas
* inconsistências
* padrões de arquitetura

### Output

```
approve | reject
```

Se rejeitar:

```
feedback para correção
```

---

# 7 — Tester Agent

Responsável por **gerar testes automaticamente**.

Tipos:

* unit tests
* integration tests
* edge cases

### Exemplo

```
login com senha inválida
login com email inválido
login com sucesso
```

---

# 8 — Validator Agent

Executa validação real.

### Executa

* build
* lint
* testes
* type check

### Output

```
success | failure
```

---

# 9 — Debugger Agent

Se ocorrer erro:

* analisa logs
* identifica causa
* propõe correção

### Exemplo

Erro:

```
TypeError: user is undefined
```

Correção:

```
Adicionar validação de null
```

---

# 10 — Memory Manager Agent

Gerencia memória de longo prazo.

### Responsável por

* salvar decisões
* registrar padrões
* recuperar contexto

### Interface

```ts
interface MemoryManager {
  save(event: SystemEvent): void
  search(query: string): Memory[]
}
```

---

# 11 — Documentation Generator Agent

Gera documentação automaticamente.

### Tipos

* README
* API docs
* arquitetura
* comentários de código

---

# Comunicação Entre Agentes

Todos os agentes se comunicam por **eventos estruturados**.

Exemplo:

```
TASK_CREATED
MICROTASK_READY
CODE_GENERATED
CODE_REVIEWED
TEST_FAILED
DEBUG_REQUIRED
```

---

# Ciclo de Execução

```
Planner
   │
   ▼
Microtask Generator
   │
   ▼
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
   │
   ├── success → próxima microtask
   │
   └── failure → Debugger
```

---

# Propriedades Importantes

## Agentes são Stateless

Estado fica em:

```
Memory Layer
Event Store
Execution Context
```

---

## Execução Determinística

Mesmo input → mesmo output.

---

## Agentes Pequenos

Cada agente resolve **apenas um tipo de problema**.

Isso aumenta:

* confiabilidade
* previsibilidade
* debuggabilidade

---

# Estrutura de Implementação

```
/agents
   orchestrator.ts
   planner.ts
   microtask-generator.ts
   context-builder.ts
   coder.ts
   reviewer.ts
   tester.ts
   validator.ts
   debugger.ts
   memory-manager.ts
   documentation.ts
```

---

# Contrato Base de Agente

Todos agentes seguem o mesmo contrato.

```ts
interface Agent<I, O> {
  name: string
  execute(input: I): Promise<O>
}
```

---

# Exemplo de Execução

```ts
const plan = await planner.execute(request)

const tasks = await microtaskGenerator.execute(plan)

for (task of tasks) {

  const context = await contextBuilder.execute(task)

  const code = await coder.execute(context)

  const review = await reviewer.execute(code)

  if (!review.approved) {
      debugger.execute(review.feedback)
  }

}
```

---

# Segurança

Agentes **não possuem acesso direto ao sistema**.

Tudo passa por:

* sandbox
* executor
* event system

---

# Benefícios da Arquitetura

* modular
* extensível
* observável
* resiliente
* debuggável