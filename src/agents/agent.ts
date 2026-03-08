// ============================================================
// CoreOps — Base Agent Interface
// Todos os agentes implementam este contrato
// ============================================================

export interface Agent<I, O> {
  readonly name: string
  execute(input: I): Promise<O>
}

export abstract class BaseAgent<I, O> implements Agent<I, O> {
  abstract readonly name: string
  abstract execute(input: I): Promise<O>
}
