# Makefile — Maxxi Analise Pro
# Uso: make <alvo>
# Windows: requer Git Bash ou WSL para alvos que usam .sh

.PHONY: help \
        railway-setup railway-configure railway-check \
        railway-deploy railway-logs railway-status railway-vars \
        dev build test lint check \
        db-push db-studio db-generate

# Detecta OS para compatibilidade
SHELL := /bin/bash
PNPM := pnpm

# ─── Help ─────────────────────────────────────────────────────────────────
help: ## Mostrar todos os comandos disponíveis
	@echo ""
	@echo "  Maxxi Analise Pro — Comandos"
	@echo "  ─────────────────────────────────────────────────────────────"
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) \
		| sort \
		| awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-22s\033[0m %s\n", $$1, $$2}'
	@echo ""

# ─── Railway ──────────────────────────────────────────────────────────────
railway-setup: ## Instalar Railway CLI e autenticar
	@bash scripts/railway-setup.sh

railway-configure: ## Configurar todas as variáveis de ambiente no Railway
	@bash scripts/railway-configure.sh

railway-check: ## Verificar tabelas do banco de dados
	@bash scripts/railway-check-db.sh

railway-deploy: ## Forçar redeploy no Railway
	@echo "🚀 Iniciando deploy..."
	@railway up
	@echo "✅ Deploy enviado! Acompanhe: make railway-logs"

railway-logs: ## Ver logs em tempo real
	@railway logs --tail 100

railway-status: ## Status do projeto Railway
	@railway status

railway-vars: ## Listar todas as variáveis de ambiente
	@railway variables

railway-vars-set: ## Definir variável: make railway-vars-set KEY=NOME VALUE=valor
	@railway variables set "$(KEY)=$(VALUE)"
	@echo "✅ $(KEY) configurado"

railway-run: ## Executar comando no ambiente Railway: make railway-run CMD="node -e 'console.log(1)'"
	@railway run $(CMD)

# ─── Desenvolvimento ──────────────────────────────────────────────────────
dev: ## Iniciar servidor de desenvolvimento (backend + frontend)
	@$(PNPM) run dev

dev-server: ## Iniciar apenas o backend (porta 3000)
	@$(PNPM) run dev:server 2>/dev/null || NODE_ENV=development npx tsx watch server/_core/index.ts

dev-client: ## Iniciar apenas o frontend (porta 5173)
	@$(PNPM) run dev:client 2>/dev/null || npx vite

# ─── Build ────────────────────────────────────────────────────────────────
build: ## Build completo (backend + frontend)
	@$(PNPM) run build

# ─── Qualidade ────────────────────────────────────────────────────────────
test: ## Rodar todos os testes
	@$(PNPM) run test

test-watch: ## Rodar testes em modo watch
	@$(PNPM) run test -- --watch

check: ## Verificar tipos TypeScript
	@$(PNPM) run check

lint: ## Rodar ESLint
	@$(PNPM) run lint 2>/dev/null || echo "ESLint não configurado"

# ─── Banco de dados ───────────────────────────────────────────────────────
db-push: ## Gerar e aplicar migrations (drizzle-kit generate + migrate)
	@$(PNPM) run db:push

db-studio: ## Abrir Drizzle Studio (GUI do banco)
	@$(PNPM) run db:studio

db-generate: ## Gerar SQL de migration sem aplicar
	@npx drizzle-kit generate

db-seed: ## Popular banco com dados de teste
	@$(PNPM) run db:seed 2>/dev/null || echo "Seed script não encontrado"
