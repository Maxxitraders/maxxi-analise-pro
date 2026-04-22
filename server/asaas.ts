/**
 * Módulo de integração com a API Asaas.
 * Gerencia clientes, cobranças (PIX, boleto, cartão) e webhooks.
 */

import { getDb } from "./db";
import { sql } from "drizzle-orm";

const ASAAS_BASE_URL = "https://api.asaas.com/v3";

// Cache da API Key obtida do banco de dados
let cachedDbApiKey: string | null = null;
let cacheTimestamp = 0;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutos

/**
 * Busca a ASAAS_API_KEY do banco de dados (tabela system_config).
 * Usa cache de 5 minutos para evitar queries excessivas.
 */
async function getApiKeyFromDb(): Promise<string> {
  const now = Date.now();
  if (cachedDbApiKey && (now - cacheTimestamp) < CACHE_TTL) {
    return cachedDbApiKey;
  }

  try {
    const db = await getDb();
    if (!db) {
      console.error("[Asaas] Banco de dados não disponível para buscar API Key");
      return "";
    }

    const result = await db.execute(
      sql`SELECT config_value FROM system_config WHERE config_key = 'ASAAS_API_KEY' LIMIT 1`
    );

    const rows = (result as any)?.[0] || (result as any)?.rows || result;
    if (Array.isArray(rows) && rows.length > 0 && rows[0]?.config_value) {
      cachedDbApiKey = rows[0].config_value;
      cacheTimestamp = now;
      console.log(`[Asaas] API Key obtida do banco de dados (${cachedDbApiKey!.substring(0, 10)}...)`);
      return cachedDbApiKey!;
    }

    console.error("[Asaas] API Key não encontrada na tabela system_config");
    return "";
  } catch (error) {
    console.error("[Asaas] Erro ao buscar API Key do banco:", error);
    return "";
  }
}

async function getAsaasApiKey(): Promise<string> {
  // Primeiro: tentar do process.env
  let key = process.env.ASAAS_API_KEY || "";

  // O caractere $ no início da chave pode ser removido pelo sistema de deploy
  if (key && !key.startsWith("$")) {
    key = "$" + key;
  }

  // Se a chave do env está vazia ou é só "$", buscar do banco de dados
  if (!key || key === "$") {
    console.log("[Asaas] API Key não encontrada no env, buscando do banco de dados...");
    key = await getApiKeyFromDb();
  }

  if (!key) {
    console.error("[Asaas] ASAAS_API_KEY não encontrada nem no env nem no banco de dados.");
    throw new Error("Sistema de pagamento temporariamente indisponível. Tente novamente em alguns minutos.");
  }

  // Garantir que começa com $
  if (!key.startsWith("$")) {
    key = "$" + key;
  }

  return key;
}

async function getHeaders() {
  return {
    "accept": "application/json",
    "content-type": "application/json",
    "access_token": await getAsaasApiKey(),
  };
}

async function asaasRequest(
  method: string,
  path: string,
  body?: any
): Promise<any> {
  const url = `${ASAAS_BASE_URL}${path}`;
  const options: RequestInit = {
    method,
    headers: await getHeaders(),
  };
  if (body) {
    options.body = JSON.stringify(body);
  }

  const response = await fetch(url, options);
  const data = await response.json();

  if (!response.ok) {
    const errorMsg = data.errors
      ? data.errors.map((e: any) => e.description).join(", ")
      : `Asaas API error: ${response.status}`;
    console.error(`[Asaas] ${method} ${path} - ${response.status}:`, data);
    throw new Error(errorMsg);
  }

  return data;
}

// ── Clientes ──

export interface AsaasCustomer {
  id: string;
  name: string;
  email: string;
  cpfCnpj?: string;
}

/**
 * Cria um novo cliente na Asaas.
 */
export async function createAsaasCustomer(params: {
  name: string;
  email: string;
  cpfCnpj?: string;
}): Promise<AsaasCustomer> {
  const data = await asaasRequest("POST", "/customers", {
    name: params.name,
    email: params.email,
    cpfCnpj: params.cpfCnpj || undefined,
  });
  return {
    id: data.id,
    name: data.name,
    email: data.email,
    cpfCnpj: data.cpfCnpj,
  };
}

/**
 * Busca um cliente na Asaas pelo email.
 */
export async function findAsaasCustomerByEmail(
  email: string
): Promise<AsaasCustomer | null> {
  const data = await asaasRequest("GET", `/customers?email=${encodeURIComponent(email)}`);
  if (data.data && data.data.length > 0) {
    const c = data.data[0];
    return { id: c.id, name: c.name, email: c.email, cpfCnpj: c.cpfCnpj };
  }
  return null;
}

/**
 * Garante que o cliente existe na Asaas (cria se não existir).
 */
export async function ensureAsaasCustomer(params: {
  name: string;
  email: string;
  cpfCnpj?: string;
}): Promise<string> {
  // Tentar encontrar pelo email
  const existing = await findAsaasCustomerByEmail(params.email);
  if (existing) return existing.id;

  // Criar novo
  const customer = await createAsaasCustomer(params);
  return customer.id;
}

// ── Cobranças ──

export type BillingType = "BOLETO" | "CREDIT_CARD" | "PIX" | "UNDEFINED";

export interface AsaasPayment {
  id: string;
  status: string;
  value: number;
  netValue: number;
  billingType: string;
  invoiceUrl: string;
  bankSlipUrl?: string;
  dueDate: string;
  description?: string;
}

