# CoreOps – Arquitetura de Produto

## 13. CLI Interface

---

# 1. Objetivo

A **CLI Interface** fornece uma interface de linha de comando para operar, administrar e automatizar o CoreOps.

Ela permite:

* executar comandos administrativos
* iniciar tarefas e agentes
* depurar execuções
* gerenciar sistema
* rodar automações

A CLI é essencial para:

* **DevOps**
* **automação**
* **debugging**
* **manutenção operacional**

---

# 2. Filosofia da CLI

A CLI segue princípios:

| Princípio   | Descrição                   |
| ----------- | --------------------------- |
| Scriptable  | fácil automação             |
| Predictable | comportamento consistente   |
| Modular     | comandos organizados        |
| Extensible  | novos comandos adicionáveis |

---

# 3. Estrutura Geral da CLI

```id="cli-structure"
coreops
 ├─ system
 ├─ agent
 ├─ memory
 ├─ events
 ├─ debug
 ├─ execution
 ├─ cache
 └─ database
```

Formato geral:

```bash id="cli-format"
coreops <module> <command> [options]
```

---

# 4. Comando Base

Comando principal do sistema:

```bash id="base-command"
coreops
```

Exemplo:

```bash id="base-example"
coreops system:status
```

---

# 5. Módulo System

Comandos relacionados ao estado do sistema.

```bash id="system-commands"
coreops system:status
coreops system:health
coreops system:info
coreops system:version
```

Funções:

| Comando        | Descrição               |
| -------------- | ----------------------- |
| system:status  | estado geral            |
| system:health  | health checks           |
| system:info    | informações do ambiente |
| system:version | versão instalada        |

---

# 6. Módulo Agents

Controle de agentes do sistema.

```bash id="agent-commands"
coreops agent:list
coreops agent:run
coreops agent:status
coreops agent:logs
```

Exemplos:

```bash id="agent-example"
coreops agent:run task-analyzer
```

```bash id="agent-example-2"
coreops agent:status execution_id
```

---

# 7. Módulo Execution

Gerenciamento de execuções.

```bash id="execution-commands"
coreops exec:start
coreops exec:status
coreops exec:cancel
coreops exec:logs
```

Exemplo:

```bash id="exec-example"
coreops exec:start workflow_id
```

---

# 8. Módulo Memory

Controle da Memory Layer.

```bash id="memory-commands"
coreops memory:get
coreops memory:set
coreops memory:clear
coreops memory:search
```

Exemplo:

```bash id="memory-example"
coreops memory:get execution:123
```

---

# 9. Módulo Events

Operações relacionadas a eventos.

```bash id="event-commands"
coreops event:dispatch
coreops event:list
coreops event:replay
```

Exemplo:

```bash id="event-example"
coreops event:dispatch OrderCreated
```

---

# 10. Módulo Debug

Ferramentas de debugging.

```bash id="debug-commands"
coreops debug:trace
coreops debug:execution
coreops debug:agent
```

Exemplo:

```bash id="debug-example"
coreops debug:execution 9832
```

---

# 11. Módulo Cache

Controle do sistema de cache.

```bash id="cache-commands"
coreops cache:clear
coreops cache:warm
coreops cache:status
```

Exemplo:

```bash id="cache-example"
coreops cache:clear
```

---

# 12. Módulo Database

Comandos administrativos de banco.

```bash id="db-commands"
coreops db:migrate
coreops db:rollback
coreops db:seed
coreops db:status
```

Exemplo:

```bash id="db-example"
coreops db:migrate
```

---

# 13. Módulo Scheduler

Controle de tarefas agendadas.

```bash id="scheduler-commands"
coreops schedule:list
coreops schedule:run
coreops schedule:status
```

---

# 14. Módulo Queue

Controle de filas.

```bash id="queue-commands"
coreops queue:work
coreops queue:retry
coreops queue:failed
```

Exemplo:

```bash id="queue-example"
coreops queue:work
```

---

# 15. Opções Globais

Todos comandos suportam opções globais.

| Opção     | Função          |
| --------- | --------------- |
| --env     | ambiente        |
| --verbose | saída detalhada |
| --json    | output JSON     |
| --dry-run | simulação       |

Exemplo:

```bash id="cli-options"
coreops agent:run analyzer --env=dev --verbose
```

---

# 16. Formatos de Saída

A CLI suporta múltiplos formatos.

| Formato | Uso          |
| ------- | ------------ |
| text    | humano       |
| json    | automação    |
| table   | visualização |

Exemplo:

```bash id="cli-json"
coreops system:status --json
```

---

# 17. Autocomplete

Suporte a autocomplete para shell.

```bash id="cli-autocomplete"
bash
zsh
fish
```

Exemplo:

```bash id="cli-autocomplete-example"
coreops <TAB>
```

---

# 18. Arquitetura Interna

Estrutura da CLI:

```id="cli-internal"
CLI Kernel
   │
   ▼
Command Registry
   │
   ▼
Command Handlers
   │
   ▼
Application Services
```

---

# 19. Registro de Comandos

Comandos são registrados dinamicamente.

Estrutura:

```id="cli-command-registry"
Command
 ├─ name
 ├─ description
 ├─ arguments
 └─ handler
```

---

# 20. Segurança da CLI

Controles aplicados:

| Controle     | Descrição        |
| ------------ | ---------------- |
| autenticação | acesso restrito  |
| permissões   | RBAC             |
| auditoria    | logs de execução |

---

# 21. Integração com Scripts

A CLI pode ser usada em scripts de automação.

Exemplo:

```bash id="cli-script"
#!/bin/bash

coreops db:migrate
coreops cache:clear
coreops queue:work
```

---

# 22. Integração com CI/CD

Pipeline pode usar CLI.

Exemplo:

```bash id="cli-cicd"
coreops system:health
coreops db:migrate
coreops cache:warm
```

---

# 23. Benefícios

| Benefício               | Impacto              |
| ----------------------- | -------------------- |
| automação               | operações eficientes |
| debugging               | diagnóstico rápido   |
| controle administrativo | gestão do sistema    |
| integração DevOps       | deploy automatizado  |

---

# 24. Resultado Esperado

A CLI transforma o CoreOps em uma plataforma **operável e automatizável**, permitindo:

* controle completo via terminal
* automação de tarefas
* debugging avançado
* integração com pipelines.