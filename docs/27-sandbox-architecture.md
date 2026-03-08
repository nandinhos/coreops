# CoreOps — Sandbox Architecture

# 27 — Sandbox Architecture

Este documento define **como o código gerado é executado com segurança**.

Objetivos:

```
isolar execução
evitar danos ao sistema
controlar recursos
```

---

# Arquitetura do Sandbox

```
Agent System
     │
     ▼
Sandbox Manager
     │
     ▼
Isolated Environment
```

---

# Tecnologias Possíveis

```
Docker
Firecracker
gVisor
VM isolada
```

---

# Controles do Sandbox

Sandbox controla:

```
filesystem access
network access
CPU
memory
processes
```

---

# Exemplo de Configuração

```
cpu_limit: 1
memory_limit: 512MB
timeout: 30s
```

---

# File System Isolation

O sistema cria workspace isolado.

```
/sandbox
   /run-001
   /run-002
```

---

# Command Execution

Execução controlada.

Exemplo:

```
npm test
build
lint
```

---

# Cleanup Automático

Após execução:

```
container destroyed
workspace deleted
```

---

# Estrutura de Código

```
/sandbox
   sandbox-manager.ts
   container-runner.ts
   resource-controller.ts
```