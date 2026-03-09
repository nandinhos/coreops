import type { Skill } from '../../core/types.ts'

export const NODE_EXPRESS_SKILL: Skill = {
  id: 'node-express',
  name: 'Node.js + Express',
  applies_to: ['coder', 'reviewer', 'tester'],
  detect_patterns: ['express', 'src/routes', 'src/controllers', 'src/middleware'],
  context_injection: `
Você está trabalhando com **Node.js + Express** (TypeScript). Padrões obrigatórios:

**Estrutura controller-service-repository:**
\`\`\`
src/
  controllers/   — HTTP handlers (sem lógica de negócio)
  services/      — lógica de negócio
  repositories/  — acesso ao banco
  middleware/    — autenticação, validação, erros
  routes/        — definição de rotas
  models/        — tipos e schemas
  utils/         — helpers reutilizáveis
\`\`\`

**Controller — padrão:**
\`\`\`typescript
export class UserController {
  constructor(private readonly userService: UserService) {}

  create = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = await this.userService.create(req.body)
      res.status(201).json({ data: user, message: 'Usuário criado' })
    } catch (error) {
      next(error)
    }
  }
}
\`\`\`

**Validação com Zod:**
\`\`\`typescript
const createUserSchema = z.object({
  email: z.string().email(),
  name: z.string().min(2).max(100),
})

// Middleware de validação
function validate(schema: ZodSchema) {
  return (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.body)
    if (!result.success) {
      return res.status(422).json({ errors: result.error.flatten() })
    }
    req.body = result.data
    next()
  }
}
\`\`\`

**Error handling centralizado:**
\`\`\`typescript
// middleware/error-handler.ts
export function errorHandler(err: Error, req: Request, res: Response, next: NextFunction) {
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({ message: err.message })
  }
  console.error(err)
  res.status(500).json({ message: 'Erro interno do servidor' })
}
\`\`\`

**Autenticação JWT:**
\`\`\`typescript
import jwt from 'jsonwebtoken'

export function authMiddleware(req: Request, res: Response, next: NextFunction) {
  const token = req.headers.authorization?.split(' ')[1]
  if (!token) return res.status(401).json({ message: 'Token não fornecido' })

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET!)
    req.user = payload as JwtPayload
    next()
  } catch {
    res.status(401).json({ message: 'Token inválido' })
  }
}
\`\`\`

**Testes (Vitest + Supertest):**
\`\`\`typescript
import { describe, test, expect, beforeAll, afterAll } from 'vitest'
import request from 'supertest'
import { app } from '../src/app'

describe('POST /users', () => {
  test('cria usuário com dados válidos', async () => {
    const res = await request(app)
      .post('/users')
      .send({ name: 'João', email: 'joao@test.com' })

    expect(res.status).toBe(201)
    expect(res.body.data.email).toBe('joao@test.com')
  })
})
\`\`\`
`,
}
