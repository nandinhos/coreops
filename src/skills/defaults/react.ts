import type { Skill } from '../../core/types.ts'

export const REACT_SKILL: Skill = {
  id: 'react',
  name: 'React 19',
  applies_to: ['coder', 'reviewer', 'tester'],
  detect_patterns: ['react', 'next.config', '.tsx', 'src/components'],
  context_injection: `
Você está trabalhando com **React 19**. Siga as melhores práticas atuais:

**Componentes — regras fundamentais:**
- Sempre use componentes funcionais (nunca class components)
- Props tipadas com TypeScript interface (nunca \`any\`)
- Exporte como named exports ou default conforme convenção do projeto

**Hooks — uso correto:**
\`\`\`tsx
// useState com TypeScript
const [count, setCount] = useState<number>(0)
const [user, setUser] = useState<User | null>(null)

// useEffect — dependências sempre completas
useEffect(() => {
  fetchData()
  return () => cleanup() // cleanup quando necessário
}, [dependency]) // sem dependências vazias sem justificativa

// useCallback para funções passadas como props
const handleClick = useCallback(() => {
  doSomething(id)
}, [id])

// useMemo para cálculos caros
const filtered = useMemo(
  () => items.filter(i => i.active),
  [items]
)
\`\`\`

**React 19 — novidades:**
- \`use()\` hook para Promises e Context
- Server Components por padrão no Next.js (marcar \`'use client'\` quando necessário)
- \`useOptimistic\` para UI otimista
- \`useFormState\` e \`useFormStatus\` para forms com Server Actions
- \`ref\` como prop diretamente (sem \`forwardRef\`)

**Estado global:**
- Prefira Context API para estado simples
- Use Zustand ou Jotai para estado complexo (evite Redux em novos projetos)

**Formulários:**
\`\`\`tsx
// React Hook Form é preferido
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
})

function LoginForm() {
  const { register, handleSubmit, formState: { errors } } = useForm({
    resolver: zodResolver(schema),
  })
  // ...
}
\`\`\`

**Performance:**
- \`React.memo\` para componentes que recebem props estáveis
- Lazy loading: \`const Modal = lazy(() => import('./Modal'))\`
- \`Suspense\` como boundary para async components

**Testes (Vitest + Testing Library):**
\`\`\`tsx
import { render, screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

test('button increments counter', async () => {
  const user = userEvent.setup()
  render(<Counter />)
  await user.click(screen.getByRole('button', { name: /increment/i }))
  expect(screen.getByText('1')).toBeInTheDocument()
})
\`\`\`

**Convenções de arquivo:**
- Componentes: \`PascalCase.tsx\`
- Hooks: \`use-kebab-case.ts\` ou \`useCamelCase.ts\`
- Utilitários: \`kebab-case.ts\`
- Testes: \`ComponentName.test.tsx\`
`,
}
