# Agent Runner
# CoreOps – Arquitetura de Produto

## 08. Observabilidade & Telemetria

### 1. Objetivo

A camada de **Observabilidade e Telemetria** do CoreOps fornece **visibilidade completa do comportamento do sistema**, permitindo:

* Monitoramento em tempo real
* Diagnóstico de falhas
* Rastreamento de execução
* Auditoria operacional
* Análise de performance
* Base para melhoria contínua

Essa camada é projetada para operar **de forma transversal em todos os módulos da plataforma**.

---

# 2. Princípios de Observabilidade

O CoreOps segue os **3 pilares clássicos de observabilidade**:

| Pilar   | Objetivo                             |
| ------- | ------------------------------------ |
| Logs    | Registro detalhado de eventos        |
| Metrics | Indicadores quantitativos            |
| Tracing | Rastreamento de execução distribuída |

Além disso adiciona:

| Pilar adicional | Função                       |
| --------------- | ---------------------------- |
| Events          | Eventos de domínio           |
| Audit           | Auditoria de operações       |
| Health          | Monitoramento de integridade |

---

# 3. Arquitetura de Telemetria

```
Application Layer
      │
      ▼
Telemetry SDK
      │
      ▼
Telemetry Pipeline
      │
 ┌────┼───────────────┬──────────────┐
 ▼    ▼               ▼              ▼
Logs  Metrics      Traces         Events
 │      │            │               │
 ▼      ▼            ▼               ▼
Storage & Observability Platform
 │
 ▼
Dashboards / Alerts / Analytics
```

---

# 4. Componentes da Camada

## 4.1 Telemetry SDK

Biblioteca integrada ao código da aplicação responsável por:

* registrar logs estruturados
* enviar métricas
* gerar traces
* registrar eventos

### Responsabilidades

* Context propagation
* Trace correlation
* Performance timers
* Error capturing

### Exemplo de uso

```php
Telemetry::trace('order.processing', function() use ($order) {

    Telemetry::metric('orders.processing.start');

    $this->paymentService->charge($order);

    Telemetry::metric('orders.processing.completed');

});
```

---

# 4.2 Log System

Logs seguem padrão **JSON estruturado**.

### Estrutura padrão

```json
{
  "timestamp": "2026-01-10T10:10:00Z",
  "level": "INFO",
  "service": "orders",
  "message": "Order processed",
  "trace_id": "abc123",
  "user_id": 10,
  "context": {
    "order_id": 1201
  }
}
```

### Níveis de log

| Nível    | Uso                     |
| -------- | ----------------------- |
| DEBUG    | desenvolvimento         |
| INFO     | operações normais       |
| NOTICE   | comportamento relevante |
| WARNING  | alerta                  |
| ERROR    | falha de execução       |
| CRITICAL | falha grave             |

---

# 4.3 Metrics System

Métricas são utilizadas para monitoramento e alertas.

### Tipos de métricas

| Tipo      | Descrição            |
| --------- | -------------------- |
| Counter   | contagem acumulativa |
| Gauge     | valor atual          |
| Histogram | distribuição         |
| Timer     | tempo de execução    |

### Exemplos

```
http_requests_total
queue_jobs_processed
order_processing_time
api_latency
database_connections_active
```

---

# 4.4 Distributed Tracing

Rastreamento de chamadas entre serviços.

### Estrutura

```
Trace
 ├── Span: HTTP Request
 │    ├── Span: Auth Service
 │    ├── Span: Order Service
 │    └── Span: Payment Gateway
```

### Dados capturados

| Campo       | Descrição      |
| ----------- | -------------- |
| trace_id    | ID da execução |
| span_id     | etapa          |
| parent_span | hierarquia     |
| duration    | duração        |
| tags        | metadados      |

---

# 5. Correlation ID

Cada requisição recebe um **Correlation ID** único.

### Fluxo

```
Client Request
   │
   ▼
API Gateway
   │
   ▼
Generate Correlation ID
   │
   ▼
Propagate via headers
   │
   ▼
Services + Logs + Traces
```

### Header utilizado

```
X-Correlation-ID
```

---

# 6. Event Telemetry

Eventos de domínio também são registrados.

### Exemplo

```
UserRegistered
OrderPaid
SubscriptionCancelled
InvoiceGenerated
```

Evento gera:

