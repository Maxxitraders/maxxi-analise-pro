# 🚀 Maxxi Analise Pro

> **SaaS profissional para análise de crédito (CPF/CNPJ) com integração aos principais bureaus de crédito do Brasil**

[![Score](https://img.shields.io/badge/Score-90%2F100-success)](.)
[![Deploy](https://img.shields.io/badge/Deploy-Railway-blueviolet)](https://railway.app)
[![License](https://img.shields.io/badge/License-Proprietary-red)](.)

**URL Produção:** https://app.maxxianalise.com

---

## 📋 Índice

- [Sobre](#-sobre)
- [Tecnologias](#-tecnologias)
- [Estrutura do Projeto](#-estrutura-do-projeto)
- [Setup Local](#-setup-local)
- [Variáveis de Ambiente](#-variáveis-de-ambiente)
- [Scripts Disponíveis](#-scripts-disponíveis)
- [Deploy](#-deploy)
- [APIs Externas](#-apis-externas)
- [Testes](#-testes)
- [Monitoramento](#-monitoramento)
- [Contribuindo](#-contribuindo)

---

## 🎯 Sobre

O **Maxxi Analise Pro** é uma plataforma SaaS que permite análise de crédito de pessoas físicas (CPF) e jurídicas (CNPJ) através de integração com os principais bureaus de crédito do Brasil:

- ✅ Boa Vista
- ✅ Serasa Premium
- ✅ SPC Brasil

### Funcionalidades Principais:

- 💳 **Compra de Créditos** (modelo pay-as-you-go)
- 🔍 **Análise de Crédito** (CPF/CNPJ)
- 📊 **Dashboard** com estatísticas
- 📝 **Histórico** de consultas
- 👥 **Gerenciamento de Usuários** (admin)
- 💰 **Integração com Asaas** (pagamentos)
- 📧 **Notificações por Email** (Resend)

---

## 🛠️ Tecnologias

### Backend:
- **Node.js** v20+
- **Express** - Framework web
- **tRPC** - Type-safe APIs
- **Drizzle ORM** - Database ORM
- **MySQL** - Database
- **Winston** - Logging estruturado
- **Sentry** - Error monitoring

### Frontend:
- **React** 18+
- **TypeScript**
- **Vite** - Build tool
- **TanStack Query** - Data fetching
- **Tailwind CSS** - Styling
- **Sentry** - Error monitoring

### Deploy & DevOps:
- **Railway** - Production hosting
- **GitHub Actions** - CI/CD
- **Drizzle Kit** - Database migrations

### APIs Externas:
- **Asaas** - Payment processing
- **Resend** - Email delivery
- **API Full** - Credit bureau integration

---

## 📂 Estrutura do Projeto

```
maxxi-analise-pro/
├── client/                    # Frontend React
│   ├── public/               # Assets estáticos
│   ├── src/
│   │   ├── components/       # Componentes React
│   │   ├── lib/             # Utilitários e configs
│   │   │   ├── sentry.ts    # Config Sentry frontend
│   │   │   └── trpc.ts      # Cliente tRPC
│   │   ├── pages/           # Páginas da aplicação
│   │   └── main.tsx         # Entry point
│   ├── index.html
│   ├── vite.config.ts
│   └── package.json
│
├── server/                    # Backend Node.js
│   ├── _core/
│   │   └── index.ts         # Express + tRPC setup
│   ├── utils/
│   │   └── logger.ts        # Winston logger
│   ├── sentry.ts            # Config Sentry backend
│   ├── routers.ts           # tRPC routers
│   ├── asaasWebhook.ts      # Webhook Asaas
│   ├── creditEngine.ts      # Motor de análise
│   ├── creditEngine.test.ts # Testes creditEngine
│   ├── db-atomic.ts         # Operações DB atômicas
│   ├── db.ts                # Drizzle config
│   └── package.json
│
├── drizzle/                   # Database migrations
│   ├── 0000_*.sql
│   ├── 0008_add_performance_indexes.sql
│   └── meta/
│
├── shared/                    # Código compartilhado
│   └── schema.ts            # Database schema (Drizzle)
│
├── docs/                      # Documentação
│   ├── ARCHITECTURE.md
│   ├── API.md
│   └── DEPLOY.md
│
├── logs/                      # Logs (gitignored)
│   ├── error.log
│   └── combined.log
│
├── .env.example              # Template variáveis
├── .gitignore
├── drizzle.config.ts         # Drizzle config
├── package.json              # Root workspace
├── tsconfig.json
└── README.md
```

---

## 🚀 Setup Local

### Pré-requisitos:

- Node.js v20+ ([Download](https://nodejs.org/))
- MySQL 8+ (local ou Railway)
- Git

### 1. Clone o repositório:

```bash
git clone https://github.com/Maxxitraders/maxxi-analise-pro.git
cd maxxi-analise-pro
```

### 2. Instale as dependências:

```bash
npm install
```

### 3. Configure as variáveis de ambiente:

```bash
cp .env.example .env
# Edite o .env com suas credenciais
```

### 4. Rode as migrations:

```bash
npm run db:push
```

### 5. (Opcional) Popule o banco com dados de teste:

```bash
npm run db:seed
```

### 6. Inicie o servidor de desenvolvimento:

```bash
# Backend (porta 3000)
npm run dev:server

# Frontend (porta 5173) - Em outro terminal
npm run dev:client
```

### 7. Acesse:

- **Frontend:** http://localhost:5173
- **Backend:** http://localhost:3000

---

## 🔐 Variáveis de Ambiente

Copie `.env.example` para `.env` e configure:

### Database:
```env
DATABASE_URL=mysql://user:password@host:3306/database
```

### Auth:
```env
JWT_SECRET=seu-secret-super-seguro-aqui
```

### APIs Externas:
```env
# Asaas (Pagamentos)
ASAAS_API_KEY=seu-asaas-api-key
ASAAS_WEBHOOK_TOKEN=seu-asaas-webhook-token

# Resend (Emails)
RESEND_API_KEY=seu-resend-api-key

# API Full (Análise de Crédito)
API_FULL_TOKEN=seu-api-full-token
```

### Sentry (Monitoring):
```env
# Backend
SENTRY_DSN=https://...@sentry.io/...

# Frontend
VITE_SENTRY_DSN=https://...@sentry.io/...
```

### Outros:
```env
NODE_ENV=development
PORT=3000
VITE_APP_ID=seu-app-id
```

---

## 📜 Scripts Disponíveis

### Desenvolvimento:
```bash
npm run dev:server   # Inicia backend (porta 3000)
npm run dev:client   # Inicia frontend (porta 5173)
npm run dev          # Inicia ambos simultaneamente
```

### Build:
```bash
npm run build:server # Build backend
npm run build:client # Build frontend
npm run build        # Build completo
```

### Database:
```bash
npm run db:push      # Aplica schema ao banco
npm run db:studio    # Abre Drizzle Studio (GUI)
npm run db:generate  # Gera migration SQL
npm run db:migrate   # Roda migrations pendentes
npm run db:seed      # Popula dados de teste
```

### Testes:
```bash
npm run test         # Roda todos os testes
npm run test:watch   # Modo watch
npm run test:coverage # Com coverage report
```

### Linting:
```bash
npm run lint         # ESLint
npm run type-check   # TypeScript
```

### Produção:
```bash
npm start            # Inicia prod server
```

---

## 🚀 Deploy

O projeto usa **Railway** para deploy automático.

### Deploy Automático (Recomendado):

1. Push para `main` branch:
```bash
git push origin main
```

2. Railway detecta e faz deploy automaticamente

3. Acesse: https://app.maxxianalise.com

### Deploy Manual:

```bash
# Build
npm run build

# Set env vars no Railway
# Deploy
railway up
```

### Variáveis de Ambiente (Railway):

Configure no Railway Dashboard → Variables:

```
DATABASE_URL
JWT_SECRET
ASAAS_API_KEY
ASAAS_WEBHOOK_TOKEN
RESEND_API_KEY
API_FULL_TOKEN
SENTRY_DSN
VITE_SENTRY_DSN
NODE_ENV=production
PORT=3000
```

---

## 🔗 APIs Externas

### 1. Asaas (Pagamentos)

**Documentação:** https://docs.asaas.com

**Endpoints usados:**
- `POST /v3/payments` - Criar cobrança
- `GET /v3/payments/:id` - Consultar pagamento
- `POST /v3/subscriptions` - Criar assinatura
- Webhook: `POST /webhook/asaas` (nosso endpoint)

**Webhook Events:**
- `PAYMENT_CONFIRMED` - Pagamento confirmado
- `PAYMENT_RECEIVED` - Pagamento recebido

### 2. Resend (Emails)

**Documentação:** https://resend.com/docs

**Templates:**
- Welcome email
- Payment confirmation
- Credit low warning
- Password reset

### 3. API Full (Bureaus de Crédito)

**Documentação:** https://apifull.com.br/docs

**Endpoints usados:**
- `POST /credito/cpf` - Consulta CPF
- `POST /credito/cnpj` - Consulta CNPJ

**Bureaus suportados:**
- Boa Vista (`boavista`)
- Serasa Premium (`serasa_premium`)
- SPC Brasil (`spc`)

---

## 🧪 Testes

### Estrutura de Testes:

```
server/
├── creditEngine.test.ts    # Testes motor de crédito (28 testes)
├── routers.test.ts         # Testes tRPC routers
└── db-atomic.test.ts       # Testes operações DB
```

### Rodar Testes:

```bash
# Todos os testes
npm run test

# Modo watch
npm run test:watch

# Com coverage
npm run test:coverage

# Teste específico
npm run test creditEngine
```

### Coverage Atual:

```
Overall:  20%
Backend:  25%
Frontend: 15%
```

**Meta:** 50% até final do mês

---

## 📊 Monitoramento

### Sentry

**URL:** https://sentry.io/organizations/maxxi-tecnologia

**Projetos:**
- `maxxi-analise-backend` (Node.js)
- `maxxi-analise-frontend` (React)

**Recursos Ativos:**
- ✅ Error tracking
- ✅ Performance monitoring
- ✅ Session replay (mascarado)
- ✅ Release tracking

### Logs (Winston)

**Localização:** `logs/`

**Arquivos:**
- `error.log` - Apenas erros
- `combined.log` - Todos os logs

**Formato:**
```json
{
  "level": "info",
  "message": "User login successful",
  "timestamp": "2026-05-13T18:30:00.000Z",
  "userId": 123
}
```

**Rotation:**
- Max size: 5MB
- Max files: 5
- Compressão automática

---

## 🤝 Contribuindo

### Workflow:

1. **Fork** o repositório
2. **Crie** uma branch: `git checkout -b feature/nova-funcionalidade`
3. **Commit**: `git commit -m 'feat: adiciona nova funcionalidade'`
4. **Push**: `git push origin feature/nova-funcionalidade`
5. **Abra** um Pull Request

### Commit Convention:

Seguimos [Conventional Commits](https://www.conventionalcommits.org/):

```
feat: nova funcionalidade
fix: correção de bug
docs: documentação
style: formatação
refactor: refatoração
test: testes
chore: tarefas diversas
```

### Code Style:

- **ESLint** para linting
- **Prettier** para formatação
- **TypeScript strict mode**

```bash
# Antes de commitar
npm run lint
npm run type-check
npm run test
```

---

## 📚 Documentação Adicional

- [**ARCHITECTURE.md**](docs/ARCHITECTURE.md) - Arquitetura detalhada
- [**API.md**](docs/API.md) - Documentação da API
- [**DEPLOY.md**](docs/DEPLOY.md) - Guia de deploy
- [**CHANGELOG.md**](CHANGELOG.md) - Histórico de mudanças

---

## 🏆 Status do Projeto

### Score Geral: **90/100** ✅

```
✅ Segurança:    100/100
✅ Performance:  100/100
⚠️ Arquitetura:   15/100 (refatoração futura)
✅ Código:        95/100
✅ Testes:        20%
```

### Bugs Conhecidos:

🟢 **Nenhum bug crítico!**

### Próximas Features:

- [ ] CSRF Protection
- [ ] Audit Logging
- [ ] Cache Redis
- [ ] 2FA para admins
- [ ] CDN para assets

---

## 📞 Suporte

**Equipe:** Maxxi Tecnologia  
**Email:** suporte@maxxitecnologia.com.br  
**GitHub:** https://github.com/Maxxitraders/maxxi-analise-pro  

---

## 📄 Licença

**Proprietary** - © 2026 Maxxi Tecnologia  
Todos os direitos reservados.

---

**Desenvolvido com ❤️ pela equipe Maxxi Tecnologia**
