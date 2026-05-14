#!/bin/bash
# railway-setup.sh — Instala Railway CLI, autentica e linka o projeto
set -e

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
CYAN='\033[0;36m'
NC='\033[0m'

info()    { echo -e "${CYAN}ℹ  $1${NC}"; }
success() { echo -e "${GREEN}✅ $1${NC}"; }
warn()    { echo -e "${YELLOW}⚠  $1${NC}"; }
error()   { echo -e "${RED}❌ $1${NC}"; }

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "   🚀 Railway Setup — Maxxi Analise Pro"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# ─── 1. Railway CLI ──────────────────────────────────────────────────────
info "Verificando Railway CLI..."
if ! command -v railway &> /dev/null; then
    warn "Railway CLI não encontrado. Instalando via npm..."
    npm install -g @railway/cli
    success "Railway CLI instalado!"
else
    RAILWAY_VERSION=$(railway --version 2>/dev/null || echo "desconhecida")
    success "Railway CLI já instalado (${RAILWAY_VERSION})"
fi

# ─── 2. Autenticação ─────────────────────────────────────────────────────
echo ""
info "Verificando autenticação..."
if ! railway whoami &> /dev/null 2>&1; then
    warn "Não autenticado. Abrindo login no navegador..."
    railway login
    success "Login realizado!"
else
    WHOAMI=$(railway whoami 2>/dev/null || echo "")
    success "Autenticado como: ${WHOAMI}"
fi

# ─── 3. Link ao projeto ──────────────────────────────────────────────────
echo ""
info "Verificando link ao projeto..."
if ! railway status &> /dev/null 2>&1; then
    warn "Projeto não linkado."
    echo ""
    echo "Projetos disponíveis:"
    railway list 2>/dev/null || true
    echo ""
    error "Execute o comando abaixo com o ID do seu projeto e rode este script novamente:"
    echo ""
    echo "  railway link"
    echo ""
    exit 1
else
    success "Projeto linkado com sucesso."
    echo ""
    railway status
fi

# ─── Conclusão ───────────────────────────────────────────────────────────
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
success "Setup concluído!"
echo ""
echo "Próximos passos:"
echo "  bash scripts/railway-configure.sh   # Configura variáveis de ambiente"
echo "  bash scripts/railway-check-db.sh    # Verifica tabelas do banco"
echo "  railway up                           # Redeploy"
echo ""
