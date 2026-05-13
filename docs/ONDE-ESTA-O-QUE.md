# 🗺️ ONDE ESTÁ O QUÊ? - Guia de Navegação Rápida

> **Guia para encontrar qualquer coisa no projeto rapidamente**

---

## 🎯 Preciso Fazer Uma Modificação Em...

### 💳 Sistema de Pagamentos / Créditos

**Webhook do Asaas (quando usuário paga):**
```
📂 server/asaasWebhook.ts
```

**Creditar saldo do usuário:**
```
📂 server/db-atomic.ts
   └─ função: creditSaldoAtomic()
```

**Verificar saldo antes de consulta:**
```
📂 server/routers.ts
   └─ função: checkBalance()
```

**Criar pagamento:**
```
📂 server/routers.ts
   └─ rota: createAsaasPayment
```

---

### 🔍 Análise de Crédito

**Motor de consulta (lógica principal):**
```
📂 server/creditEngine.ts
   └─ função: consultarCredito()
```

**Testes do motor:**
```
📂 server/creditEngine.test.ts
```

**Rota tRPC de consulta:**
```
📂 server/routers.ts
   └─ rota: consultarCreditoComPracao
```

**Interface de consulta (tela):**
```
📂 client/src/pages/ConsultaCredito.tsx
```

---

### 👤 Autenticação / Usuários

**Login:**
```
📂 server/routers.ts
   └─ rota: loginUser
   
📂 client/src/pages/Login.tsx
```

**Registro:**
```
📂 server/routers.ts
   └─ rota: registerUser
```

**Reset de senha:**
```
📂 server/routers.ts
   └─ rotas: requestPasswordReset, resetPassword
```

**Verificar se usuário está logado:**
```
📂 server/middleware/auth.ts
   └─ ou dentro de: server/routers.ts
```

---

### 📧 Emails

**Configuração do Resend:**
```
📂 server/email.ts (ou similar)
   └─ ou procure "resend" no código
```

**Enviar email de confirmação:**
```
📂 server/asaasWebhook.ts
   └─ função: sendPaymentConfirmationEmail()
```

**Templates de email:**
```
📂 server/email-templates/ (se existir)
   └─ ou inline no código de email
```

---

### 🗄️ Banco de Dados

**Schema (definição de tabelas):**
```
📂 shared/schema.ts
```

**Conexão com banco:**
```
📂 server/db.ts
```

**Migrations:**
```
📂 drizzle/*.sql
```

**Última migration (índices):**
```
📂 drizzle/0008_add_performance_indexes.sql
```

**Rodar migrations:**
```bash
npm run db:push
```

**Drizzle Studio (GUI):**
```bash
npm run db:studio
```

---

### ⚙️ Configurações

**Variáveis de ambiente (template):**
```
📂 .env.example
```

**Variáveis de ambiente (suas):**
```
📂 .env (NÃO COMMITADO)
```

**CORS:**
```
📂 server/_core/index.ts
   └─ const corsOptions = { ... }
```

**Sentry (backend):**
```
📂 server/sentry.ts
```

**Sentry (frontend):**
```
📂 client/src/lib/sentry.ts
```

---

### 📝 Logs

**Configuração do Winston:**
```
📂 server/utils/logger.ts
```

**Usar logger no código:**
```typescript
import { logger } from './utils/logger';
logger.info('Mensagem');
logger.error('Erro', { context });
```

**Logs salvos em:**
```
📂 logs/error.log
📂 logs/combined.log
```

---

### 🧪 Testes

**Testes do creditEngine:**
```
📂 server/creditEngine.test.ts
```

**Rodar todos os testes:**
```bash
npm run test
```

**Rodar teste específico:**
```bash
npm run test creditEngine
```

**Coverage:**
```bash
npm run test:coverage
```

---

### 🎨 Interface / Frontend

**Página inicial:**
```
📂 client/src/pages/Home.tsx
```

**Dashboard:**
```
📂 client/src/pages/Dashboard.tsx
```

**Consulta de crédito (tela):**
```
📂 client/src/pages/ConsultaCredito.tsx
```

**Admin (gerenciar usuários):**
```
📂 client/src/pages/Admin.tsx
```

**Componentes reutilizáveis:**
```
📂 client/src/components/ui/
   ├─ Button.tsx
   ├─ Input.tsx
   └─ ... etc
```

**Layout (Header, Sidebar):**
```
📂 client/src/components/layout/
```

