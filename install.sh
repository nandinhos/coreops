#!/usr/bin/env bash
# ============================================================
# CoreOps — Instalador
# https://github.com/nandinhos/coreops
#
# Uso:
#   curl -fsSL https://raw.githubusercontent.com/nandinhos/coreops/main/install.sh | bash
#   bash install.sh [--update] [--force] [--uninstall] [--dry-run] [--mcp] [--branch main]
# ============================================================

set -euo pipefail

# ============================================================
# Constantes
# ============================================================
REPO_URL="https://github.com/nandinhos/coreops.git"
INSTALL_DIR="${HOME}/.local/share/coreops"
REPO_DIR="${INSTALL_DIR}/repo"
GLOBAL_DATA_DIR="${HOME}/.coreops"   # DATA — NUNCA tocado pelo installer
SENTINEL="${REPO_DIR}/.installed-version"
LOCKFILE="/tmp/coreops-install.lock"
BRANCH="main"

# ============================================================
# Flags
# ============================================================
DRY_RUN=0
FORCE=0
UNINSTALL=0
MCP=0
NO_COLOR=0
QUIET=0

_usage() {
  cat <<EOF
CoreOps Installer

Uso: bash install.sh [opções]

Opções:
  --update      Forçar pull mesmo se já na versão mais recente
  --force       Re-clonar do zero (preserva ~/.coreops/)
  --uninstall   Remover instalação (preserva ~/.coreops/)
  --dry-run     Simular sem executar nada
  --mcp         Escrever .mcp.json no diretório atual após instalar
  --branch <n>  Instalar de branch específico (default: main)
  --no-color    Sem cores ANSI
  --quiet       Suprimir output não-essencial
  --help        Este menu

Dados preservados sempre:
  ~/.coreops/memory.db     — memória global (aprendizado acumulado)
  ~/.coreops/llm-cache.db  — cache de respostas LLM
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --update)    FORCE=1 ;;
    --force)     FORCE=1 ;;
    --uninstall) UNINSTALL=1 ;;
    --dry-run)   DRY_RUN=1 ;;
    --mcp)       MCP=1 ;;
    --no-color)  NO_COLOR=1 ;;
    --quiet)     QUIET=1 ;;
    --branch)    BRANCH="${2:-main}"; shift ;;
    --help|-h)   _usage; exit 0 ;;
    *) echo "Flag desconhecida: $1. Use --help."; exit 1 ;;
  esac
  shift
done

# ============================================================
# Cores (desativadas se --no-color ou não-TTY)
# ============================================================
if [[ $NO_COLOR -eq 0 && -t 1 ]]; then
  RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
  BLUE='\033[0;34m'; BOLD='\033[1m'; RESET='\033[0m'
else
  RED=''; GREEN=''; YELLOW=''; BLUE=''; BOLD=''; RESET=''
fi

_info()    { [[ $QUIET -eq 0 ]] && echo -e "${BLUE}  →${RESET} $*" || true; }
_ok()      { [[ $QUIET -eq 0 ]] && echo -e "${GREEN}  ✓${RESET} $*" || true; }
_warn()    { echo -e "${YELLOW}  !${RESET} $*" >&2; }
_error()   { echo -e "${RED}  ✗ ERRO:${RESET} $*" >&2; exit 1; }
_dry()     { echo -e "${YELLOW}  DRY-RUN:${RESET} $*"; }
_section() { [[ $QUIET -eq 0 ]] && echo -e "\n${BOLD}$*${RESET}" || true; }

_run() {
  if [[ $DRY_RUN -eq 1 ]]; then
    _dry "$*"
  else
    eval "$*"
  fi
}

# ============================================================
# Segurança: nunca operar dentro do data dir
# ============================================================
_safe_remove() {
  local target="$1"
  if [[ -z "$target" ]]; then
    _error "_safe_remove: caminho vazio"
  fi
  if [[ "$target" == "${GLOBAL_DATA_DIR}"* ]]; then
    _error "Recusado: não é permitido remover dentro de ${GLOBAL_DATA_DIR} (data dir)"
  fi
  if [[ "$target" == "$HOME" || "$target" == "/" || "$target" == "/home" ]]; then
    _error "Recusado: caminho perigoso: $target"
  fi
  _run "rm -rf '$target'"
}

