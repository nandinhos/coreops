// ============================================================
// CoreOps — Versão centralizada
// Única fonte de verdade: package.json
// ============================================================

import pkg from '../../package.json' with { type: 'json' }

export const VERSION: string = pkg.version
