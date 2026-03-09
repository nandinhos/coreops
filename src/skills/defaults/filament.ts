import type { Skill } from '../../core/types.ts'

export const FILAMENT_SKILL: Skill = {
  id: 'filament',
  name: 'Filament V4',
  applies_to: ['coder', 'reviewer', 'tester'],
  detect_patterns: ['filament/filament', 'filament', 'app/Filament'],
  context_injection: `
Você está trabalhando com **Filament V4** para Laravel. Convenções obrigatórias:

**Estrutura de arquivos:**
- Resources: \`app/Filament/Resources/\`
- Pages personalizadas: \`app/Filament/Pages/\`
- Widgets: \`app/Filament/Widgets/\`
- Clusters: \`app/Filament/Clusters/\` (agrupamento de recursos)

**Resource — estrutura padrão:**
\`\`\`php
namespace App\\Filament\\Resources;

use Filament\\Resources\\Resource;
use Filament\\Forms;
use Filament\\Tables;
use Filament\\Forms\\Form;
use Filament\\Tables\\Table;
use App\\Models\\User;

class UserResource extends Resource
{
    protected static ?string $model = User::class;
    protected static ?string $navigationIcon = 'heroicon-o-users';
    protected static ?string $navigationGroup = 'Gestão';
    protected static ?int $navigationSort = 1;

    public static function form(Form $form): Form
    {
        return $form->schema([
            Forms\\Components\\TextInput::make('name')
                ->required()
                ->maxLength(255),
            Forms\\Components\\TextInput::make('email')
                ->email()
                ->required()
                ->unique(ignoreRecord: true),
        ]);
    }

    public static function table(Table $table): Table
    {
        return $table
            ->columns([
                Tables\\Columns\\TextColumn::make('name')->searchable()->sortable(),
                Tables\\Columns\\TextColumn::make('email')->searchable(),
                Tables\\Columns\\TextColumn::make('created_at')->dateTime()->sortable(),
            ])
            ->filters([
                Tables\\Filters\\TrashedFilter::make(),
            ])
            ->actions([
                Tables\\Actions\\EditAction::make(),
                Tables\\Actions\\DeleteAction::make(),
            ])
            ->bulkActions([
                Tables\\Actions\\BulkActionGroup::make([
                    Tables\\Actions\\DeleteBulkAction::make(),
                ]),
            ]);
    }

    public static function getPages(): array
    {
        return [
            'index' => Pages\\ListUsers::route('/'),
            'create' => Pages\\CreateUser::route('/create'),
            'edit' => Pages\\EditUser::route('/{record}/edit'),
        ];
    }
}
\`\`\`

**Form Fields mais usados:**
- \`TextInput::make()\` — texto, email, password (com \`->password()\`)
- \`Textarea::make()\` — texto longo
- \`Select::make()\` — dropdown (com \`->options()\` ou \`->relationship()\`)
- \`Toggle::make()\` — boolean
- \`DatePicker::make()\` — data
- \`FileUpload::make()\` — upload de arquivo
- \`RichEditor::make()\` — editor rich text
- \`Repeater::make()\` — campos repetíveis
- \`Section::make()->schema([])\` — agrupamento visual

**Table Columns mais usados:**
- \`TextColumn::make()\` — texto (com \`->badge()\`, \`->color()\`)
- \`BooleanColumn::make()\` — ícone sim/não
- \`ImageColumn::make()\` — imagem
- \`BadgeColumn::make()\` — status colorido

**Autorização:**
\`\`\`php
public static function canViewAny(): bool
{
    return auth()->user()->can('view-any', static::$model);
}
\`\`\`

**Widgets:**
\`\`\`php
class StatsOverviewWidget extends BaseWidget
{
    protected function getStats(): array
    {
        return [
            Stat::make('Total de Usuários', User::count())
                ->description('Registrados')
                ->color('success'),
        ];
    }
}
\`\`\`
`,
}
