# CoreOps — System Principles

## 03-system-principles

## 1. Introdução

Este documento define os princípios fundamentais que governam o funcionamento do CoreOps.

Esses princípios são regras arquiteturais que orientam:

* comportamento do sistema
* design dos agentes
* execução de tarefas
* evolução da plataforma

Todos os componentes do CoreOps devem respeitar esses princípios para garantir previsibilidade, qualidade de software e consistência de execução.

---

# 2. Princípio da Orquestração Central

O CoreOps opera sob um modelo de **orquestração centralizada**.

Nenhuma ação relevante no sistema deve ocorrer sem passar pelo **Core Orchestrator**.

Isso garante:

* controle de fluxo
* rastreabilidade
* consistência de estado

### Regra

Todo processo deve seguir o fluxo:

```id="rule-orchestration-flow"
User Command
↓
CLI
↓
Core Orchestrator
↓
Pipeline Phase
↓
Agent Execution
↓
Result Validation
↓
State Update
```

Agentes nunca devem executar ações fora desse fluxo.

---

# 3. Princípio da Máquina de Estados

O CoreOps funciona como uma **máquina de estados determinística**.

O sistema sempre deve estar em um único estado bem definido.

Estados principais:

```id="rule-state-machine"
IDEA
BRAINSTORM
PLANNING
ARCHITECTURE
TDD
CODING
REVIEW
QA
DEPLOY
DONE
```

### Regras

1. transições de estado devem ser explícitas
2. nenhuma fase pode ser ignorada
3. o estado deve ser persistido após cada mudança

Arquivo de estado:

```id="rule-state-file"
.coreops/state/project_state.json
```

---

# 4. Princípio da Engenharia Antes do Código

CoreOps prioriza engenharia de software sobre geração de código.

Isso significa que o sistema deve respeitar a seguinte ordem:

```id="rule-engineering-flow"
problem definition
↓
planning
↓
architecture
↓
tests
↓
implementation
```

### Regras

* nenhuma implementação sem planejamento
* nenhuma implementação sem arquitetura definida
* nenhuma implementação sem critérios de validação

---

# 5. Princípio de Testes Antes da Implementação (TDD)

Sempre que possível, o sistema deve seguir o modelo de **Test Driven Development**.

Fluxo esperado:

```id="rule-tdd-cycle"
create test
↓
test fails
↓
implement code
↓
test passes
↓
refactor
```

### Regras

* testes devem ser criados antes da implementação
* código sem teste associado deve ser considerado incompleto
* refatorações devem manter cobertura de testes

---

# 6. Princípio de Microtarefas

Grandes tarefas devem ser divididas em unidades menores chamadas **microtarefas**.

Características de uma microtarefa:

* escopo limitado
* tempo estimado entre 2 e 5 minutos
* objetivo único
* resultado verificável

Exemplo:

```id="rule-microtasks-example"
Task: Implementar User Repository

Microtasks:

1 criar interface repository
2 criar teste de busca por id
3 executar teste falhando
4 implementar método findById
5 executar testes
6 refatorar
```

### Benefícios

* maior precisão da IA
* menor risco de erro
* maior controle de execução

---

# 7. Princípio de Agentes Especializados

Cada fase do pipeline possui um agente especializado.

Exemplo:

```id="rule-agents-map"
Brainstorm Agent → geração de ideias

Planner Agent → definição de backlog

Architect Agent → definição arquitetural

TDD Agent → criação de testes

Coder Agent → implementação

Reviewer Agent → revisão de código

QA Agent → validação final
```

### Regras

* agentes devem possuir escopo limitado
* agentes não devem executar múltiplos papéis simultaneamente
* agentes não mantêm estado persistente

---

# 8. Princípio de Subagentes Efêmeros

Agentes devem ser criados sob demanda e destruídos após execução.

Fluxo:

```id="rule-ephemeral-agents"
spawn agent
↓
execute task
↓
collect result
↓
destroy agent
```

### Benefícios

* evita poluição de contexto
* reduz erros acumulativos
* aumenta previsibilidade

---

# 9. Princípio de Estado Persistente

Todo progresso do projeto deve ser salvo.

Diretório interno:

```id="rule-state-dir"
.coreops/
```

Arquivos principais:

```id="rule-state-files"
project_state.json
backlog.json
history.log
```

### Objetivos

* permitir retomada de execução
* manter histórico de decisões
* permitir auditoria do processo

---

# 10. Princípio de Isolamento de Execução

Todo código gerado deve ser produzido em ambiente isolado.

Isolamento ocorre através de:

```id="rule-isolation"
git worktrees
sandbox execution
workspace isolation
```

### Benefícios

* evita corrupção do repositório principal
* permite testes seguros
* facilita rollback

---

# 11. Princípio de Validação entre Fases

Cada fase do pipeline deve possuir critérios de validação.

Exemplo:

Fase Planning só pode ser concluída se:

* backlog estiver definido
* tarefas forem claras
* escopo estiver delimitado

Fase Coding só pode iniciar se:

* arquitetura estiver definida
* testes estiverem presentes

---

# 12. Princípio de Observabilidade

Todas as ações do sistema devem ser registradas.

Eventos registrados incluem:

* execução de agentes
* criação de tarefas
* alterações de código
* transições de estado

Logs devem ser armazenados em:

```id="rule-logs-dir"
.coreops/logs/
```

---

# 13. Princípio de Transparência

O usuário deve sempre conseguir visualizar:

* estado atual do projeto
* fase do pipeline
* tarefas pendentes
* ações executadas

Comando padrão:

```id="rule-cli-status"
coreops status
```

---

# 14. Princípio de Controle Humano

O CoreOps é uma ferramenta de **automação assistida**, não substituição total do desenvolvedor.

Decisões críticas devem permitir validação humana.

Exemplos:

* aprovação de arquitetura
* revisão de código
* deploy final

---

# 15. Princípio de Evolução Modular

A arquitetura do CoreOps deve permitir evolução sem reescrita do sistema.

Novos componentes devem poder ser adicionados sem alterar o núcleo.

Exemplos de extensões possíveis:

* novos agentes
* novos pipelines
* novas skills
* novos modos de execução

---

# 16. Princípio de Determinismo Operacional

O sistema deve minimizar comportamento imprevisível.

Isso é alcançado através de:

* state machine
* microtarefas
* validações
* isolamento de execução

O objetivo é garantir que o mesmo fluxo produza resultados semelhantes.

---

# 17. Conclusão

Os princípios definidos neste documento formam a base conceitual do CoreOps.

Eles garantem que o sistema opere de forma:

* previsível
* auditável
* disciplinada
* alinhada com boas práticas de engenharia de software

Todos os módulos do sistema devem ser projetados respeitando essas diretrizes.