# ============================================================
# Pré-requisitos
# ============================================================
_check_git() {
  if ! command -v git &>/dev/null; then
    echo ""
    echo "git não encontrado. Instale com:"
    echo "  Ubuntu/Debian : sudo apt install git"
    echo "  macOS         : brew install git"
    echo "  Fedora/RHEL   : sudo dnf install git"
    _error "git é obrigatório"
  fi
  _ok "git $(git --version | cut -d' ' -f3)"
}

_install_bun() {
  _info "Instalando Bun..."
  _run "curl -fsSL https://bun.sh/install | bash"
  # Recarregar PATH para a sessão atual
  export PATH="${HOME}/.bun/bin:$PATH"
  if ! command -v bun &>/dev/null; then
    _error "Bun instalado mas não encontrado no PATH. Reinicie o terminal e rode novamente."
  fi
}

_check_bun() {
  if ! command -v bun &>/dev/null; then
    _warn "Bun não encontrado. Instalando automaticamente..."
    _install_bun
  fi
  _ok "bun $(bun --version)"
}

# ============================================================
# Verificação de integridade do repo clonado
# ============================================================
_check_repo_integrity() {
  if [[ -d "$REPO_DIR" ]] && ! git -C "$REPO_DIR" rev-parse --git-dir &>/dev/null 2>&1; then
    _warn "Diretório de instalação existe mas repositório git está corrompido."
    _warn "Removendo instalação corrompida e re-clonando..."
    _safe_remove "$REPO_DIR"
  fi
}

# ============================================================
# Sentinel (rastreamento de versão instalada)
# ============================================================
_read_sentinel() {
  INSTALLED_COMMIT=""
  INSTALLED_VERSION=""
  INSTALLED_BRANCH=""
  if [[ -f "$SENTINEL" ]]; then
    INSTALLED_COMMIT=$(grep '^COMMIT=' "$SENTINEL" 2>/dev/null | cut -d= -f2 || true)
    INSTALLED_VERSION=$(grep '^VERSION=' "$SENTINEL" 2>/dev/null | cut -d= -f2 || true)
    INSTALLED_BRANCH=$(grep '^BRANCH=' "$SENTINEL" 2>/dev/null | cut -d= -f2 || true)
  fi
}

_write_sentinel() {
  local commit version
  commit=$(git -C "$REPO_DIR" rev-parse HEAD 2>/dev/null || echo "unknown")
  version=$(bun -e "import p from '${REPO_DIR}/package.json'; console.log(p.version)" 2>/dev/null || echo "unknown")
  if [[ $DRY_RUN -eq 0 ]]; then
    cat > "$SENTINEL" <<EOF
COMMIT=${commit}
VERSION=${version}
INSTALLED_AT=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
BRANCH=${BRANCH}
EOF
  else
    _dry "escrever sentinel: COMMIT=${commit} VERSION=${version}"
  fi
}

# ============================================================
# Verificação de rede
# ============================================================
_check_network() {
  git -C "$REPO_DIR" ls-remote --quiet origin &>/dev/null 2>&1
}

# ============================================================
# Verificação pós-install
# ============================================================
_check_path_hint() {
  if ! echo "$PATH" | grep -q "${HOME}/.bun/bin"; then
    echo ""
    _warn "~/.bun/bin não está no PATH. Adicione ao seu shell:"
    echo ""
    echo '    # bash (~/.bashrc ou ~/.bash_profile):'
    echo '    export PATH="$HOME/.bun/bin:$PATH"'
    echo ""
    echo '    # zsh (~/.zshrc):'
    echo '    export PATH="$HOME/.bun/bin:$PATH"'
    echo ""
    echo '    Depois: source ~/.zshrc  (ou reinicie o terminal)'
  fi
}

_verify_install() {
  export PATH="${HOME}/.bun/bin:$PATH"
  if command -v coreops &>/dev/null; then
    local v
    v=$(coreops --version 2>/dev/null || echo "?")
    _ok "coreops verificado: $v"
  else
    _warn "'coreops' não encontrado no PATH após instalação."
    _check_path_hint
  fi
}

