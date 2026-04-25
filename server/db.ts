import { eq, desc, and, gte, lte, count, sql, like, or } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { InsertUser, users, creditAnalyses, InsertCreditAnalysis, CreditAnalysis, transactions, InsertTransaction, Transaction } from "../drizzle/schema";
import { ENV } from './_core/env';

let _db: ReturnType<typeof drizzle> | null = null;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }
  try {
    const values: InsertUser = { openId: user.openId };
    const updateSet: Record<string, unknown> = {};
    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];
    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };
    textFields.forEach(assignNullable);
    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = 'admin';
      updateSet.role = 'admin';
    }
    if (!values.lastSignedIn) {
      values.lastSignedIn = new Date();
    }
    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }
    await db.insert(users).values(values).onDuplicateKeyUpdate({ set: updateSet });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

// ── Credit Analysis Helpers ──

export async function insertCreditAnalysis(data: InsertCreditAnalysis): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(creditAnalyses).values(data);
  return Number(result[0].insertId);
}

export async function getCreditAnalysisById(id: number): Promise<CreditAnalysis | undefined> {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(creditAnalyses).where(eq(creditAnalyses.id, id)).limit(1);
  return result[0];
}

export async function listCreditAnalyses(filters: {
  userId?: number;
  status?: string;
  dateFrom?: Date;
  dateTo?: Date;
  search?: string;
  limit?: number;
  offset?: number;
}): Promise<CreditAnalysis[]> {
  const db = await getDb();
  if (!db) return [];

  const conditions = [];
  if (filters.userId) conditions.push(eq(creditAnalyses.userId, filters.userId));
  if (filters.status) conditions.push(eq(creditAnalyses.status, filters.status as any));
  if (filters.dateFrom) conditions.push(gte(creditAnalyses.createdAt, filters.dateFrom));
  if (filters.dateTo) conditions.push(lte(creditAnalyses.createdAt, filters.dateTo));
  if (filters.search) {
    const searchTerm = `%${filters.search}%`;
    conditions.push(
      or(
        like(creditAnalyses.companyName, searchTerm),
        like(creditAnalyses.cnpj, searchTerm)
      )!
    );
  }

  const query = db
    .select()
    .from(creditAnalyses)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(creditAnalyses.createdAt))
    .limit(filters.limit ?? 50)
    .offset(filters.offset ?? 0);

  return query;
}

export async function getDashboardStats(userId?: number) {
  const db = await getDb();
  if (!db) return { total: 0, aprovados: 0, reprovados: 0, analise_manual: 0 };

  const userFilter = userId ? eq(creditAnalyses.userId, userId) : undefined;

  const [totalResult] = await db.select({ value: count() }).from(creditAnalyses).where(userFilter);
  const [aprovadosResult] = await db.select({ value: count() }).from(creditAnalyses).where(
    userFilter ? and(eq(creditAnalyses.status, "APROVADO"), userFilter) : eq(creditAnalyses.status, "APROVADO")
  );
  const [reprovadosResult] = await db.select({ value: count() }).from(creditAnalyses).where(
    userFilter ? and(eq(creditAnalyses.status, "REPROVADO"), userFilter) : eq(creditAnalyses.status, "REPROVADO")
  );
  const [analiseResult] = await db.select({ value: count() }).from(creditAnalyses).where(
    userFilter ? and(eq(creditAnalyses.status, "ANALISE_MANUAL"), userFilter) : eq(creditAnalyses.status, "ANALISE_MANUAL")
  );

  return {
    total: totalResult.value,
    aprovados: aprovadosResult.value,
    reprovados: reprovadosResult.value,
    analise_manual: analiseResult.value,
  };
}

export async function updateAnalysisPdfUrl(id: number, pdfUrl: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(creditAnalyses).set({ pdfUrl }).where(eq(creditAnalyses.id, id));
}

export async function markAlertSent(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(creditAnalyses).set({ alertSent: true }).where(eq(creditAnalyses.id, id));
}

// ── Subscription Helpers ──

export async function getUserById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.id, id)).limit(1);
  return result[0];
}

export async function incrementConsultasUsed(userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(users).set({
    consultasUsedThisMonth: sql`${users.consultasUsedThisMonth} + 1`,
  }).where(eq(users.id, userId));
}

export async function getAllSubscribers() {
  const db = await getDb();
  if (!db) return [];
  const result = await db.select().from(users)
    .where(sql`${users.planId} != 'none'`)
    .orderBy(desc(users.createdAt));
  return result;
}

export async function getAllUsers() {
  const db = await getDb();
  if (!db) return [];
  const result = await db.select().from(users).orderBy(desc(users.createdAt));
  return result;
}

