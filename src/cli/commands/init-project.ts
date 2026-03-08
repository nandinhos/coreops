// ============================================================
// CoreOps CLI — init-project command
// coreops init [--mcp] [--path /outro/projeto]
// Configura CoreOps em um projeto externo
// ============================================================

import { existsSync, writeFileSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'

const COREOPS_MCP_PATH = join(import.meta.dir, '../../mcp/server.ts')
const COREOPS_ROOT = join(import.meta.dir, '../../..')

export function initProjectCommand(args: string[]): void {
  const targetPath = args.find((_, i) => args[i - 1] === '--path') ?? process.cwd()
  const targetDir = resolve(targetPath)
  const withMcp = args.includes('--mcp')

  if (!existsSync(targetDir)) {
    console.error(`Diretório não encontrado: ${targetDir}`)
    process.exit(1)
  }

  console.log(`\n[CoreOps] Configurando CoreOps em: ${targetDir}`)

  // Adicionar .gitignore entry se existir
  const gitignorePath = join(targetDir, '.gitignore')
  if (existsSync(gitignorePath)) {
    const content = readFileSync(gitignorePath, 'utf-8')
    if (!content.includes('.coreops/')) {
      writeFileSync(gitignorePath, content + '\n# CoreOps runtime state\n.coreops/\n')
      console.log('  ✓ .gitignore atualizado (.coreops/ adicionado)')
    } else {
      console.log('  · .gitignore já tem .coreops/')
    }
  }

  // Configurar MCP se solicitado
  if (withMcp) {
    const mcpPath = join(targetDir, '.mcp.json')
    let mcpConfig: { mcpServers: Record<string, unknown> } = { mcpServers: {} }

    if (existsSync(mcpPath)) {
      try {
        mcpConfig = JSON.parse(readFileSync(mcpPath, 'utf-8')) as typeof mcpConfig
        if (!mcpConfig.mcpServers) mcpConfig.mcpServers = {}
      } catch {
        console.warn('  ! .mcp.json existente inválido, sobrescrevendo entrada coreops.')
      }
    }

    mcpConfig.mcpServers['coreops'] = {
      command: 'bun',
      args: [COREOPS_MCP_PATH],
    }

    writeFileSync(mcpPath, JSON.stringify(mcpConfig, null, 2) + '\n')
    console.log('  ✓ .mcp.json configurado com servidor MCP do CoreOps')
    console.log(`    Ferramenta: bun ${COREOPS_MCP_PATH}`)
  }

  console.log(`
[CoreOps] Pronto! Para usar:

  # Dentro do projeto ${targetDir}:
  coreops start --name "meu-projeto" --description "descrição"
  coreops next
  coreops status`)

  if (!withMcp) {
    console.log(`
  # Para integração MCP nativa no Claude Code:
  coreops init --mcp --path ${targetDir}
  # Ou adicione manualmente ao .mcp.json:
  {
    "mcpServers": {
      "coreops": {
        "command": "bun",
        "args": ["${COREOPS_MCP_PATH}"]
      }
    }
  }`)
  } else {
    console.log(`
  # Reinicie o Claude Code para ativar as ferramentas MCP:
  coreops_status, coreops_start, coreops_next, coreops_backlog...`)
  }

  console.log(`
  # Ou use o slash command no chat:
  /coreops
`)
}
