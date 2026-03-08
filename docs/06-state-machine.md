# CoreOps — State Machine

## 06-state-machine

## 1. Introdução

O CoreOps utiliza uma **máquina de estados determinística** para controlar o progresso do pipeline cognitivo.

A State Machine garante que o sistema:

* execute fases na ordem correta
* mantenha consistência do processo
* possa retomar execução após interrupções
* registre histórico de evolução do projeto

Cada projeto possui um único estado ativo em determinado momento.

Esse estado é persistido e controlado pelo **Core Orchestrator**.

---

# 2. Objetivos da State Machine

A máquina de estados do CoreOps possui os seguintes objetivos:

### Controle de fluxo

Garantir que o pipeline siga a sequência definida.

### Consistência

Evitar execução de fases fora de ordem.

### Recuperação

Permitir retomada de execução após falhas.

### Auditoria

Manter histórico claro das transições realizadas.

---

# 3. Estados do Sistema

Os estados representam as fases do pipeline.

Estados oficiais:

```id="state-machine-states"
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

Cada estado corresponde a uma fase específica do desenvolvimento.

---

# 4. Estado Inicial

Todo projeto inicia no estado:

```id="state-machine-initial"
IDEA
```

Esse estado é definido quando o comando:

```id="state-machine-start-command"
coreops start
```

é executado.

---

# 5. Estado Final

O estado final do pipeline é:

```id="state-machine-final"
DONE
```

Esse estado indica que o projeto concluiu todas as fases do pipeline.

---

# 6. Transições de Estado

Transições representam a passagem de uma fase para outra.

Fluxo padrão:

```id="state-machine-flow"
IDEA
↓
BRAINSTORM
↓
PLANNING
↓
ARCHITECTURE
↓
TDD
↓
CODING
↓
REVIEW
↓
QA
↓
DEPLOY
↓
DONE
```

Cada transição exige validação.

---

# 7. Validação de Transição

Antes de mudar de estado, o sistema deve verificar se a fase atual foi concluída corretamente.

Exemplo:

Transição de **PLANNING → ARCHITECTURE** só é permitida se:

* backlog estiver definido
* tarefas forem válidas
* escopo estiver claro

---

# 8. Estrutura do Estado Persistente

O estado atual do projeto é armazenado em:

```id="state-machine-file"
.coreops/state/project_state.json
```

Exemplo:

```json id="state-machine-example"
{
  "project": "billing-system",
  "current_phase": "CODING",
  "started_at": "2026-03-07",
  "phases_completed": [
    "IDEA",
    "BRAINSTORM",
    "PLANNING",
    "ARCHITECTURE",
    "TDD"
  ],
  "tasks_completed": 12,
  "tasks_pending": 5,
  "last_transition": "2026-03-07T15:00:00"
}
```

---

# 9. Histórico de Transições

Todas as mudanças de estado devem ser registradas.

Arquivo:

```id="state-machine-history-file"
.coreops/history.log
```

Exemplo de registro:

```id="state-machine-history-example"
2026-03-07 10:00 STATE CHANGE: IDEA → BRAINSTORM
2026-03-07 11:20 STATE CHANGE: BRAINSTORM → PLANNING
2026-03-07 12:45 STATE CHANGE: PLANNING → ARCHITECTURE
```

Isso permite auditoria completa do processo.

---

# 10. Recuperação de Estado

Quando o sistema é reiniciado, o orchestrator executa o processo de recuperação.

Fluxo:

```id="state-machine-recovery-flow"
load project_state.json
↓
determine current phase
↓
restore backlog
↓
restore tasks
↓
resume pipeline
```

Comando:

```id="state-machine-resume-command"
coreops resume
```

---

# 11. Rollback de Estado

Em algumas situações, pode ser necessário retornar a uma fase anterior.

Exemplos:

* erro de arquitetura detectado durante coding
* falha crítica em QA
* mudança de escopo

Rollback possível:

```id="state-machine-rollback-example"
CODING → ARCHITECTURE
QA → CODING
REVIEW → CODING
```

Rollback nunca pode ultrapassar a fase **IDEA**.

---

# 12. Reexecução de Fase

Quando ocorre rollback, a fase deve ser executada novamente.

Fluxo:

```id="state-machine-reexecution"
rollback phase
↓
invalidate artifacts
↓
rerun phase agent
↓
validate output
↓
update state
```

---

# 13. Transições Proibidas

Algumas transições são explicitamente proibidas.

Exemplos:

```id="state-machine-invalid-transitions"
IDEA → CODING
BRAINSTORM → REVIEW
PLANNING → QA
```

Essas transições violariam a disciplina do pipeline.

---

# 14. Controle pelo Orchestrator

A State Machine não executa lógica por conta própria.

Ela é controlada pelo **Core Orchestrator**, que:

* verifica estado atual
* solicita validações
* aplica transições

Fluxo:

```id="state-machine-orchestrator-flow"
orchestrator requests transition
↓
validate transition
↓
update state
↓
emit state change event
```

---

# 15. Eventos de Estado

Sempre que uma mudança de estado ocorre, um evento é emitido.

Eventos possíveis:

```id="state-machine-events"
phase_started
phase_completed
state_transition
rollback_triggered
pipeline_completed
```

Esses eventos são usados pelo sistema de observabilidade.

---

# 16. Segurança de Estado

Para evitar corrupção de estado, o sistema deve garantir:

* escrita atômica do arquivo de estado
* validação antes de atualização
* backup automático

Exemplo:

```id="state-machine-backup"
project_state.json
project_state.bak
```

---

# 17. Visualização do Estado

O usuário pode visualizar o estado atual com o comando:

```id="state-machine-status-command"
coreops status
```

Exemplo de saída:

```id="state-machine-status-output"
Project: Billing System

Current Phase: CODING

Completed Phases:
IDEA
BRAINSTORM
PLANNING
ARCHITECTURE
TDD

Pending Phases:
REVIEW
QA
DEPLOY
```

---

# 18. Evolução da State Machine

A máquina de estados pode evoluir para suportar:

* pipelines personalizados
* múltiplos fluxos paralelos
* estados intermediários
* execução distribuída

A arquitetura deve permitir expansão sem quebrar compatibilidade.

---

# 19. Conclusão

A State Machine é responsável por manter o controle do pipeline cognitivo do CoreOps.

Ela garante que o processo de desenvolvimento seja:

* estruturado
* previsível
* auditável
* resiliente a falhas

Sem esse mecanismo, o sistema perderia controle sobre o progresso do projeto.

Com a State Machine, o CoreOps mantém disciplina operacional mesmo em fluxos complexos.
