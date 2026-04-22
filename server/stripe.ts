import Stripe from "stripe";
import { ENV } from "./_core/env";
import { type PlanData, getPlanBySlug, updatePlan } from "./products";

let _stripe: Stripe | null = null;

export function getStripe(): Stripe {
  if (!_stripe) {
    if (!ENV.stripeSecretKey) {
      throw new Error("STRIPE_SECRET_KEY não configurada");
    }
    _stripe = new Stripe(ENV.stripeSecretKey, { apiVersion: "2025-04-30.basil" as any });
  }
  return _stripe;
}

// Cache de price IDs criados no Stripe (slug -> { priceId, amount })
const priceCache = new Map<string, { priceId: string; amount: number }>();

/**
 * Limpa o cache de preço para um plano específico.
 * Deve ser chamado quando o preço do plano muda.
 */
export function invalidatePriceCache(planSlug: string): void {
  priceCache.delete(planSlug);
}

/**
 * Limpa todo o cache de preços.
 */
export function clearAllPriceCache(): void {
  priceCache.clear();
}

/**
 * Garante que o produto e preço existam no Stripe.
 * Cria se não existir, retorna o price ID.
 * Sempre valida que o preço no cache corresponde ao preço atual do plano.
 */
export async function ensureStripePriceForPlan(plan: PlanData): Promise<string> {
  // Se temos no cache E o valor bate, usar direto
  const cached = priceCache.get(plan.id);
  if (cached && cached.amount === plan.monthlyPrice && plan.stripePriceId === cached.priceId) {
    return cached.priceId;
  }

  // Se temos stripePriceId no banco, verificar se ainda é válido no Stripe
  if (plan.stripePriceId) {
    try {
      const stripe = getStripe();
      const existingPrice = await stripe.prices.retrieve(plan.stripePriceId);
      if (existingPrice.active && existingPrice.unit_amount === plan.monthlyPrice) {
        priceCache.set(plan.id, { priceId: plan.stripePriceId, amount: plan.monthlyPrice });
        return plan.stripePriceId;
      }
      // Preço existe mas valor é diferente ou está inativo -> criar novo
    } catch {
      // Price não existe mais no Stripe, criar novo
    }
  }

  const stripe = getStripe();

  // Buscar produto existente por metadata
  const existingProducts = await stripe.products.search({
    query: `metadata["plan_id"]:"${plan.id}"`,
  });

  let productId: string;

  if (existingProducts.data.length > 0) {
    productId = existingProducts.data[0].id;
    // Atualizar nome e descrição do produto
    await stripe.products.update(productId, {
      name: `Maxxi Analise Pro - ${plan.name}`,
      description: plan.description,
    });
  } else {
    const product = await stripe.products.create({
      name: `Maxxi Analise Pro - ${plan.name}`,
      description: plan.description,
      metadata: { plan_id: plan.id },
    });
    productId = product.id;
  }

  // Salvar stripeProductId no banco
  if (!plan.stripeProductId || plan.stripeProductId !== productId) {
    await updatePlan(plan.dbId, { stripeProductId: productId });
  }

  // Buscar preço ativo para este produto
  const existingPrices = await stripe.prices.list({
    product: productId,
    active: true,
    type: "recurring",
    limit: 1,
  });

  let priceId: string;

  if (existingPrices.data.length > 0 && existingPrices.data[0].unit_amount === plan.monthlyPrice) {
    priceId = existingPrices.data[0].id;
  } else {
    // Desativar preços antigos
    for (const oldPrice of existingPrices.data) {
      if (oldPrice.active) {
        await stripe.prices.update(oldPrice.id, { active: false });
      }
    }
    const price = await stripe.prices.create({
      product: productId,
      unit_amount: plan.monthlyPrice,
      currency: "brl",
      recurring: { interval: "month" },
      metadata: { plan_id: plan.id },
    });
    priceId = price.id;
  }

  // Salvar stripePriceId no banco
  await updatePlan(plan.dbId, { stripePriceId: priceId });

  priceCache.set(plan.id, { priceId, amount: plan.monthlyPrice });
  return priceId;
}

/**
 * Cria uma sessão de checkout para assinatura.
 */
export async function createCheckoutSession(params: {
  planId: string;
  userId: number;
  userEmail: string;
  userName: string;
  origin: string;
  stripeCustomerId?: string | null;
}): Promise<string> {
  const plan = await getPlanBySlug(params.planId);
  if (!plan) throw new Error(`Plano "${params.planId}" não encontrado.`);

  const stripe = getStripe();
  const priceId = await ensureStripePriceForPlan(plan);

  const sessionParams: Stripe.Checkout.SessionCreateParams = {
    mode: "subscription",
    payment_method_types: ["card"],
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${params.origin}/assinatura?status=success`,
    cancel_url: `${params.origin}/planos?status=cancelled`,
    allow_promotion_codes: true,
    client_reference_id: params.userId.toString(),
    metadata: {
      user_id: params.userId.toString(),
      plan_id: params.planId,
      customer_email: params.userEmail,
      customer_name: params.userName,
    },
  };

  if (params.stripeCustomerId) {
    sessionParams.customer = params.stripeCustomerId;
  } else {
    sessionParams.customer_email = params.userEmail;
  }

  const session = await stripe.checkout.sessions.create(sessionParams);
  return session.url!;
}

/**
 * Cria um portal de gerenciamento de assinatura para o cliente.
 */
export async function createBillingPortalSession(params: {
  stripeCustomerId: string;
  origin: string;
}): Promise<string> {
  const stripe = getStripe();
  const session = await stripe.billingPortal.sessions.create({
    customer: params.stripeCustomerId,
    return_url: `${params.origin}/assinatura`,
  });
  return session.url;
}

/**
 * Busca detalhes da assinatura no Stripe.
 */
export async function getSubscriptionDetails(subscriptionId: string) {
  const stripe = getStripe();
  try {
    const sub = await stripe.subscriptions.retrieve(subscriptionId);
    return {
      status: sub.status,
      currentPeriodEnd: new Date((sub as any).current_period_end * 1000),
      currentPeriodStart: new Date((sub as any).current_period_start * 1000),
      cancelAtPeriodEnd: sub.cancel_at_period_end,
      planId: sub.metadata?.plan_id || null,
    };
  } catch {
    return null;
  }
}
