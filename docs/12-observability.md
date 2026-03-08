# CoreOps – Arquitetura de Produto

## 12. Observability

---

# 1. Objetivo

A camada de **Observability** do CoreOps fornece visibilidade completa sobre o comportamento do sistema em tempo real.

Ela permite:

* entender o estado da plataforma
* detectar falhas rapidamente
* analisar performance
* investigar execuções
* monitorar agentes e automações

A observabilidade é essencial para **operações confiáveis e debugging avançado**.

---

# 2. Pilares de Observabilidade

O sistema segue os **três pilares clássicos de observabilidade**.

| Pilar   | Descrição                     |
| ------- | ----------------------------- |
| Logs    | registro detalhado de eventos |
| Metrics | indicadores quantitativos     |
| Traces  | rastreamento de execução      |

Além desses pilares, o CoreOps adiciona:

| Pilar adicional | Função             |
| --------------- | ------------------ |
| Events          | eventos de domínio |
| Audit Logs      | auditoria          |
| Health Checks   | estado do sistema  |

---

# 3. Arquitetura de Observabilidade

```id="obs-architecture"
Application Layer
      │
      ▼
Telemetry SDK
      │
      ▼
Telemetry Pipeline
      │
 ┌────┼───────────┬───────────┐
 ▼    ▼           ▼           ▼
Logs  Metrics     Traces      Events
      │
      ▼
Observability Platform
      │
      ▼
Dashboards / Alerts / Analysis
```

---

# 4. Telemetry SDK

O **Telemetry SDK** é integrado à aplicação e fornece APIs para registrar dados de observabilidade.

Funções:

```id="telemetry-api"
log()
metric()
trace()
event()
```

Exemplo conceitual:

```id="telemetry-example"
Telemetry.trace("order.process", function () {
    Telemetry.metric("orders.processing");

    processOrder();

    Telemetry.event("order_processed");
});
```

---

# 5. Logs Estruturados

Logs são registrados em formato estruturado (JSON).

Estrutura padrão:

```json id="log-structure"
{
  "timestamp": "2026-01-01T10:00:00Z",
  "level": "INFO",
  "service": "orders",
  "message": "Order processed",
  "trace_id": "abc123",
  "context": {
    "order_id": 1201
  }
}
```

---

# 6. Níveis de Log

| Nível    | Uso                   |
| -------- | --------------------- |
| DEBUG    | desenvolvimento       |
| INFO     | operações normais     |
| NOTICE   | eventos relevantes    |
| WARNING  | situações inesperadas |
| ERROR    | falha                 |
| CRITICAL | falha grave           |

---

# 7. Distributed Tracing

Traces permitem rastrear execuções completas.

Estrutura:

```id="trace-structure"
Trace
  ├─ Span: HTTP Request
  │
  ├─ Span: Auth Service
  │
  ├─ Span: Business Logic
  │
  └─ Span: Database Query
```

Dados registrados:

| Campo       | Descrição                 |
| ----------- | ------------------------- |
| trace_id    | identificador da execução |
| span_id     | etapa da execução         |
| parent_span | hierarquia                |
| duration    | tempo de execução         |

---

# 8. Correlation ID

Cada requisição recebe um **Correlation ID**.

Fluxo:

```id="correlation-flow"
Client Request
   │
   ▼
API Gateway
   │
Generate Correlation ID
   │
   ▼
Services
   │
   ▼
Logs + Metrics + Traces
```

Header utilizado:

```id="correlation-header"
X-Correlation-ID
```

---

# 9. Metrics System

Métricas são utilizadas para monitoramento e alertas.

Tipos de métricas:

| Tipo      | Descrição            |
| --------- | -------------------- |
| Counter   | contagem acumulativa |
| Gauge     | valor atual          |
| Histogram | distribuição         |
| Timer     | tempo de execução    |

---

# 10. Métricas Técnicas

Exemplos de métricas técnicas:

```id="tech-metrics"
http_requests_total
http_request_duration
database_query_time
queue_jobs_processed
cache_hits
cache_misses
```

---

# 11. Métricas de Negócio

O sistema também coleta métricas de produto.

```id="business-metrics"
users_registered
orders_created
payments_processed
subscriptions_active
revenue_total
```

