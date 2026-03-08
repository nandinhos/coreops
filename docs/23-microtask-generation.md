# CoreOps – Arquitetura de Produto

# 23 — Microtask Generation

Este documento descreve **como o sistema gera, organiza e executa microtasks**.

Microtasks são a **unidade fundamental de trabalho do sistema**.

Toda execução é baseada em:

```

Feature → Tasks → Microtasks → Code Changes

```

Essa abordagem reduz drasticamente:

- complexidade cognitiva do LLM
- tamanho do contexto
- erros de implementação
- alucinações

---

# O Que é uma Microtask

Uma microtask é **uma ação mínima executável** dentro do sistema.

Propriedades:

| Propriedade | Descrição |
|-------------|-----------|
| Escopo pequeno | Deve resolver apenas um passo |
| Determinística | Resultado previsível |
| Independente | Dependências explícitas |
| Executável | Pode ser implementada diretamente |

---

# Exemplo de Transformação

### Requisição do usuário

```

Create authentication system

```

### Tasks (Planner)

```

1. Create login endpoint
2. Implement authentication service
3. Add password validation
4. Write tests

```

### Microtasks

```

Create POST /login route
Create LoginController
Create AuthService class
Implement login method
Add password validation
Create login unit tests

````

Cada microtask é executada **individualmente**.

---

# Estrutura de Microtask

```ts
interface Microtask {
  id: string
  description: string
  dependencies: string[]
  status: "pending" | "running" | "completed" | "failed"
}
````

---

# Pipeline de Geração

A geração ocorre em três etapas.

```
Planner
   │
   ▼
Task List
   │
   ▼
Microtask Generator
   │
   ▼
Microtask Graph
```

---

# Microtask Decomposition Rules

O agente deve seguir regras rígidas.

### Regra 1 — Apenas uma responsabilidade

❌ errado

```
Create login endpoint and authentication logic
```

✔ correto

```
Create login endpoint
Implement authentication logic
```

---

### Regra 2 — Deve ser executável

❌ errado

```
Improve authentication
```

✔ correto

```
Add password comparison logic
```

---

### Regra 3 — Descrever ação concreta

❌ errado

```
Handle user
```

✔ correto

```
Validate user credentials
```

---

# Microtask Dependency Graph

Microtasks formam um **grafo acíclico direcionado (DAG)**.

Exemplo:

```
Create AuthService
        │
        ▼
Implement login method
        │
        ▼
Create login endpoint
        │
        ▼
Generate tests
```

Representação:

```ts
interface MicrotaskGraph {
  nodes: Microtask[]
  edges: Dependency[]
}
```

---

# Execução Baseada em Dependência

Microtasks só executam quando dependências terminam.

Exemplo:

```
A → B → C
```

Execução:

```
A
B
C
```

---

# Execução Paralela

Se não houver dependência, execução pode ser paralela.

Exemplo:

```
A      B
 \    /
  ▼  ▼
   C
```

Execução:

```
A + B
C
```

---

# Prioridade de Microtasks

Cada microtask pode ter prioridade.

```ts
type Priority =
  | "critical"
  | "high"
  | "normal"
  | "low"
```

---

# Microtask Context Size

Cada microtask deve ter **contexto mínimo**.

Contexto típico:

```
microtask description
relevant files
architecture notes
memory hints
```

Isso evita:

* prompts grandes
* perda de foco
* custos elevados

---

# Microtask Lifecycle

Estados possíveis:

```
pending
running
completed
failed
retrying
```

Representação:

```
pending
   │
   ▼
running
   │
   ├── completed
   └── failed
           │
           ▼
         retrying
```

---

# Retry Strategy

Se falhar:

```
retry up to N times
```

Exemplo:

```yaml
retry:
  max_attempts: 3
  strategy: exponential_backoff
```

---

# Microtask Context Builder

Antes da execução:

```
Microtask
   │
   ▼
Context Builder
   │
   ▼
Prompt
```

Contexto inclui:

```
relevant files
previous outputs
memory
architecture rules
```

---

# Microtask Result

Resultado típico:

```ts
interface MicrotaskResult {
  success: boolean
  files_modified: string[]
  output: string
  errors?: string[]
}
```

---

# Microtask Quality Checks

Após execução:

```
Reviewer
Tester
Validator
```

Pipeline:

```
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

# Microtask Failure Handling

Se falhar:

```
Validator
   │
   ▼
Debugger
   │
   ▼
Retry
```

---

# Microtask Logging

Cada execução registra:

```
microtask id
agent used
context size
tokens used
execution time
result
```

---

# Microtask Optimization

Possíveis otimizações:

### Context Pruning

Remover contexto irrelevante.

---

### Smart File Selection

Selecionar apenas arquivos relacionados.

---

### Parallel Execution

Executar microtasks independentes simultaneamente.

---

# Estrutura de Código

```
/core
   microtask-manager.ts
   microtask-graph.ts
   microtask-runner.ts
   dependency-resolver.ts
```

---

# Benefícios da Arquitetura de Microtasks

| Benefício          | Impacto           |
| ------------------ | ----------------- |
| menor complexidade | maior precisão    |
| prompts menores    | menor custo       |
| execução modular   | maior controle    |
| paralelismo        | maior performance |

---

# Fluxo Final

```
User Request
     │
     ▼
Planner
     │
     ▼
Tasks
     │
     ▼
Microtask Generator
     │
     ▼
Microtask Graph
     │
     ▼
Execution Loop
```

---

# Conclusão

Microtasks são o **mecanismo central que torna o sistema confiável**.

Elas permitem transformar problemas complexos em **pequenas ações determinísticas executáveis por agentes especializados**.

---