* log
* métrica
* trace

---

# 7. Health Monitoring

Sistema de verificação de saúde da plataforma.

### Tipos

| Tipo       | Função                |
| ---------- | --------------------- |
| Liveness   | serviço está rodando  |
| Readiness  | serviço pronto        |
| Dependency | dependências externas |
| Resource   | CPU / memória         |

### Endpoint padrão

```
/health
/health/live
/health/ready
```

---

# 8. Alerting System

Sistema de alertas baseado em métricas.

### Tipos de alertas

| Tipo          | Exemplo           |
| ------------- | ----------------- |
| Performance   | latência > 500ms  |
| Errors        | taxa de erro > 2% |
| Capacity      | memória > 80%     |
| Queue backlog | fila acumulada    |

---

# 9. Dashboards Operacionais

Painéis de monitoramento em tempo real.

### Dashboards principais

| Dashboard        | Conteúdo              |
| ---------------- | --------------------- |
| System Health    | CPU / memória         |
| API Performance  | latência / erros      |
| Queue Monitoring | jobs                  |
| Business Metrics | pedidos / faturamento |
| Security Events  | tentativas suspeitas  |

---

# 10. Auditoria de Sistema

Auditoria registra ações sensíveis.

### Eventos auditáveis

| Evento            | Descrição                 |
| ----------------- | ------------------------- |
| login             | acesso do usuário         |
| permission change | alteração de permissões   |
| config change     | alteração de configuração |
| payment operation | operação financeira       |
| admin actions     | ações administrativas     |

### Exemplo

```json
{
  "event": "permission.changed",
  "actor": "admin",
  "target_user": 15,
  "timestamp": "2026-01-10T10:00:00Z"
}
```

---

# 11. Retenção de Dados

| Tipo    | Retenção |
| ------- | -------- |
| Logs    | 30 dias  |
| Metrics | 90 dias  |
| Traces  | 15 dias  |
| Audit   | 1 ano    |
| Events  | 90 dias  |

---

# 12. Performance Sampling

Para sistemas de alto volume:

| Tipo       | Estratégia   |
| ---------- | ------------ |
| Traces     | sampling 10% |
| Debug logs | apenas dev   |
| Metrics    | agregação    |

---

# 13. Observability Stack (Recomendado)

### Coleta

```
OpenTelemetry
```

### Logs

```
Loki / ELK
```

### Metrics

```
Prometheus
```

### Tracing

```
Jaeger / Tempo
```

### Dashboards

```
Grafana
```

---

# 14. Integração com DevOps

Observabilidade integrada ao ciclo DevOps.

### Utilizações

| Uso                | Descrição            |
| ------------------ | -------------------- |
| CI/CD              | validação de deploy  |
| SLO monitoring     | monitoramento de SLA |
| incident response  | diagnóstico          |
| performance tuning | otimização           |

---

# 15. Métricas de Negócio

Além de métricas técnicas, o CoreOps monitora **métricas de produto**.

### Exemplos

```
orders_created_total
orders_paid_total
active_subscriptions
new_users_daily
revenue_daily
```

---

# 16. Segurança de Telemetria

Medidas aplicadas:

| Medida      | Função           |
| ----------- | ---------------- |
| PII masking | anonimização     |
| encryption  | proteção         |
| RBAC        | acesso aos dados |
| audit logs  | rastreabilidade  |

---

# 17. Fluxo Completo de Observabilidade

```
User Request
   │
   ▼
API Gateway
   │
   ▼
Service Execution
   │
   ├─ Log
   ├─ Metrics
   ├─ Trace
   └─ Events
   │
   ▼
Telemetry Pipeline
   │
   ▼
Observability Platform
   │
   ▼
Dashboards / Alerts / Analysis
```

---

# 18. Benefícios da Arquitetura

| Benefício              | Impacto        |
| ---------------------- | -------------- |
| diagnóstico rápido     | menos downtime |
| monitoramento contínuo | estabilidade   |
| análise de performance | otimização     |
| auditoria completa     | segurança      |
| visão operacional      | governança     |

---

# 19. Resultado Esperado

A camada de observabilidade permite que o CoreOps tenha:

* **monitoramento de ponta a ponta**
* **diagnóstico rápido de falhas**
* **visibilidade operacional completa**
* **controle de performance**
* **base para decisões de produto**