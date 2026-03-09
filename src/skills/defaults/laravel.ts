import type { Skill } from '../../core/types.ts'

export const LARAVEL_SKILL: Skill = {
  id: 'laravel',
  name: 'Laravel 12',
  applies_to: ['coder', 'reviewer', 'tester', 'architect'],
  detect_patterns: ['artisan', 'app/Http', 'composer.json', 'laravel'],
  context_injection: `
Você está trabalhando em um projeto **Laravel 12**. Siga estritamente as convenções do framework:

**Estrutura de diretórios:**
- Controllers: \`app/Http/Controllers/\` — responsáveis apenas por HTTP (sem lógica de negócio)
- Services: \`app/Services/\` — lógica de negócio
- Repositories: \`app/Repositories/\` — acesso ao banco (opcional, via Eloquent)
- Models: \`app/Models/\` — Eloquent models com relacionamentos e escopos
- Requests: \`app/Http/Requests/\` — validação de formulários (FormRequest)
- Resources: \`app/Http/Resources/\` — transformação de respostas API (JsonResource)
- Policies: \`app/Policies/\` — autorização
- Events/Listeners: \`app/Events/\`, \`app/Listeners/\`
- Jobs: \`app/Jobs/\` — processamento assíncrono via Queue

**Convenções obrigatórias:**
- PascalCase para classes, camelCase para métodos
- Controller: \`UserController\`, Resource: \`UserResource\`, Model: \`User\`
- Routes em \`routes/web.php\` (web) ou \`routes/api.php\` (API)
- Migrations em \`database/migrations/\` com nomenclatura \`YYYY_MM_DD_HHMMSS_action_table.php\`
- Factories em \`database/factories/\`

**Eloquent — boas práticas:**
- Defina \`$fillable\` ou \`$guarded\` em todo Model
- Use escopos locais para queries reutilizáveis: \`public function scopeActive($query)\`
- Relacionamentos: \`hasMany\`, \`belongsTo\`, \`hasOne\`, \`belongsToMany\`, \`morphTo\`
- Eager loading obrigatório para evitar N+1: \`User::with('posts')->get()\`
- Use \`firstOrCreate\`, \`updateOrCreate\` ao invés de find+save manual

**Autenticação (Laravel Sanctum):**
- API stateless: tokens via \`createToken()\`
- Web: session-based com middleware \`auth\`
- Middleware: \`auth:sanctum\` para rotas protegidas

**Validação:**
- Sempre use FormRequest com método \`rules()\` e \`messages()\`
- Nunca valide diretamente no controller

**Respostas API:**
- Use \`JsonResource\` e \`ResourceCollection\` para transformação
- Padrão de resposta: \`{ data: ..., message: ..., status: ... }\`
- Códigos HTTP corretos: 200 (ok), 201 (created), 422 (validation), 401, 403, 404

**Testes (PHPUnit + Pest):**
- Testes de feature em \`tests/Feature/\`
- Testes unitários em \`tests/Unit/\`
- Use \`RefreshDatabase\` trait em testes com banco
- Factories para dados de teste: \`User::factory()->create()\`
`,
}
