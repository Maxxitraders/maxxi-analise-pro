#!/bin/bash
# railway-configure.sh — Configura todas as variáveis de ambiente no Railway
# Uso: bash scripts/railway-configure.sh
#      API_FULL_TOKEN=meu_token bash scripts/railway-configure.sh
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

# Contador de resultado
CONFIGURED=0
SKIPPED=0

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "   ⚙️  Railway Configure — Maxxi Analise Pro"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# ─── Pré-requisito: projeto linkado ─────────────────────────────────────
if ! railway status &> /dev/null 2>&1; then
    error "Projeto não linkado. Execute primeiro:"
    echo "  bash scripts/railway-setup.sh"
    exit 1
fi

# ─── Carregar .env.production se existir ─────────────────────────────────
if [ -f .env.production ]; then
    info "Carregando .env.production..."
    set -a; source .env.production; set +a
    success ".env.production carregado"
    echo ""
fi

# ─── Função auxiliar ─────────────────────────────────────────────────────
set_var() {
    local KEY="$1"
    local VALUE="$2"
    local DESCRIPTION="$3"
    local REQUIRED="${4:-false}"

    if [ -z "$VALUE" ]; then
        if [ "$REQUIRED" = "true" ]; then
            warn "OBRIGATÓRIO não configurado: ${KEY}"
            warn "  → ${DESCRIPTION}"
            warn "  → railway variables set ${KEY}=seu_valor"
        else
            echo "  ○ ${KEY} — pulado (vazio)"
        fi
        SKIPPED=$((SKIPPED + 1))
        return
    fi

    # Mascarar secrets nos logs (mostra só primeiros 4 chars)
    local DISPLAY_VALUE="${VALUE:0:4}***"
    case "$KEY" in
        NODE_ENV|APP_URL|API_FULL_BASE_URL|PORT)
            DISPLAY_VALUE="$VALUE"
            ;;
    esac

    railway variables set "${KEY}=${VALUE}" --quiet 2>/dev/null || \
    railway variables set "${KEY}=${VALUE}"

    success "${KEY}=${DISPLAY_VALUE}   # ${DESCRIPTION}"
    CONFIGURED=$((CONFIGURED + 1))
}

# ─── Variáveis obrigatórias ───────────────────────────────────────────────
echo "🔴 Variáveis obrigatórias"
echo "──────────────────────────────────────────────────────────────────"

set_var "NODE_ENV"    "production"                      "Ambiente de execução"        "true"
set_var "APP_URL"     "${APP_URL:-https://app.maxxianalise.com}" "URL pública da aplicação" "true"
set_var "JWT_SECRET"  "${JWT_SECRET}"                   "Secret para assinar JWTs"    "true"
set_var "CSRF_SECRET" "${CSRF_SECRET}"                  "Secret do CSRF (32 bytes hex)" "true"

# DATABASE_URL é provisionado automaticamente pelo Railway MySQL plugin
# (não definir manualmente — o Railway injeta via referência)
info "DATABASE_URL → provisionado automaticamente pelo Railway MySQL plugin"

echo ""

# ─── APIs externas ───────────────────────────────────────────────────────
echo "🟡 APIs e integrações"
echo "──────────────────────────────────────────────────────────────────"

set_var "API_FULL_TOKEN"    "${API_FULL_TOKEN}"    "Token da API Full (bureaus de crédito)" "true"
set_var "API_FULL_BASE_URL" "${API_FULL_BASE_URL:-https://api.apifull.com.br}" "URL base da API Full"

set_var "ASAAS_API_KEY"          "${ASAAS_API_KEY}"          "API Key da Asaas (pagamentos)"  "true"
set_var "ASAAS_WEBHOOK_TOKEN"    "${ASAAS_WEBHOOK_TOKEN}"    "Token de validação do webhook Asaas"

set_var "RESEND_API_KEY"  "${RESEND_API_KEY}"  "API Key do Resend (emails)"  "true"

echo ""

# ─── Sentry ───────────────────────────────────────────────────────────────
echo "🔵 Monitoramento (Sentry)"
echo "──────────────────────────────────────────────────────────────────"

set_var "SENTRY_DSN"      "${SENTRY_DSN}"      "DSN do projeto backend no Sentry"
set_var "VITE_SENTRY_DSN" "${VITE_SENTRY_DSN}" "DSN do projeto frontend no Sentry"

echo ""

# ─── Opcionais ───────────────────────────────────────────────────────────
echo "⚪ Variáveis opcionais"
echo "──────────────────────────────────────────────────────────────────"

set_var "STRIPE_SECRET_KEY"     "${STRIPE_SECRET_KEY}"     "Stripe — gateway de pagamento alternativo"
set_var "STRIPE_WEBHOOK_SECRET" "${STRIPE_WEBHOOK_SECRET}" "Stripe — validação de webhooks"
set_var "AWS_ACCESS_KEY_ID"     "${AWS_ACCESS_KEY_ID}"     "AWS S3 — upload de PDFs"
set_var "AWS_SECRET_ACCESS_KEY" "${AWS_SECRET_ACCESS_KEY}" "AWS S3 — secret"
set_var "AWS_REGION"            "${AWS_REGION}"            "AWS S3 — região (ex: sa-east-1)"
set_var "VITE_APP_ID"           "${VITE_APP_ID}"           "ID interno da aplicação"

echo ""

# ─── Resultado ────────────────────────────────────────────────────────────
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo -e "${GREEN}Configuradas: ${CONFIGURED}${NC}   ${YELLOW}Puladas: ${SKIPPED}${NC}"
echo ""
echo "Ver todas as variáveis:"
echo "  railway variables"
echo ""
echo "Forçar redeploy:"
echo "  railway up"
echo ""
