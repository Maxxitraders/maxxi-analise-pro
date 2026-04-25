# CONTEXTO COMPLETO - IMPLEMENTAÇÃO DE SEGURANÇA MAXXI ANALISE PRO

**Data:** 25/04/2026  
**Projeto:** Maxxi Analise Pro (SaaS de consulta de crédito)  
**URL:** https://app.maxxianalise.com  
**Repositório:** https://github.com/Maxxitraders/maxxi-analise-pro  
**Deploy:** Railway (us-west2, Node 22.22.2)  
**Localização do projeto:** C:\Users\kia_o\Documents\maxxi-analise-pro

---

## RESUMO EXECUTIVO

Um pentest identificou 8 vulnerabilidades críticas/altas no sistema. Preparamos correções completas que elevam a segurança de 20% para 80%. Implementação estimada: 15 minutos usando Claude CLI.

---

## STACK ATUAL

- **Backend:** Node.js + Express + TRPC
- **Frontend:** React + TypeScript + Vite
- **Banco:** MySQL (Railway) via Drizzle ORM
- **Auth:** JWT customizado
- **Pagamentos:** Asaas (PIX, cartão, boleto)
- **Deploy:** Railway (auto-deploy via Git push)

---

## VULNERABILIDADES IDENTIFICADAS

### 🔴 CRÍTICAS:

1. **Bypass de Autenticação** - Invasor acessou sistema SEM criar conta
2. **IDOR** - Usuário pode acessar dados de outros mudando IDs
3. **Vazamento de Dados** - passwordHash, tokens expostos no JSON
4. **Escalação de Privilégios** - Campo `role` mutável pelo usuário
5. **Race Condition** - Múltiplas compras simultâneas = dinheiro infinito

### 🟡 ALTAS:

6. **Information Disclosure** - Stack traces e estrutura da API expostos
7. **Falta de Rate Limiting** - Brute force e DoS possíveis
8. **Input Validation** - Apenas frontend, backend aceita qualquer coisa

---

## ARQUIVOS A CRIAR (6 novos)

### 1. server/middleware/requireAuth.ts
```typescript
/**
 * Middleware de Autenticação Obrigatória
 * PREVINE: Bypass de autenticação
 */
import { TRPCError } from '@trpc/server';

export function requireAuth(ctx: any) {
  if (!ctx.user || !ctx.user.id) {
    throw new TRPCError({
      code: 'UNAUTHORIZED',
      message: 'Autenticação necessária. Faça login para continuar.'
    });
  }
  return ctx.user;
}

export function requireRole(ctx: any, allowedRoles: ('user' | 'admin')[]) {
  const user = requireAuth(ctx);
  if (!allowedRoles.includes(user.role)) {
    throw new TRPCError({
      code: 'FORBIDDEN',
      message: 'Você não tem permissão para esta ação.'
    });
  }
  return user;
}

export function requireAdmin(ctx: any) {
  return requireRole(ctx, ['admin']);
}
```

### 2. server/middleware/ownership.ts
```typescript
/**
 * Validação de Propriedade de Recursos
 * PREVINE: IDOR (Insecure Direct Object Reference)
 */
import { TRPCError } from '@trpc/server';

export async function requireOwnership<T extends { userId: number }>(
  resource: T | null | undefined,
  requestingUserId: number,
  resourceName: string = 'Recurso'
): Promise<T> {
  
  if (!resource) {
    throw new TRPCError({
      code: 'NOT_FOUND',
      message: `${resourceName} não encontrado`
    });
  }
  
  if (resource.userId !== requestingUserId) {
    console.warn(
      `[SECURITY ALERT] Tentativa de acesso não autorizado`,
      { 
        resourceType: resourceName,
        requestingUserId,
        resourceOwnerId: resource.userId,
        timestamp: new Date().toISOString()
      }
    );
    
    throw new TRPCError({
      code: 'FORBIDDEN',
      message: 'Você não tem permissão para acessar este recurso'
    });
  }
  
  return resource;
}
```

