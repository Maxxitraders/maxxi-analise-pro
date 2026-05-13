# 🏗️ Arquitetura - Maxxi Analise Pro

## 📋 Índice

- [Visão Geral](#visão-geral)
- [Arquitetura do Sistema](#arquitetura-do-sistema)
- [Backend](#backend)
- [Frontend](#frontend)
- [Database](#database)
- [Fluxos Principais](#fluxos-principais)
- [Segurança](#segurança)
- [Performance](#performance)
- [Monitoramento](#monitoramento)

---

## 🎯 Visão Geral

O **Maxxi Analise Pro** segue uma arquitetura **monorepo** com backend e frontend separados, comunicando-se via **tRPC** (type-safe API).

### Diagrama de Alto Nível:

```
┌──────────────┐      tRPC       ┌──────────────┐
│              │ ◄──────────────► │              │
│   Frontend   │                  │   Backend    │
│   (React)    │                  │   (Node.js)  │
│              │                  │              │
└──────────────┘                  └──────┬───────┘
                                         │
                                         │ Drizzle ORM
                                         ▼
                                  ┌──────────────┐
                                  │              │
                                  │    MySQL     │
                                  │   Database   │
                                  │              │
                                  └──────────────┘
                                         ▲
                                         │
                                  ┌──────┴───────┐
                                  │              │
                                  │  APIs        │
                                  │  Externas    │
                                  │              │
                                  └──────────────┘
```

---

## 🏛️ Arquitetura do Sistema

### Camadas:

1. **Presentation Layer** (Frontend)
   - React Components
   - TanStack Query (data fetching)
   - Tailwind CSS (styling)

2. **API Layer** (tRPC)
   - Type-safe routes
   - Input validation (Zod)
   - Error handling

3. **Business Logic Layer** (Backend)
   - Controllers
   - Services
   - Credit Engine

4. **Data Layer**
   - Drizzle ORM
   - MySQL Database
   - Atomic transactions

5. **Integration Layer**
   - Asaas API (payments)
   - Resend API (emails)
   - API Full (credit bureaus)

---

## ⚙️ Backend

### Estrutura:

```
server/
├── _core/
│   └── index.ts           # Express + tRPC setup
├── utils/
│   └── logger.ts          # Winston logger
├── sentry.ts              # Sentry config
├── routers.ts             # tRPC routers
├── creditEngine.ts        # Motor de análise
├── asaasWebhook.ts        # Webhook Asaas
├── db-atomic.ts           # Operações atômicas
└── db.ts                  # Drizzle config
```

### Tecnologias:

- **Express** - HTTP server
- **tRPC** - Type-safe API
- **Drizzle ORM** - Database queries
- **Zod** - Schema validation
- **Winston** - Structured logging
- **Sentry** - Error monitoring

### tRPC Routers:

```typescript
// server/routers.ts
export const appRouter = router({
  // Auth
  registerUser,
  loginUser,
  requestPasswordReset,
  resetPassword,
  
  // User Management
  updateProfile,
  getUserById,
  listUsers,
  
  // Credit Analysis
  consultarCreditoComPracao,
  listCreditAnalyses,
  
  // Transactions
  createAsaasPayment,
  listTransactions,
  
  // Plans
  getPlanBySlug,
  listPlans,
  
  // Admin
  addCreditsToUser,
  deleteUser,
});
```

### Credit Engine:

```typescript
// server/creditEngine.ts
export async function consultarCredito({
  cpfCnpj,
  bureau,
  userId
}: ConsultaCreditoInput) {
  // 1. Validate input
  validateCpfCnpj(cpfCnpj);
  
  // 2. Check user balance
  await checkUserBalance(userId);
  
  // 3. Call bureau API
  const response = await callBureauAPI(cpfCnpj, bureau);
  
  // 4. Save to database
  await saveCreditAnalysis(response, userId);
  
  // 5. Debit user balance
  await debitUserBalance(userId, bureauCost);
  
  return response;
}
```

### Middleware Stack:

```typescript
// server/_core/index.ts
app.use(helmet());           // Security headers
app.use(cors(corsOptions));  // CORS
app.use(express.json());     // Body parser
app.use(rateLimiter);        // Rate limiting
app.use(authMiddleware);     // Authentication
```

---

## 💻 Frontend

### Estrutura:

```
client/
├── src/
│   ├── components/
│   │   ├── ui/              # Componentes base (Button, Input)
│   │   ├── layout/          # Layout components (Header, Sidebar)
│   │   └── features/        # Feature components (CreditForm, Dashboard)
│   ├── pages/
│   │   ├── Login.tsx
│   │   ├── Dashboard.tsx
│   │   ├── ConsultaCredito.tsx
│   │   └── Admin.tsx
│   ├── lib/
│   │   ├── trpc.ts          # tRPC client
│   │   ├── sentry.ts        # Sentry config
│   │   └── utils.ts         # Utilities
│   └── main.tsx             # Entry point
```

### State Management:

```typescript
// TanStack Query (React Query)
const { data, isLoading } = trpc.getUserById.useQuery({ id: 123 });

const mutation = trpc.consultarCredito.useMutation({
  onSuccess: (data) => {
    toast.success('Consulta realizada!');
  },
  onError: (error) => {
    toast.error(error.message);
  }
});
```

### Routing:

```typescript
// React Router
<Routes>
  <Route path="/" element={<Home />} />
  <Route path="/login" element={<Login />} />
  <Route path="/dashboard" element={<Dashboard />} />
  <Route path="/consulta" element={<ConsultaCredito />} />
  <Route path="/admin" element={<Admin />} />
</Routes>
```

---

## 🗄️ Database

### Schema (Drizzle):

```typescript
// shared/schema.ts
export const users = mysqlTable('users', {
  id: serial('id').primaryKey(),
  email: varchar('email', { length: 255 }).unique().notNull(),
  passwordHash: varchar('password_hash', { length: 255 }).notNull(),
  name: varchar('name', { length: 255 }),
  role: mysqlEnum('role', ['user', 'admin']).default('user'),
  saldo: decimal('saldo', { precision: 10, scale: 2 }).default('0.00'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').onUpdateNow(),
});

export const creditAnalyses = mysqlTable('credit_analyses', {
  id: serial('id').primaryKey(),
  userId: int('user_id').references(() => users.id),
  cpfCnpj: varchar('cpf_cnpj', { length: 20 }).notNull(),
  bureau: mysqlEnum('bureau', ['boavista', 'serasa_premium', 'spc']),
  status: mysqlEnum('status', ['pending', 'completed', 'failed']),
  result: json('result'),
  createdAt: timestamp('created_at').defaultNow(),
}, (table) => ({
  userIdIdx: index('idx_user_id').on(table.userId),
  statusIdx: index('idx_status').on(table.status),
  createdAtIdx: index('idx_created_at').on(table.createdAt),
}));

export const transactions = mysqlTable('transactions', {
  id: serial('id').primaryKey(),
  userId: int('user_id').references(() => users.id),
  type: mysqlEnum('type', ['credit', 'debit']).notNull(),
  amount: decimal('amount', { precision: 10, scale: 2 }).notNull(),
  description: text('description'),
  asaasPaymentId: varchar('asaas_payment_id', { length: 255 }),
  status: mysqlEnum('status', ['pending', 'completed', 'failed']),
  createdAt: timestamp('created_at').defaultNow(),
}, (table) => ({
  userIdIdx: index('idx_user_id').on(table.userId),
  typeIdx: index('idx_type').on(table.type),
  statusIdx: index('idx_status').on(table.status),
}));
```

### Migrations:

```sql
-- drizzle/0008_add_performance_indexes.sql
CREATE INDEX idx_credit_analyses_user_id ON credit_analyses(user_id);
CREATE INDEX idx_credit_analyses_status ON credit_analyses(status);
CREATE INDEX idx_credit_analyses_created_at ON credit_analyses(created_at);
CREATE INDEX idx_credit_analyses_bureau ON credit_analyses(bureau);
CREATE INDEX idx_credit_analyses_user_status ON credit_analyses(user_id, status);

CREATE INDEX idx_transactions_user_id ON transactions(user_id);
CREATE INDEX idx_transactions_type ON transactions(type);
CREATE INDEX idx_transactions_status ON transactions(status);
CREATE INDEX idx_transactions_created_at ON transactions(created_at);
CREATE INDEX idx_transactions_user_created ON transactions(user_id, created_at);

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_users_last_signed_in ON users(last_signed_in);
```

---

## 🔄 Fluxos Principais

### 1. Fluxo de Compra de Créditos:

```
User                Frontend              Backend              Asaas
 │                     │                      │                   │
 ├─── Clica "Comprar" ─►                      │                   │
 │                     ├─── createPayment ───►│                   │
 │                     │                      ├─── POST /payments ►│
 │                     │                      │◄─── payment_id ───┤
 │                     │◄─── payment_url ────┤                   │
 │◄─── Redirect ───────┤                      │                   │
 │                     │                      │                   │
 ├─── Paga (PIX) ──────────────────────────────────────────────►│
 │                     │                      │                   │
 │                     │                      │◄─── Webhook ──────┤
 │                     │                      │  (PAYMENT_CONFIRMED)
 │                     │                      │                   │
 │                     │                      ├─── creditSaldo() ─┤
 │                     │                      ├─── sendEmail() ───┤
 │                     │                      │                   │
 │◄─── Email confirmação ────────────────────┤                   │
 │                     │                      │                   │
```

### 2. Fluxo de Consulta de Crédito:

```
User                Frontend              Backend            API Full
 │                     │                      │                   │
 ├─── Preenche CPF ───►│                      │                   │
 ├─── Seleciona bureau ►│                     │                   │
 ├─── Clica "Consultar"►                      │                   │
 │                     ├─── consultarCredito ►│                   │
 │                     │                      ├─── checkBalance() │
 │                     │                      ├─── POST /credito ►│
 │                     │                      │◄─── credit_data ──┤
 │                     │                      │                   │
 │                     │                      ├─── saveAnalysis() │
 │                     │                      ├─── debitBalance() │
 │                     │                      │                   │
 │                     │◄─── credit_result ──┤                   │
 │◄─── Mostra resultado┤                      │                   │
 │                     │                      │                   │
```

### 3. Fluxo de Autenticação:

```
User                Frontend              Backend
 │                     │                      │
 ├─── Email/Senha ────►│                      │
 │                     ├─── loginUser ───────►│
 │                     │                      ├─── findUser()
 │                     │                      ├─── verifyPassword()
 │                     │                      ├─── generateJWT()
 │                     │                      │
 │                     │◄─── { token, user } ┤
 │◄─── Redirect home ─┤                      │
 │                     │  (token in localStorage)
 │                     │                      │
```

---

## 🔐 Segurança

### Camadas de Segurança:

1. **Authentication:**
   - JWT tokens
   - bcrypt password hashing
   - Session management

2. **Authorization:**
   - Role-based access (user/admin)
   - Route protection
   - Resource ownership check

3. **Input Validation:**
   - Zod schemas
   - CPF/CNPJ validation
   - SQL injection protection (ORM)

4. **Network Security:**
   - CORS configured
   - Helmet headers
   - Rate limiting
   - HTTPS only (production)

5. **Data Security:**
   - Sensitive data filtering (Sentry)
   - Password never logged
   - API keys in env vars

### CORS Configuration:

```typescript
// server/_core/index.ts
const corsOptions = {
  origin: (origin, callback) => {
    const allowedOrigins = [
      'https://app.maxxianalise.com',
      'https://maxxi-analise-pro-production.up.railway.app',
      ...(NODE_ENV === 'development' ? [
        'http://localhost:5173',
        'http://localhost:3000',
      ] : [])
    ];
    
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
};
```

---

## ⚡ Performance

### Otimizações Backend:

1. **Database Indexes:**
   - 13 índices estratégicos
   - Queries 50-70% mais rápidas
   - Composite indexes para queries frequentes

2. **Connection Pooling:**
   - Pool size: 10 connections
   - Timeout: 30s
   - Reuse connections

3. **Caching (Futuro):**
   - Redis para queries frequentes
   - TTL: 5 minutos
   - Invalidação automática

### Otimizações Frontend:

1. **Code Splitting:**
   - Lazy loading de rotas
   - Dynamic imports
   - Chunk optimization

2. **Bundle Size:**
   - Tree shaking
   - Minification
   - Gzip compression

3. **Data Fetching:**
   - React Query caching
   - Stale-while-revalidate
   - Prefetching

---

## 📊 Monitoramento

### Logs (Winston):

```typescript
// server/utils/logger.ts
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({ 
      filename: 'logs/error.log', 
      level: 'error',
      maxsize: 5242880, // 5MB
      maxFiles: 5,
    }),
    new winston.transports.File({ 
      filename: 'logs/combined.log',
      maxsize: 5242880,
      maxFiles: 5,
    }),
    new winston.transports.Console({
      format: winston.format.colorize(),
    }),
  ],
});
```

### Sentry:

```typescript
// server/sentry.ts
Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV,
  tracesSampleRate: 0.1,
  integrations: [
    Sentry.expressIntegration({ app }),
  ],
  beforeSend(event) {
    // Filter sensitive data
    if (event.request) {
      delete event.request.cookies;
      // Filter password, cpf, token, etc.
    }
    return event;
  },
});
```

---

## 🚀 Escalabilidade

### Horizontal Scaling:

- **Stateless backend** (JWT auth)
- **Load balancer** ready
- **Database replication** (futuro)

### Vertical Scaling:

- **Railway Pro Plan**
- **Database optimization**
- **Connection pooling**

### Capacity Planning:

```
Current:
- 1 Railway instance
- 1 MySQL instance
- ~100 req/min capacity

Future (Scale to 1000+ users):
- 3+ Railway instances (load balanced)
- MySQL read replicas
- Redis caching layer
- CDN for static assets
```

---

## 📚 Referências

- [tRPC Docs](https://trpc.io)
- [Drizzle ORM Docs](https://orm.drizzle.team)
- [React Query Docs](https://tanstack.com/query)
- [Winston Docs](https://github.com/winstonjs/winston)
- [Sentry Docs](https://docs.sentry.io)

---

**Última atualização:** 13 de Maio de 2026
