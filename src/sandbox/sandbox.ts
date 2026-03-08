// ============================================================
// CoreOps — Execution Sandbox
// Subprocesso isolado com timeout, limites de output e métricas
// Phase 4: fundação para container-based sandboxing futuro
// ============================================================

export interface SandboxResult {
  success: boolean
  stdout: string
  stderr: string
  output: string // stdout + stderr combinados
  exit_code: number
  duration_ms: number
  timed_out: boolean
}

export interface SandboxOptions {
  cwd?: string
  env?: Record<string, string>
  /** Timeout em ms. Default: 120_000 (2 min) */
  timeout_ms?: number
  /** Limite de output em bytes. Default: 512_000 (512 KB) */
  max_output_bytes?: number
}

const DEFAULT_TIMEOUT_MS = 120_000
const DEFAULT_MAX_OUTPUT_BYTES = 512_000

export class Sandbox {
  async run(
    cmd: string,
    args: string[],
    options: SandboxOptions = {},
  ): Promise<SandboxResult> {
    const {
      cwd = process.cwd(),
      env,
      timeout_ms = DEFAULT_TIMEOUT_MS,
      max_output_bytes = DEFAULT_MAX_OUTPUT_BYTES,
    } = options

    const start = Date.now()
    let timed_out = false

    const proc = Bun.spawn([cmd, ...args], {
      cwd,
      stdout: 'pipe',
      stderr: 'pipe',
      env: env ? { ...process.env, ...env } : process.env,
    })

    // Kill automático por timeout
    const timer = setTimeout(() => {
      timed_out = true
      proc.kill()
    }, timeout_ms)

    const [stdoutRaw, stderrRaw] = await Promise.all([
      new Response(proc.stdout).arrayBuffer(),
      new Response(proc.stderr).arrayBuffer(),
    ])

    const exit_code = await proc.exited
    clearTimeout(timer)

    const duration_ms = Date.now() - start

    // Decodificar com limite de tamanho
    const stdout = truncate(Buffer.from(stdoutRaw).toString('utf-8'), max_output_bytes)
    const stderr = truncate(Buffer.from(stderrRaw).toString('utf-8'), max_output_bytes)
    const output = [stdout, stderr].filter(Boolean).join('\n')

    return {
      success: exit_code === 0 && !timed_out,
      stdout,
      stderr,
      output,
      exit_code: timed_out ? -1 : exit_code,
      duration_ms,
      timed_out,
    }
  }
}

function truncate(text: string, maxBytes: number): string {
  const bytes = Buffer.byteLength(text, 'utf-8')
  if (bytes <= maxBytes) return text
  // Truncar por bytes, não por chars
  const buf = Buffer.from(text, 'utf-8')
  return buf.subarray(0, maxBytes).toString('utf-8') + '\n[... output truncado]'
}