/**
 * Cria uma cobrança na Asaas.
 * billingType "UNDEFINED" permite que o cliente escolha entre PIX, boleto e cartão.
 */
export async function createAsaasPayment(params: {
  customerId: string;
  billingType: BillingType;
  value: number; // em reais (ex: 6.50)
  dueDate: string; // formato YYYY-MM-DD
  description?: string;
  externalReference?: string; // referência interna (userId + planId)
}): Promise<AsaasPayment> {
  const data = await asaasRequest("POST", "/payments", {
    customer: params.customerId,
    billingType: params.billingType,
    value: params.value,
    dueDate: params.dueDate,
    description: params.description,
    externalReference: params.externalReference,
  });

  return {
    id: data.id,
    status: data.status,
    value: data.value,
    netValue: data.netValue,
    billingType: data.billingType,
    invoiceUrl: data.invoiceUrl,
    bankSlipUrl: data.bankSlipUrl,
    dueDate: data.dueDate,
    description: data.description,
  };
}

/**
 * Obtém o QR Code PIX de uma cobrança.
 */
export async function getPixQrCode(paymentId: string): Promise<{
  encodedImage: string;
  payload: string;
  expirationDate: string;
}> {
  const data = await asaasRequest("GET", `/payments/${paymentId}/pixQrCode`);
  return {
    encodedImage: data.encodedImage,
    payload: data.payload,
    expirationDate: data.expirationDate,
  };
}

/**
 * Busca o status de uma cobrança.
 */
export async function getAsaasPaymentStatus(paymentId: string): Promise<{
  id: string;
  status: string;
  value: number;
  billingType: string;
  confirmedDate?: string;
}> {
  const data = await asaasRequest("GET", `/payments/${paymentId}`);
  return {
    id: data.id,
    status: data.status,
    value: data.value,
    billingType: data.billingType,
    confirmedDate: data.confirmedDate,
  };
}

/**
 * Lista cobranças de um cliente.
 */
export async function listAsaasPayments(customerId: string): Promise<AsaasPayment[]> {
  const data = await asaasRequest("GET", `/payments?customer=${customerId}&limit=50`);
  return (data.data || []).map((p: any) => ({
    id: p.id,
    status: p.status,
    value: p.value,
    netValue: p.netValue,
    billingType: p.billingType,
    invoiceUrl: p.invoiceUrl,
    bankSlipUrl: p.bankSlipUrl,
    dueDate: p.dueDate,
    description: p.description,
  }));
}

// ── Assinaturas (recorrência) ──

export interface AsaasSubscription {
  id: string;
  status: string;
  value: number;
  cycle: string;
  billingType: string;
  nextDueDate: string;
}

/**
 * Cria uma assinatura recorrente na Asaas.
 */
export async function createAsaasSubscription(params: {
  customerId: string;
  billingType: BillingType;
  value: number; // em reais
  cycle: "MONTHLY" | "WEEKLY" | "BIWEEKLY" | "QUARTERLY" | "SEMIANNUALLY" | "YEARLY";
  description?: string;
  externalReference?: string;
}): Promise<AsaasSubscription> {
  // Data de vencimento: próximo dia útil ou amanhã
  const nextDue = new Date();
  nextDue.setDate(nextDue.getDate() + 1);
  const dueDate = nextDue.toISOString().split("T")[0];

  const data = await asaasRequest("POST", "/subscriptions", {
    customer: params.customerId,
    billingType: params.billingType,
    value: params.value,
    cycle: params.cycle,
    nextDueDate: dueDate,
    description: params.description,
    externalReference: params.externalReference,
  });

  return {
    id: data.id,
    status: data.status,
    value: data.value,
    cycle: data.cycle,
    billingType: data.billingType,
    nextDueDate: data.nextDueDate,
  };
}

/**
 * Cancela uma assinatura na Asaas.
 */
export async function cancelAsaasSubscription(subscriptionId: string): Promise<void> {
  await asaasRequest("DELETE", `/subscriptions/${subscriptionId}`);
}

/**
 * Busca detalhes de uma assinatura.
 */
export async function getAsaasSubscription(subscriptionId: string): Promise<AsaasSubscription | null> {
  try {
    const data = await asaasRequest("GET", `/subscriptions/${subscriptionId}`);
    return {
      id: data.id,
      status: data.status,
      value: data.value,
      cycle: data.cycle,
      billingType: data.billingType,
      nextDueDate: data.nextDueDate,
    };
  } catch {
    return null;
  }
}

// ── Webhook Helpers ──

export type AsaasWebhookEvent =
  | "PAYMENT_CREATED"
  | "PAYMENT_CONFIRMED"
  | "PAYMENT_RECEIVED"
  | "PAYMENT_OVERDUE"
  | "PAYMENT_DELETED"
  | "PAYMENT_REFUNDED"
  | "PAYMENT_UPDATED";

export interface AsaasWebhookPayload {
  event: AsaasWebhookEvent;
  payment: {
    id: string;
    customer: string;
    billingType: string;
    value: number;
    status: string;
    externalReference?: string;
    confirmedDate?: string;
    subscription?: string;
    description?: string;
  };
}

/**
 * Verifica se o evento indica pagamento confirmado/recebido.
 */
export function isPaymentConfirmed(event: string): boolean {
  return event === "PAYMENT_CONFIRMED" || event === "PAYMENT_RECEIVED";
}