# ============================================================
# Mensagem pós-install e snippet MCP
# ============================================================
_post_install_message() {
  local version commit
  version=$(grep '^VERSION=' "$SENTINEL" 2>/dev/null | cut -d= -f2 || echo "?")
  commit=$(grep '^COMMIT=' "$SENTINEL" 2>/dev/null | cut -d= -f2 | cut -c1-7 || echo "?")
  local mcp_path="${REPO_DIR}/src/mcp/server.ts"

  echo ""
  echo -e "${GREEN}${BOLD}CoreOps v${version} instalado com sucesso.${RESET}"
  echo ""
  echo -e "  Install path : ${BLUE}${REPO_DIR}${RESET}"
  echo    "  Commit       : ${commit}"
  echo    "  Branch       : ${BRANCH}"
  echo    "  Binários     : ~/.bun/bin/coreops"
  echo    "                 ~/.bun/bin/coreops-mcp"
  echo ""
  echo    "  Começar agora:"
  echo -e "    ${BOLD}coreops --help${RESET}"
  echo -e "    ${BOLD}coreops start${RESET}"
  echo ""
  echo    "  Integração MCP (cole no .mcp.json do projeto):"
  echo    ""
  echo    '    {'
  echo    '      "mcpServers": {'
  echo    '        "coreops": {'
  echo    '          "command": "bun",'
  echo    "          \"args\": [\"${mcp_path}\"]"
  echo    '        }'
  echo    '      }'
  echo    '    }'
  echo ""
  echo -e "  Ou execute: ${BOLD}coreops init --mcp${RESET}  (dentro do projeto alvo)"

  _check_path_hint
}