---

### 🔗 API (tRPC)

**Todos os endpoints tRPC:**
```
📂 server/routers.ts
   └─ export const appRouter = router({ ... })
```

**Cliente tRPC (frontend):**
```
📂 client/src/lib/trpc.ts
```

**Usar tRPC no frontend:**
```typescript
import { trpc } from '@/lib/trpc';

const { data } = trpc.getUserById.useQuery({ id: 123 });
const mutation = trpc.consultarCredito.useMutation();
```

---

### 🚀 Deploy

**Configuração do Railway:**
```
📂 railway.json (se existir)
   └─ ou direto no Railway Dashboard
```

**Build script:**
```
📂 package.json
   └─ "build": "..."
```

**Start script (produção):**
```
📂 package.json
   └─ "start": "..."
```

---

### 📚 Documentação

**README principal:**
```
📂 README.md
```

**Arquitetura detalhada:**
```
📂 docs/ARCHITECTURE.md
```

**Auditoria mais recente:**
```
📂 maxxi-analise-pro-auditoria-atualizada-2026-05-13.md
```

**Este arquivo (Onde está o quê):**
```
📂 docs/ONDE-ESTA-O-QUE.md
```

---

## 🔧 Comandos Úteis Rápidos

### Desenvolvimento:
```bash
npm run dev            # Inicia tudo (backend + frontend)
npm run dev:server     # Só backend (porta 3000)
npm run dev:client     # Só frontend (porta 5173)
```

### Database:
```bash
npm run db:push        # Aplica schema
npm run db:studio      # Abre GUI
npm run db:generate    # Gera migration
```

### Testes:
```bash
npm run test           # Todos
npm run test:watch     # Watch mode
npm run test:coverage  # Com coverage
```

### Build & Deploy:
```bash
npm run build          # Build completo
npm start              # Inicia produção
git push origin main   # Deploy automático
```

---

## 🐛 Bugs? Onde Procurar

### Usuário não consegue usar créditos:

1. **Verificar webhook:**
   ```
   📂 server/asaasWebhook.ts
   ```

2. **Verificar creditSaldoAtomic:**
   ```
   📂 server/db-atomic.ts
   ```

3. **Verificar checkBalance:**
   ```
   📂 server/routers.ts
   ```

### Consulta de crédito não funciona:

1. **Verificar creditEngine:**
   ```
   📂 server/creditEngine.ts
   ```

2. **Ver logs de erro:**
   ```
   📂 logs/error.log
   ```

3. **Ver Sentry:**
   ```
   https://sentry.io
   ```

### Frontend quebrado:

1. **Ver console do navegador** (F12)

2. **Ver Sentry (frontend):**
   ```
   https://sentry.io (projeto React)
   ```

3. **Verificar build:**
   ```bash
   npm run build:client
   ```

---

## 📦 Pacotes Importantes

### Backend:
```json
{
  "express": "HTTP server",
  "@trpc/server": "API type-safe",
  "drizzle-orm": "Database ORM",
  "mysql2": "MySQL driver",
  "winston": "Logging",
  "@sentry/node": "Error monitoring",
  "bcryptjs": "Password hashing",
  "jsonwebtoken": "JWT auth"
}
```

### Frontend:
```json
{
  "react": "UI library",
  "@tanstack/react-query": "Data fetching",
  "@trpc/client": "tRPC client",
  "tailwindcss": "Styling",
  "@sentry/react": "Error monitoring"
}
```

---

## 🆘 Problemas Comuns

### "Cannot find module X"
```bash
# Reinstalar dependências
npm install
```

### "Database connection failed"
```bash
# Verificar .env
cat .env | grep DATABASE_URL

# Testar conexão
npm run db:studio
```

### "Port already in use"
```bash
# Matar processo na porta 3000
npx kill-port 3000

# Ou porta 5173
npx kill-port 5173
```

### "Tests failing"
```bash
# Verificar .env de teste
# Rodar testes individualmente
npm run test creditEngine
```

---

## 📞 Ajuda

**Algo não está aqui?**

1. Procure no código: `Ctrl+Shift+F` (VS Code)
2. Veja o README.md
3. Veja ARCHITECTURE.md
4. Contate o time: suporte@maxxitecnologia.com.br

---

**Última atualização:** 13 de Maio de 2026

**Dica:** Adicione este arquivo aos favoritos do seu editor! 🌟