export async function updateUserProfile(userId: number, params: { name?: string; email?: string }) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(users).set({
    ...(params.name !== undefined && { name: params.name }),
    ...(params.email !== undefined && { email: params.email }),
  }).where(eq(users.id, userId));
}

export async function getSubscriptionStats() {
  const db = await getDb();
  if (!db) return { totalSubscribers: 0, activeSubscribers: 0, totalRevenue: 0 };

  const [total] = await db.select({ value: count() }).from(users)
    .where(sql`${users.planId} != 'none'`);
  const [active] = await db.select({ value: count() }).from(users)
    .where(eq(users.subscriptionStatus, "active"));

  return {
    totalSubscribers: total.value,
    activeSubscribers: active.value,
  };
}

// ── Asaas Helpers ──

export async function updateUserAsaasCustomerId(userId: number, asaasCustomerId: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(users).set({ asaasCustomerId }).where(eq(users.id, userId));
}

export async function updateUserAsaasSubscription(userId: number, data: {
  asaasSubscriptionId?: string | null;
  planId?: string;
  subscriptionStatus?: string;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(users).set(data as any).where(eq(users.id, userId));
}

export async function getUserByAsaasCustomerId(asaasCustomerId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.asaasCustomerId, asaasCustomerId)).limit(1);
  return result[0];
}

export async function activateSubscription(userId: number, planSlug: string, asaasSubscriptionId: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(users).set({
    planId: planSlug,
    subscriptionStatus: "active",
    asaasSubscriptionId,
    consultasUsedThisMonth: 0,
    consultasResetAt: new Date(),
  }).where(eq(users.id, userId));
}

export async function deactivateSubscription(userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(users).set({
    planId: "none",
    subscriptionStatus: "none",
    asaasSubscriptionId: null,
  }).where(eq(users.id, userId));
}

// ── Admin: Gerenciar Créditos ──

export async function resetUserConsultas(userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(users).set({
    consultasUsedThisMonth: 0,
    consultasResetAt: new Date(),
  }).where(eq(users.id, userId));
}

export async function addBonusConsultas(userId: number, bonus: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  // Diminui o contador (consultas usadas), efetivamente dando créditos extras
  await db.update(users).set({
    consultasUsedThisMonth: sql`GREATEST(0, ${users.consultasUsedThisMonth} - ${bonus})`,
  }).where(eq(users.id, userId));
}

export async function setUserPlan(userId: number, planSlug: string, consultasLimit: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(users).set({
    planId: planSlug,
    subscriptionStatus: "active",
    consultasUsedThisMonth: 0,
    consultasResetAt: new Date(),
  }).where(eq(users.id, userId));
}

// ── Admin: Delete User ──

export async function deleteUser(userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  // Primeiro deletar as análises de crédito do usuário
  await db.delete(creditAnalyses).where(eq(creditAnalyses.userId, userId));

  // Depois deletar o usuário
  await db.delete(users).where(eq(users.id, userId));
}

// ── Admin: Delete Simulated Records ──

export async function deleteSimulatedAnalyses(): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.delete(creditAnalyses).where(
    eq(creditAnalyses.creditDataSource, "simulado")
  );
  return Number((result[0] as any).affectedRows ?? 0);
}

// ── Wallet / Saldo Functions ──

export async function getUserSaldo(userId: number): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const user = await db.select({ saldo: users.saldo }).from(users).where(eq(users.id, userId)).limit(1);
  if (!user || user.length === 0) throw new Error("User not found");
  
  return parseFloat(String(user[0].saldo || "0"));
}

export async function addSaldoToUser(userId: number, valor: number): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.update(users)
    .set({ saldo: sql`saldo + ${valor}` })
    .where(eq(users.id, userId));
}

export async function debitSaldoFromUser(userId: number, valor: number): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.update(users)
    .set({ saldo: sql`saldo - ${valor}` })
    .where(eq(users.id, userId));
}

export async function insertTransaction(transaction: InsertTransaction): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const result = await db.insert(transactions).values(transaction);
  return Number((result[0] as any).insertId);
}

export async function listTransactions(userId: number, limit: number = 20, offset: number = 0): Promise<Transaction[]> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  return await db.select()
    .from(transactions)
    .where(eq(transactions.userId, userId))
    .orderBy(desc(transactions.createdAt))
    .limit(limit)
    .offset(offset);
}

// Funções atômicas de segurança (race condition prevention)
export { debitSaldoAtomic, creditSaldoAtomic, estornarSaldoAtomic, consultarCreditoComTransacao } from './db-atomic';
