import type { Skill } from '../../core/types.ts'

export const LIVEWIRE_SKILL: Skill = {
  id: 'livewire',
  name: 'Livewire 4',
  applies_to: ['coder', 'reviewer', 'tester'],
  detect_patterns: ['app/Livewire', 'app/Http/Livewire', 'livewire/livewire', 'livewire'],
  context_injection: `
Você está trabalhando com **Livewire 4** (versão mais recente). Siga as convenções atuais:

**Estrutura de componentes:**
- Componentes em \`app/Livewire/\` (não mais \`app/Http/Livewire/\`)
- Views em \`resources/views/livewire/\` com extensão \`.blade.php\`
- Nomenclatura: \`app/Livewire/UserProfile.php\` → view \`livewire/user-profile.blade.php\`

**Sintaxe Livewire 4 — novidades obrigatórias:**
\`\`\`php
use Livewire\\Component;
use Livewire\\Attributes\\Computed;
use Livewire\\Attributes\\Rule;
use Livewire\\Attributes\\On;
use Livewire\\Attributes\\Layout;
use Livewire\\Attributes\\Title;

class UserProfile extends Component
{
    // Propriedades públicas são reativas automaticamente
    public string $name = '';
    public string $email = '';

    // Validação via atributo (Livewire 4)
    #[Rule('required|min:3')]
    public string $username = '';

    // Computed properties cacheadas
    #[Computed]
    public function fullName(): string
    {
        return $this->name . ' ' . $this->surname;
    }

    // Event listeners via atributo
    #[On('user-updated')]
    public function handleUserUpdated(int $userId): void
    {
        // ...
    }

    public function render()
    {
        return view('livewire.user-profile');
    }
}
\`\`\`

**Blade — diretivas e wire:**
- \`wire:model\` — binding bidirecional (com \`.live\` para real-time)
- \`wire:model.live\` — atualiza em cada keystroke
- \`wire:model.blur\` — atualiza ao perder foco
- \`wire:click\` — dispara método
- \`wire:submit\` — submit de formulário
- \`wire:loading\` — mostra durante processamento
- \`wire:dirty\` — mostra quando há mudanças não salvas
- \`wire:navigate\` — navegação SPA-like (Livewire 4)
- \`@entangle\` — sincronizar com Alpine.js

**Formulários Livewire 4:**
\`\`\`php
use Livewire\\WithFileUploads;
use Livewire\\Attributes\\Validate;

class CreatePost extends Component
{
    use WithFileUploads;

    #[Validate('required|min:10')]
    public string $title = '';

    #[Validate('required|image|max:1024')]
    public $photo;

    public function save(): void
    {
        $this->validate();
        // salvar...
        $this->reset(['title', 'photo']);
        $this->dispatch('post-created');
    }
}
\`\`\`

**Paginação:**
\`\`\`php
use Livewire\\WithPagination;

class UserList extends Component
{
    use WithPagination;

    #[Computed]
    public function users()
    {
        return User::paginate(10);
    }
}
\`\`\`

**Eventos entre componentes:**
- \`$this->dispatch('event-name', data: $value)\` — disparar
- \`#[On('event-name')]\` — escutar
- \`$this->dispatch('event-name')->to(OtherComponent::class)\` — direcionar

**Testes Livewire:**
\`\`\`php
use Livewire\\Livewire;

test('user can update profile', function () {
    $user = User::factory()->create();

    Livewire::actingAs($user)
        ->test(UserProfile::class)
        ->set('name', 'John')
        ->call('save')
        ->assertHasNoErrors()
        ->assertDispatched('profile-updated');
});
\`\`\`

**IMPORTANTE — Livewire 4 mudanças vs v3:**
- \`#[Computed]\` substitui \`getXxxProperty()\`
- \`#[Rule]\` / \`#[Validate]\` substitui \`protected $rules\`
- \`#[On]\` substitui \`protected $listeners\`
- \`wire:navigate\` para navegação SPA (novo)
- Componentes anônimos via Volt disponíveis
`,
}
