# Railway — Automação de Deploy

## Visão Geral

Scripts que automatizam 100% da configuração e deploy no Railway via CLI.
Zero cliques no dashboard — tudo reproduzível e versionado.

## Pré-requisitos

- Node.js v20+ instalado localmente
- Git Bash (Windows) ou bash nativo (Linux/macOS)
- Conta no [Railway](https://railway.app) com projeto criado
- Chaves das APIs externas em mãos

## Setup Inicial (uma vez por máquina)

```bash
# 1. Instalar CLI, autenticar e linkar o projeto
bash scripts/railway-setup.sh

# 2. Configurar variáveis de ambiente
bash scripts/railway-configure.sh

# 3. Verificar tabelas do banco
bash scripts/railway-check-db.sh

# 4. Deploy
railway up
```

## Configuração de Variáveis

### Usando o script automatizado

```bash
# Exporta as variáveis antes de rodar o script
export JWT_SECRET="seu_secret_aqui"
export API_FULL_TOKEN="seu_token_aqui"
export ASAAS_API_KEY="seu_asaas_key"
export RESEND_API_KEY="re_xxxxxxxxxxxx"
export CSRF_SECRET="$(openssl rand -hex 32)"
export SENTRY_DSN="https://xxx@yyy.ingest.sentry.io/zzz"
export VITE_SENTRY_DSN="https://xxx@yyy.ingest.sentry.io/zzz"

bash scripts/railway-configure.sh
```

Ou usando um arquivo `.env.production` (não commitado):

```bash
# Criar .env.production com as variáveis
cat > .env.production << 'EOF'
JWT_SECRET=seu_secret
API_FULL_TOKEN=seu_token
ASAAS_API_KEY=seu_key
RESEND_API_KEY=re_xxx
CSRF_SECRET=abc123hex
SENTRY_DSN=https://...
VITE_SENTRY_DSN=https://...
EOF

# O script carrega automaticamente se o arquivo existir
bash scripts/railway-configure.sh
```

### Configuração manual (uma variável por vez)

```bash
railway variables set JWT_SECRET=seu_secret
railway variables set API_FULL_TOKEN=seu_token
railway variables set ASAAS_API_KEY=seu_key
railway variables set RESEND_API_KEY=re_xxx
railway variables set CSRF_SECRET=$(openssl rand -hex 32)
```

## Referência de Variáveis

| Variável | Obrigatória | Descrição |
|---|---|---|
| `DATABASE_URL` | Railway injeta | Provisionado automaticamente pelo plugin MySQL |
| `NODE_ENV` | ✅ | Sempre `production` no Railway |
| `JWT_SECRET` | ✅ | Secret para assinar JWTs de sessão |
| `CSRF_SECRET` | ✅ | Secret CSRF — gerar com `openssl rand -hex 32` |
| `APP_URL` | ✅ | URL pública — `https://app.maxxianalise.com` |
| `API_FULL_TOKEN` | ✅ | Token API Full (bureaus de crédito) |
| `API_FULL_BASE_URL` | ✅ | `https://api.apifull.com.br` |
| `ASAAS_API_KEY` | ✅ | API Key Asaas (pagamentos) |
| `ASAAS_WEBHOOK_TOKEN` | ✅ | Token para validar webhooks Asaas |
| `RESEND_API_KEY` | ✅ | API Key Resend (emails) |
| `SENTRY_DSN` | ○ | DSN Sentry backend |
| `VITE_SENTRY_DSN` | ○ | DSN Sentry frontend |
| `STRIPE_SECRET_KEY` | ○ | Stripe (gateway alternativo) |
| `STRIPE_WEBHOOK_SECRET` | ○ | Validação de webhooks Stripe |
| `AWS_ACCESS_KEY_ID` | ○ | AWS S3 (upload de PDFs) |
| `AWS_SECRET_ACCESS_KEY` | ○ | AWS S3 secret |
| `AWS_REGION` | ○ | AWS S3 região (ex: `sa-east-1`) |

## Comandos Frequentes

```bash
# Ver todas as variáveis configuradas
railway variables

# Status do projeto
railway status

# Ver logs em tempo real
railway logs --tail 100

# Forçar redeploy
railway up

# Executar comando no ambiente Railway (com DATABASE_URL injetado)
railway run node -e "console.log(process.env.NODE_ENV)"

# Verificar banco de dados
bash scripts/railway-check-db.sh
```

## Makefile (atalhos)

Se tiver `make` instalado:

```bash
make help              # Ver todos os comandos
make railway-setup     # Instalar CLI + autenticar
make railway-configure # Configurar variáveis
make railway-check     # Verificar banco
make railway-deploy    # Redeploy
make railway-logs      # Logs em tempo real
make railway-vars      # Listar variáveis
make railway-status    # Status do projeto
make db-push           # Aplicar migrations
make test              # Rodar testes
make check             # Type check
```

## Banco de Dados

### Tabelas esperadas

| Tabela | Descrição |
|---|---|
| `users` | Usuários e autenticação |
| `plans` | Planos de assinatura |
| `credit_analyses` | Consultas de crédito realizadas |
| `transactions` | Histórico de débitos e recargas |
| `margem_consultations` | Consultas de margem consignável |

### Colunas críticas

```sql
-- users: saldo e role são essenciais
SELECT id, name, email, saldo, role FROM users LIMIT 5;

-- margem_consultations: matricula e cnpj adicionados em 0010
DESCRIBE margem_consultations;

-- transactions: tipo enum (recarga, consulta, estorno)
SELECT tipo, COUNT(*), SUM(valor) FROM transactions GROUP BY tipo;
```

### Aplicar migrations

```bash
# Gera SQL e aplica ao banco configurado em DATABASE_URL
pnpm run db:push

# Ou via Railway (aplica no banco de produção)
railway run pnpm run db:push
```

> **Nunca** crie tabelas manualmente com SQL. O schema está em
> `drizzle/schema.ts` e os nomes das colunas são **camelCase** (ex: `userId`,
> `nomeCompleto`). SQL manual com snake_case quebraria a aplicação.

## Verificação de Saúde

```bash
# Checar se a aplicação está respondendo
curl https://app.maxxianalise.com/api/trpc/system.health

# Checar variáveis ausentes
railway run node -e "
const required = ['DATABASE_URL','JWT_SECRET','API_FULL_TOKEN','ASAAS_API_KEY','RESEND_API_KEY','CSRF_SECRET'];
const missing = required.filter(k => !process.env[k]);
if (missing.length) { console.error('FALTANDO:', missing.join(', ')); process.exit(1); }
console.log('Todas as variáveis obrigatórias estão configuradas.');
"
```

## Windows — Execução dos Scripts

Os scripts `.sh` requerem bash. No Windows, use uma das opções:

```powershell
# Opção 1: Git Bash (recomendado)
"C:\Program Files\Git\bin\bash.exe" scripts/railway-setup.sh

# Opção 2: WSL
wsl bash scripts/railway-setup.sh

# Opção 3: Railway CLI direto (funciona no PowerShell)
railway variables
railway status
railway up
railway logs
```

## Troubleshooting

**`railway: command not found`**
```bash
npm install -g @railway/cli
# ou
pnpm add -g @railway/cli
```

**`railway status` falha — projeto não linkado**
```bash
railway link
# Seleciona o projeto na lista interativa
```

**Variável não está sendo usada no deploy**
```bash
# 1. Confirmar que foi salva
railway variables | grep NOME_DA_VAR

# 2. Forçar redeploy para aplicar
railway up
```

**Banco inacessível / migration não aplicada**
```bash
# Verificar DATABASE_URL disponível
railway variables get DATABASE_URL

# Aplicar migrations pendentes via Railway
railway run pnpm run db:push
```

**Deploy OK mas aplicação retorna 500**
```bash
# Ver logs de erro
railway logs --tail 200

# Checar variáveis obrigatórias
railway run node -e "console.log('NODE_ENV:', process.env.NODE_ENV)"
```
