/**
 * Planos de assinatura do Maxxi Analise Pro.
 * Agora os planos são gerenciados dinamicamente via banco de dados.
 */

import { getDb } from "./db";
import { plans } from "../drizzle/schema";
import { eq, asc } from "drizzle-orm";

export interface PlanData {
  id: string; // slug
  dbId: number;
  name: string;
  description: string;
  monthlyPrice: number; // em centavos BRL
  consultasLimit: number; // consultas por mês (-1 = ilimitado)
  features: string[];
  popular?: boolean;
  active: boolean;
  sortOrder: number;
  stripePriceId?: string | null;
  stripeProductId?: string | null;
}

/**
 * Busca todos os planos ativos do banco de dados, ordenados por sortOrder.
 */
export async function getActivePlans(): Promise<PlanData[]> {
  const db = await getDb();
  if (!db) return [];

  const rows = await db
    .select()
    .from(plans)
    .where(eq(plans.active, true))
    .orderBy(asc(plans.sortOrder));

  return rows.map(mapPlanRow);
}

/**
 * Busca todos os planos (ativos e inativos) do banco de dados.
 */
export async function getAllPlans(): Promise<PlanData[]> {
  const db = await getDb();
  if (!db) return [];

  const rows = await db
    .select()
    .from(plans)
    .orderBy(asc(plans.sortOrder));

  return rows.map(mapPlanRow);
}

/**
 * Busca um plano pelo slug.
 */
export async function getPlanBySlug(slug: string): Promise<PlanData | undefined> {
  const db = await getDb();
  if (!db) return undefined;

  const rows = await db
    .select()
    .from(plans)
    .where(eq(plans.slug, slug))
    .limit(1);

  return rows.length > 0 ? mapPlanRow(rows[0]) : undefined;
}

/**
 * Busca um plano pelo ID numérico.
 */
export async function getPlanByDbId(id: number): Promise<PlanData | undefined> {
  const db = await getDb();
  if (!db) return undefined;

  const rows = await db
    .select()
    .from(plans)
    .where(eq(plans.id, id))
    .limit(1);

  return rows.length > 0 ? mapPlanRow(rows[0]) : undefined;
}

/**
 * Cria um novo plano no banco de dados.
 */
export async function createPlan(data: {
  slug: string;
  name: string;
  description: string;
  monthlyPrice: number;
  consultasLimit: number;
  features: string[];
  popular?: boolean;
  sortOrder?: number;
}): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const result = await db.insert(plans).values({
    slug: data.slug,
    name: data.name,
    description: data.description || "",
    monthlyPrice: data.monthlyPrice,
    consultasLimit: data.consultasLimit,
    features: data.features,
    popular: data.popular || false,
    sortOrder: data.sortOrder || 0,
    active: true,
  });

  return Number(result[0].insertId);
}

/**
 * Atualiza um plano existente.
 */
export async function updatePlan(
  id: number,
  data: Partial<{
    slug: string;
    name: string;
    description: string;
    monthlyPrice: number;
    consultasLimit: number;
    features: string[];
    popular: boolean;
    active: boolean;
    sortOrder: number;
    stripePriceId: string | null;
    stripeProductId: string | null;
  }>
): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db.update(plans).set(data).where(eq(plans.id, id));
}

/**
 * Exclui um plano pelo ID.
 */
export async function deletePlan(id: number): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db.delete(plans).where(eq(plans.id, id));
}

/**
 * Formata preço de centavos para BRL.
 */
export function formatPrice(cents: number): string {
  return `R$ ${(cents / 100).toFixed(2).replace(".", ",")}`;
}

/**
 * Mapeia uma row do banco para o formato PlanData.
 */
function mapPlanRow(row: typeof plans.$inferSelect): PlanData {
  return {
    id: row.slug,
    dbId: row.id,
    name: row.name,
    description: row.description || "",
    monthlyPrice: row.monthlyPrice,
    consultasLimit: row.consultasLimit,
    features: (row.features as string[]) || [],
    popular: row.popular || false,
    active: row.active,
    sortOrder: row.sortOrder || 0,
    stripePriceId: row.stripePriceId,
    stripeProductId: row.stripeProductId,
  };
}
