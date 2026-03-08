# CoreOps — LLM Adapter Layer

# 26 — LLM Adapter Layer

Este documento define **a camada de abstração entre o sistema e os modelos de linguagem**.

Objetivos:

```
padronizar chamadas
suportar múltiplos modelos
facilitar troca de provider
```

---

# Arquitetura

```
Agents
   │
   ▼
LLM Adapter
   │
   ├── OpenAI Adapter
   ├── Anthropic Adapter
   └── Local Model Adapter
```

---

# Interface Base

```ts
interface LLMAdapter {

  generate(input: LLMRequest): Promise<LLMResponse>

}
```

---

# Estrutura de Requisição

```ts
interface LLMRequest {

  prompt: string
  max_tokens: number
  temperature: number

}
```

---

# Estrutura de Resposta

```ts
interface LLMResponse {

  text: string
  tokens_used: number
  model: string

}
```

---

# Model Selection

Sistema pode escolher modelo automaticamente.

Exemplo:

```
planner → modelo barato
coder → modelo poderoso
reviewer → modelo intermediário
```

---

# Fallback Strategy

Se um modelo falhar:

```
fallback para outro provider
```

---

# Rate Limit Handling

Adapter gerencia limites de API.

```
retry
queue
backoff
```

---

# Caching

Respostas podem ser cacheadas.

Benefícios:

```
redução de custo
melhor performance
```

---

# Estrutura de Código

```
/llm
   adapter.ts
   openai-adapter.ts
   anthropic-adapter.ts
   local-model-adapter.ts
```