Essas métricas ajudam a analisar **uso e crescimento da plataforma**.

---

# 12. Event Telemetry

Eventos de domínio também são registrados.

Exemplos:

```id="event-telemetry"
UserRegistered
OrderCreated
PaymentCompleted
SubscriptionRenewed
AgentExecuted
```

Eventos são enviados para:

* logs
* métricas
* análise posterior

---

# 13. Health Monitoring

Sistema de verificação de saúde da plataforma.

Endpoints padrão:

```id="health-endpoints"
/health
/health/live
/health/ready
```

Tipos de checks:

| Tipo       | Descrição                   |
| ---------- | --------------------------- |
| Liveness   | serviço está ativo          |
| Readiness  | pronto para receber tráfego |
| Dependency | dependências externas       |
| Resource   | CPU/memória                 |

---

# 14. Alerting System

Alertas automáticos baseados em métricas.

Exemplos:

| Condição         | Alerta                  |
| ---------------- | ----------------------- |
| erro > 5%        | alerta crítico          |
| latência > 500ms | alerta de performance   |
| CPU > 80%        | alerta de capacidade    |
| fila acumulada   | alerta de processamento |

---

# 15. Dashboards Operacionais

Dashboards fornecem visão em tempo real do sistema.

Principais dashboards:

| Dashboard        | Conteúdo             |
| ---------------- | -------------------- |
| System Health    | estado geral         |
| API Performance  | latência e erros     |
| Queue Monitoring | filas                |
| Agent Activity   | execuções de agentes |
| Business Metrics | métricas de produto  |

---

# 16. Auditoria de Sistema

Operações críticas são auditadas.

Eventos auditados:

```id="audit-events"
login
permission_change
config_update
payment_operation
admin_action
```

Exemplo de registro:

```json id="audit-example"
{
  "event": "permission_changed",
  "actor": "admin",
  "target_user": 15,
  "timestamp": "2026-01-01T12:00:00Z"
}
```

---

# 17. Retenção de Dados

Política de retenção:

| Tipo    | Retenção |
| ------- | -------- |
| Logs    | 30 dias  |
| Metrics | 90 dias  |
| Traces  | 15 dias  |
| Audit   | 1 ano    |

---

# 18. Performance Sampling

Para reduzir volume de dados.

| Tipo       | Estratégia   |
| ---------- | ------------ |
| traces     | sampling 10% |
| debug logs | apenas dev   |
| métricas   | agregação    |

---

# 19. Stack de Observabilidade

Stack recomendada:

| Componente | Ferramenta     |
| ---------- | -------------- |
| Telemetry  | OpenTelemetry  |
| Logs       | Loki / ELK     |
| Metrics    | Prometheus     |
| Tracing    | Jaeger / Tempo |
| Dashboards | Grafana        |

---

# 20. Integração com DevOps

Observabilidade integrada ao pipeline de operações.

Usos:

| Uso                  | Descrição                 |
| -------------------- | ------------------------- |
| deploy monitoring    | monitorar deploy          |
| incident response    | detectar falhas           |
| performance analysis | otimização                |
| SLA tracking         | monitorar disponibilidade |

---

# 21. Monitoramento de Agentes

Execuções de agentes também são monitoradas.

Dados registrados:

```id="agent-metrics"
agent_executions_total
agent_execution_time
agent_failures
agent_retries
```

---

# 22. Fluxo Completo de Observabilidade

```id="observability-flow"
User Request
   │
   ▼
API Gateway
   │
   ▼
Application Services
   │
 ┌─ Logs
 ├─ Metrics
 ├─ Traces
 └─ Events
   │
   ▼
Telemetry Pipeline
   │
   ▼
Observability Platform
   │
   ▼
Dashboards / Alerts
```

---

# 23. Benefícios

| Benefício                | Impacto        |
| ------------------------ | -------------- |
| diagnóstico rápido       | menos downtime |
| monitoramento contínuo   | estabilidade   |
| visibilidade operacional | controle       |
| análise de performance   | otimização     |

---

# 24. Resultado Esperado

A camada de observabilidade permite que o CoreOps tenha:

* monitoramento completo
* diagnóstico rápido
* rastreamento de execuções
* controle operacional da plataforma.