# ============================================================
# Geração de .mcp.json no diretório atual (--mcp)
# ============================================================
_write_mcp_config() {
  local mcp_path="${REPO_DIR}/src/mcp/server.ts"
  local target="${PWD}/.mcp.json"

  local existing='{}'
  if [[ -f "$target" ]]; then
    existing=$(cat "$target")
    _info ".mcp.json existente encontrado — merge em andamento"
  fi

  if [[ $DRY_RUN -eq 0 ]]; then
    # Usar bun para fazer merge seguro do JSON
    bun -e "
      const existing = JSON.parse(\`${existing}\`);
      if (!existing.mcpServers) existing.mcpServers = {};
      existing.mcpServers.coreops = { command: 'bun', args: ['${mcp_path}'] };
      process.stdout.write(JSON.stringify(existing, null, 2) + '\n');
    " > "$target"
    _ok ".mcp.json escrito em: $target"
  else
    _dry "escrever .mcp.json com coreops entry em: $target"
  fi
}

# ============================================================
# Operações principais
# ============================================================
_clone() {
  _info "Clonando repositório (branch: ${BRANCH})..."
  _run "mkdir -p '${INSTALL_DIR}'"
  _run "git clone --branch '${BRANCH}' '${REPO_URL}' '${REPO_DIR}'"
}

_pull() {
  _info "Atualizando repositório..."
  _run "git -C '${REPO_DIR}' fetch origin '${BRANCH}'"
  if ! git -C "$REPO_DIR" merge --ff-only "origin/${BRANCH}" &>/dev/null 2>&1; then
    if [[ $DRY_RUN -eq 0 ]]; then
      _warn "git pull --ff-only falhou. Repositório remoto pode ter tido force-push."
      _warn "Para re-instalar do zero (dados preservados): bash install.sh --force"
      exit 1
    else
      _dry "git merge --ff-only origin/${BRANCH}"
    fi
  fi
}

_bun_install() {
  _info "Instalando dependências (bun install)..."
  _run "bun install --cwd '${REPO_DIR}' --frozen-lockfile"
}

_bun_link() {
  _info "Registrando binários globais (bun link)..."
  _run "bun link --cwd '${REPO_DIR}'"
}

# ============================================================
# Workflows de alto nível
# ============================================================
_fresh_install() {
  _section "Instalação do CoreOps"
  _clone
  _bun_install
  _write_sentinel
  _bun_link
  _post_install_message
  [[ $MCP -eq 1 ]] && _write_mcp_config
  _verify_install
}

_update_install() {
  _section "Atualizando CoreOps"
  _pull
  _bun_install
  _write_sentinel
  _bun_link
  _post_install_message
  [[ $MCP -eq 1 ]] && _write_mcp_config
  _verify_install
}

_uninstall_coreops() {
  _section "Desinstalando CoreOps"
  _info "Removendo binários globais..."
  _run "bun unlink --cwd '${REPO_DIR}' 2>/dev/null || true"

  _info "Removendo código instalado..."
  _safe_remove "$REPO_DIR"

  # Remove o diretório pai se vazio
  if [[ -d "$INSTALL_DIR" ]] && [[ -z "$(ls -A "$INSTALL_DIR" 2>/dev/null)" ]]; then
    _run "rmdir '${INSTALL_DIR}'"
  fi

  echo ""
  _ok "CoreOps desinstalado."
  echo ""
  echo "  Seus dados foram preservados:"
  echo "    ${GLOBAL_DATA_DIR}/memory.db"
  echo "    ${GLOBAL_DATA_DIR}/llm-cache.db"
  echo ""
  echo "  Para remover os dados também (irreversível):"
  echo "    rm -rf ${GLOBAL_DATA_DIR}"
}

# ============================================================
# Lock para evitar execuções concorrentes
# ============================================================
exec 200>"$LOCKFILE"
if ! flock -n 200 2>/dev/null; then
  _warn "Outra instalação está em progresso. Aguardando..."
  flock 200
fi

# ============================================================
# Main
# ============================================================
main() {
  [[ $QUIET -eq 0 ]] && echo ""
  [[ $QUIET -eq 0 ]] && echo -e "${BOLD}CoreOps Installer${RESET}"
  [[ $DRY_RUN -eq 1 ]] && echo -e "${YELLOW}  (modo dry-run — nenhuma alteração será feita)${RESET}"

  _section "Verificando pré-requisitos"
  _check_git
  _check_bun

  # Garantir que o data dir existe (sem tocar em conteúdo existente)
  if [[ $DRY_RUN -eq 0 && ! -d "$GLOBAL_DATA_DIR" ]]; then
    mkdir -p "$GLOBAL_DATA_DIR"
    _ok "Diretório de dados criado: ${GLOBAL_DATA_DIR}"
  fi

  # --uninstall
  if [[ $UNINSTALL -eq 1 ]]; then
    if [[ ! -d "$REPO_DIR" ]]; then
      _warn "CoreOps não parece instalado em: ${REPO_DIR}"
      exit 0
    fi
    _uninstall_coreops
    exit 0
  fi

  # Verificar integridade do repo existente
  _check_repo_integrity

  # Fresh install (sentinel ausente)
  if [[ ! -f "$SENTINEL" ]]; then
    if [[ -d "$REPO_DIR" ]]; then
      # Repo existe mas sem sentinel — tratar como fresh
      _warn "Instalação incompleta detectada. Re-instalando..."
      _safe_remove "$REPO_DIR"
    fi
    _fresh_install
    exit 0
  fi

  # --force: re-clonar
  if [[ $FORCE -eq 1 ]]; then
    _info "Forçando re-instalação (--force)..."
    _safe_remove "$REPO_DIR"
    _fresh_install
    exit 0
  fi

  # Ler estado instalado
  _read_sentinel

  # Verificar rede antes de comparar versões
  if ! _check_network; then
    _warn "Sem acesso ao repositório remoto (offline?)."
    _warn "Versão instalada: ${INSTALLED_VERSION} (${INSTALLED_COMMIT:0:7})"
    _warn "Para forçar re-link sem atualizar: bash install.sh --force"
    exit 0
  fi

  # Comparar commit local vs remoto
  REMOTE_COMMIT=$(git -C "$REPO_DIR" ls-remote "origin/${BRANCH}" 2>/dev/null | head -1 | cut -f1 || echo "")

  if [[ -z "$REMOTE_COMMIT" ]]; then
    _warn "Não foi possível obter commit remoto. Tentando via fetch..."
    git -C "$REPO_DIR" fetch origin "$BRANCH" --quiet 2>/dev/null || true
    REMOTE_COMMIT=$(git -C "$REPO_DIR" rev-parse "origin/${BRANCH}" 2>/dev/null || echo "")
  fi

  if [[ "$INSTALLED_COMMIT" == "$REMOTE_COMMIT" && -n "$REMOTE_COMMIT" ]]; then
    _section "CoreOps já está atualizado"
    _ok "Versão : ${INSTALLED_VERSION}"
    _ok "Commit : ${INSTALLED_COMMIT:0:7}"
    _ok "Path   : ${REPO_DIR}"
    _verify_install
    [[ $MCP -eq 1 ]] && _write_mcp_config
    exit 0
  fi

  # Update disponível
  if [[ -n "$REMOTE_COMMIT" && -n "$INSTALLED_COMMIT" ]]; then
    _info "Update disponível: ${INSTALLED_COMMIT:0:7} → ${REMOTE_COMMIT:0:7}"
  fi
  _update_install
  exit 0
}

main "$@"
