# CoreOps — Context Engineering

# 25 — Context Engineering

Este documento define **como o contexto enviado ao LLM é construído**.

Context engineering é **um dos fatores mais críticos para qualidade de resposta do modelo**.

Um contexto ruim causa:

* respostas erradas
* desperdício de tokens
* perda de foco

---

# Objetivo do Context Engine

Garantir que cada agente receba:

```
contexto mínimo
informação relevante
instruções claras
```

---

# Estrutura do Contexto

Contexto completo:

```
system prompt
agent instructions
microtask description
relevant files
memory hints
rules
```

---

# Context Builder Pipeline

```
Microtask
   │
   ▼
File Selection
   │
   ▼
Memory Retrieval
   │
   ▼
Prompt Assembly
```

---

# File Selection

Seleciona arquivos relevantes.

Técnicas:

```
dependency analysis
semantic search
git history
```

---

# Memory Retrieval

Busca informações úteis da memória.

Exemplo:

```
previous solutions
architecture rules
known bugs
```

---

# Context Size Control

Limite de tokens:

```
max_context_tokens
```

Se exceder:

```
summarization
context pruning
```

---

# Context Compression Techniques

Principais técnicas:

```
summarization
semantic filtering
chunk selection
```

---

# Prompt Assembly

Formato final:

```
SYSTEM
ROLE
TASK
CONTEXT
RULES
OUTPUT FORMAT
```

---

# Context Cache

Contextos repetidos podem ser cacheados.

Benefício:

```
redução de custo
melhor latência
```

---

# Estrutura de Código

```
/context
   context-builder.ts
   file-selector.ts
   memory-retriever.ts
   prompt-assembler.ts
```

---

# Conclusão

Context engineering garante **eficiência e qualidade nas respostas do LLM**.

---