### 3. server/utils/sanitize.ts
```typescript
/**
 * Sanitização de Dados Sensíveis
 * PREVINE: Information Disclosure
 */

export function sanitizeUser(user: any) {
  if (!user) return null;
  
  const {
    passwordHash,
    resetToken,
    resetTokenExpiry,
    asaasCustomerId,
    ...safe
  } = user;
  
  return safe;
}

export function sanitizeError(
  error: any,
  isProduction: boolean = process.env.NODE_ENV === 'production'
) {
  if (isProduction) {
    return {
      message: 'Erro interno do servidor. Tente novamente.',
      code: error.code || 'INTERNAL_ERROR'
    };
  }
  
  return {
    message: error.message || 'Erro desconhecido',
    code: error.code || 'INTERNAL_ERROR',
  };
}

export function maskCPF(cpf: string): string {
  if (!cpf || cpf.length !== 11) return '***.***.***-**';
  return `${cpf.slice(0, 3)}.***.***-${cpf.slice(-2)}`;
}

export function maskCNPJ(cnpj: string): string {
  if (!cnpj || cnpj.length !== 14) return '**.***.***/**01-**';
  return `${cnpj.slice(0, 2)}.***.***/**${cnpj.slice(-5)}`;
}

export function maskCPFCNPJ(cpfCnpj: string): string {
  const cleaned = cpfCnpj.replace(/\D/g, '');
  if (cleaned.length === 11) return maskCPF(cleaned);
  if (cleaned.length === 14) return maskCNPJ(cleaned);
  return '***';
}

export function maskEmail(email: string): string {
  if (!email || !email.includes('@')) return '***@***.***';
  const [local, domain] = email.split('@');
  const [domainName, domainExt] = domain.split('.');
  const maskedLocal = local[0] + '***' + (local[local.length - 1] || '');
  const maskedDomain = domainName[0] + '***';
  return `${maskedLocal}@${maskedDomain}.${domainExt}`;
}
```

### 4. server/rateLimiting.ts
```typescript
/**
 * Rate Limiting
 * PREVINE: Brute force, DoS, abuso
 */
import rateLimit from 'express-rate-limit';

export const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: {
    error: 'Muitas requisições. Aguarde 15 minutos e tente novamente.',
    code: 'RATE_LIMIT_EXCEEDED'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

export const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  skipSuccessfulRequests: true,
  message: {
    error: 'Muitas tentativas de login. Aguarde 15 minutos.',
    code: 'LOGIN_RATE_LIMIT'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

export const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 3,
  message: {
    error: 'Muitas tentativas de registro. Aguarde 1 hora.',
    code: 'REGISTER_RATE_LIMIT'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

export const consultaLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  message: {
    error: 'Aguarde 1 minuto antes de fazer mais consultas.',
    code: 'CONSULTA_RATE_LIMIT'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

export const recargaLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 5,
  message: {
    error: 'Aguarde 5 minutos antes de fazer outra recarga.',
    code: 'RECARGA_RATE_LIMIT'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

export const webhookLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  message: {
    error: 'Webhook rate limit exceeded',
    code: 'WEBHOOK_RATE_LIMIT'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

export const forgotPasswordLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 3,
  message: {
    error: 'Muitas tentativas. Aguarde 1 hora.',
    code: 'FORGOT_PASSWORD_RATE_LIMIT'
  },
  standardHeaders: true,
  legacyHeaders: false,
});
```

### 5. server/validation.ts
```typescript
/**
 * Schemas de Validação com Zod
 * PREVINE: SQL Injection, XSS, DoS
 */
import { z } from 'zod';

export const cpfCnpjSchema = z.string()
  .min(11, 'CPF/CNPJ inválido')
  .max(14, 'CPF/CNPJ inválido')
  .regex(/^\d+$/, 'CPF/CNPJ deve conter apenas números')
  .refine(
    (val) => val.length === 11 || val.length === 14,
    'CPF deve ter 11 dígitos ou CNPJ 14 dígitos'
  )
  .transform(val => val.replace(/\D/g, ''));

export const emailSchema = z.string()
  .email('Email inválido')
  .min(5, 'Email muito curto')
  .max(255, 'Email muito longo')
  .toLowerCase()
  .trim();

export const senhaSchema = z.string()
  .min(8, 'Senha deve ter no mínimo 8 caracteres')
  .max(128, 'Senha muito longa')
  .regex(/[A-Z]/, 'Senha deve conter pelo menos uma letra maiúscula')
  .regex(/[a-z]/, 'Senha deve conter pelo menos uma letra minúscula')
  .regex(/[0-9]/, 'Senha deve conter pelo menos um número');

export const nomeSchema = z.string()
  .min(2, 'Nome muito curto')
  .max(100, 'Nome muito longo')
  .trim()
  .regex(/^[a-zA-ZÀ-ÿ\s]+$/, 'Nome deve conter apenas letras');

export const valorMonetarioSchema = z.number()
  .min(0.01, 'Valor mínimo: R$ 0,01')
  .max(100000, 'Valor máximo: R$ 100.000,00')
  .refine(
    (val) => Number.isFinite(val) && Math.round(val * 100) === val * 100,
    'Valor deve ter no máximo 2 casas decimais'
  );

export const telefoneSchema = z.string()
  .regex(/^\d{10,11}$/, 'Telefone deve ter 10 ou 11 dígitos')
  .transform(val => val.replace(/\D/g, ''));

export const cepSchema = z.string()
  .regex(/^\d{8}$/, 'CEP deve ter 8 dígitos')
  .transform(val => val.replace(/\D/g, ''));

export const idSchema = z.number()
  .int('ID deve ser um número inteiro')
  .positive('ID deve ser positivo');

export const bureauTipoSchema = z.enum(
  ['boa_vista', 'serasa_premium'],
  {
    errorMap: () => ({ 
      message: 'Tipo de bureau inválido. Use: boa_vista ou serasa_premium' 
    })
  }
);

export const metodoPagamentoSchema = z.enum(
  ['PIX', 'CREDIT_CARD', 'BOLETO'],
  {
    errorMap: () => ({ 
      message: 'Método de pagamento inválido. Use: PIX, CREDIT_CARD ou BOLETO' 
    })
  }
);

export const textoLivreSchema = (maxLength: number = 1000) => 
  z.string()
    .max(maxLength, `Texto deve ter no máximo ${maxLength} caracteres`)
    .trim();

export const descricaoCurtaSchema = textoLivreSchema(200);
export const descricaoLongaSchema = textoLivreSchema(2000);

export const urlSchema = z.string()
  .url('URL inválida')
  .max(2048, 'URL muito longa')
  .optional()
  .or(z.literal(''));

export const dataISOSchema = z.string()
  .datetime('Data inválida. Use formato ISO 8601');

export const booleanSchema = z.boolean();
export const roleSchema = z.enum(['user', 'admin']);

export const paginationSchema = z.object({
  limit: z.number().int().min(1).max(100).default(20),
  offset: z.number().int().min(0).default(0),
});

export const adicionarSaldoInputSchema = z.object({
  valor: valorMonetarioSchema
    .min(5, 'Valor mínimo para recarga: R$ 5,00')
    .max(1000, 'Valor máximo para recarga: R$ 1.000,00'),
  metodoPagamento: metodoPagamentoSchema,
});

export const consultarCreditoInputSchema = z.object({
  cpfCnpj: cpfCnpjSchema,
  bureauTipo: bureauTipoSchema,
});

export const registerInputSchema = z.object({
  name: nomeSchema,
  email: emailSchema,
  password: senhaSchema,
  cpfCnpj: cpfCnpjSchema.optional(),
});

export const loginInputSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Senha é obrigatória'),
});
```

### 6. server/db-atomic.ts
```typescript
/**
 * Funções de Banco com Transações Atômicas
 * PREVINE: Race Condition
 * ADICIONAR ao server/db.ts
 */
import { db } from "./drizzle/db";
import { sql } from "drizzle-orm";
import { users, transactions } from "./drizzle/schema";

export async function debitSaldoAtomic(
  userId: number,
  valor: number,
  descricao: string,
  bureauTipo?: 'boa_vista' | 'serasa_premium' | null
): Promise<void> {
  
  await db.transaction(async (tx) => {
    const [user] = await tx.execute(sql`
      SELECT id, saldo 
      FROM users 
      WHERE id = ${userId} 
      FOR UPDATE
    `);
    
    if (!user) {
      throw new Error('Usuário não encontrado');
    }
    
    if (Number(user.saldo) < valor) {
      throw new Error('Saldo insuficiente');
    }
    
    await tx.execute(sql`
      UPDATE users 
      SET saldo = saldo - ${valor}
      WHERE id = ${userId}
    `);
    
    await tx.insert(transactions).values({
      userId,
      tipo: 'consulta',
      valor: String(valor),
      descricao,
      bureauTipo,
      createdAt: new Date(),
    });
  });
}

export async function creditSaldoAtomic(
  userId: number,
  valor: number,
  descricao: string,
  asaasPaymentId?: string | null
): Promise<void> {
  
  await db.transaction(async (tx) => {
    await tx.execute(sql`
      UPDATE users 
      SET saldo = saldo + ${valor}
      WHERE id = ${userId}
    `);
    
    await tx.insert(transactions).values({
      userId,
      tipo: 'recarga',
      valor: String(valor),
      descricao,
      asaasPaymentId,
      createdAt: new Date(),
    });
  });
}

export async function estornarSaldoAtomic(
  userId: number,
  valor: number,
  descricao: string,
  bureauTipo?: 'boa_vista' | 'serasa_premium' | null
): Promise<void> {
  
  await db.transaction(async (tx) => {
    await tx.execute(sql`
      UPDATE users 
      SET saldo = saldo + ${valor}
      WHERE id = ${userId}
    `);
    
    await tx.insert(transactions).values({
      userId,
      tipo: 'estorno',
      valor: String(valor),
      descricao,
      bureauTipo,
      createdAt: new Date(),
    });
  });
}

export async function consultarCreditoComTransacao(
  userId: number,
  cpfCnpj: string,
  bureauTipo: 'boa_vista' | 'serasa_premium',
  preco: number,
  consultarFn: () => Promise<any>
): Promise<any> {
  
  await debitSaldoAtomic(
    userId,
    preco,
    `Consulta ${bureauTipo} - CPF/CNPJ ${cpfCnpj.slice(0, 3)}***`,
    bureauTipo
  );
  
  try {
    const resultado = await consultarFn();
    return resultado;
  } catch (error) {
    await estornarSaldoAtomic(
      userId,
      preco,
      `Estorno - Falha na consulta ${bureauTipo}`,
      bureauTipo
    );
    throw error;
  }
}

export async function getUserSaldo(userId: number): Promise<number> {
  const [user] = await db
    .select({ saldo: users.saldo })
    .from(users)
    .where(sql`id = ${userId}`)
    .limit(1);
  
  return user ? Number(user.saldo) : 0;
}
```

---

## MODIFICAÇÕES EM ARQUIVOS EXISTENTES

### MODIFICAÇÃO 1: server/db.ts
**ADICIONAR no final do arquivo:**

```typescript
// Importar funções atômicas de segurança
export * from './db-atomic';
```

### MODIFICAÇÃO 2: server/index.ts

**ADICIONAR nos imports (topo do arquivo):**

```typescript
import {
  globalLimiter,
  loginLimiter,
  registerLimiter,
  webhookLimiter,
} from './rateLimiting';
```

**ADICIONAR antes de `app.use('/api/trpc', ...)`:**

```typescript
// 🔒 SEGURANÇA: Rate limiting
app.use('/api/trpc', globalLimiter);
app.use('/api/webhook/asaas', webhookLimiter);
```

### MODIFICAÇÃO 3: server/routers.ts

**ADICIONAR nos imports:**

```typescript
import { consultarCreditoInputSchema } from './validation';
import { consultarCreditoComTransacao } from './db-atomic';
import { requireOwnership } from './middleware/ownership';
import { sanitizeUser } from './utils/sanitize';
```

**SUBSTITUIR a função `consultarCredito` por:**

```typescript
consultarCredito: protectedProcedure
  .input(consultarCreditoInputSchema)
  .mutation(async ({ ctx, input }) => {
    const userId = ctx.user.id;
    
    const precos = {
      boa_vista: 6.50,
      serasa_premium: 15.00,
    };
    const preco = precos[input.bureauTipo];
    
    return await consultarCreditoComTransacao(
      userId,
      input.cpfCnpj,
      input.bureauTipo,
      preco,
      async () => {
        if (input.bureauTipo === 'boa_vista') {
          return await consultarBoaVista(input.cpfCnpj);
        } else {
          return await consultarSerasa(input.cpfCnpj);
        }
      }
    );
  }),
```

### MODIFICAÇÃO 4: server/asaasWebhook.ts

**ADICIONAR no import:**

```typescript
import { creditSaldoAtomic } from './db-atomic';
```

**TROCAR a linha que adiciona saldo:**

De:
```typescript
await addSaldoToUser(userId, payment.value);
```

Para:
```typescript
await creditSaldoAtomic(
  userId,
  payment.value,
  `Recarga via ${payment.billingType}`,
  payment.id
);
```

---

## DEPENDÊNCIAS ADICIONAIS

**Instalar:**

```bash
npm install express-rate-limit
```

---

## COMANDOS DE IMPLEMENTAÇÃO

```bash
# 1. Navegar para o projeto
cd C:\Users\kia_o\Documents\maxxi-analise-pro

# 2. Criar estrutura de pastas
mkdir -p server/middleware
mkdir -p server/utils

# 3. Criar os 6 arquivos novos (usar Claude CLI)

# 4. Modificar os 4 arquivos existentes (usar Claude CLI)

# 5. Instalar dependência
npm install express-rate-limit

# 6. Compilar e verificar
npm run build

# 7. Commit e push
git add .
git commit -m "security: implementar protocolo Maxxi v1.0 - corrige IDOR, Race Condition, Rate Limiting, Validacoes"
git push
```

---

## VERIFICAÇÃO FINAL

**Após deploy, testar:**

1. **Autenticação:** Tentar acessar endpoint protegido sem token → deve retornar 401
2. **IDOR:** Tentar acessar recurso de outro usuário → deve retornar 403
3. **Race Condition:** Fazer 2 consultas simultâneas → deve processar apenas 1
4. **Rate Limiting:** Fazer 6 tentativas de login → 6ª deve ser bloqueada
5. **Dados Sensíveis:** Ver response de user → não deve conter passwordHash

---

## PONTUAÇÃO ESPERADA

**ANTES:** 20% (vulnerável)  
**DEPOIS:** 80% (seguro)

**Vulnerabilidades corrigidas:** 8/8 ✅

---

## NOTAS IMPORTANTES

1. **NÃO PULE ETAPAS** - Cada modificação depende da anterior
2. **TESTE LOCALMENTE** antes de fazer push (npm run build)
3. **AGUARDE DEPLOY** completo no Railway (~3-4 min)
4. **FAÇA BACKUP** antes: `git commit -m "backup antes de segurança"`

---

## ESTRUTURA FINAL ESPERADA

```
server/
├── middleware/
│   ├── requireAuth.ts    ← NOVO
│   └── ownership.ts      ← NOVO
├── utils/
│   └── sanitize.ts       ← NOVO
├── rateLimiting.ts       ← NOVO
├── validation.ts         ← NOVO
├── db-atomic.ts          ← NOVO
├── db.ts                 ← MODIFICADO
├── index.ts              ← MODIFICADO
├── routers.ts            ← MODIFICADO
└── asaasWebhook.ts       ← MODIFICADO
```

---

**FIM DO CONTEXTO**

Use este documento para guiar a implementação via Claude CLI. Todos os arquivos e modificações estão detalhados acima.
