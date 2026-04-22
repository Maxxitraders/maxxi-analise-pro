import express, { Request, Response } from "express";
import Stripe from "stripe";
import { getStripe } from "./stripe";
import { ENV } from "./_core/env";
import { getDb } from "./db";
import { users } from "../drizzle/schema";
import { eq } from "drizzle-orm";

/**
 * Registra a rota de webhook do Stripe.
 * IMPORTANTE: deve ser registrada ANTES do express.json() middleware.
 */
export function registerStripeWebhook(app: express.Express) {
  app.post(
    "/api/stripe/webhook",
    express.raw({ type: "application/json" }),
    async (req: Request, res: Response) => {
      const sig = req.headers["stripe-signature"];
      if (!sig) {
        return res.status(400).json({ error: "Missing stripe-signature header" });
      }

      let event: Stripe.Event;
      try {
        const stripe = getStripe();
        event = stripe.webhooks.constructEvent(
          req.body,
          sig,
          ENV.stripeWebhookSecret
        );
      } catch (err: any) {
        console.error("[Stripe Webhook] Signature verification failed:", err.message);
        return res.status(400).json({ error: `Webhook Error: ${err.message}` });
      }

      // Handle test events
      if (event.id.startsWith("evt_test_")) {
        console.log("[Stripe Webhook] Test event detected, returning verification response");
        return res.json({ verified: true });
      }

      console.log(`[Stripe Webhook] Received event: ${event.type} (${event.id})`);

      try {
        switch (event.type) {
          case "checkout.session.completed":
            await handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session);
            break;
          case "customer.subscription.updated":
            await handleSubscriptionUpdated(event.data.object as Stripe.Subscription);
            break;
          case "customer.subscription.deleted":
            await handleSubscriptionDeleted(event.data.object as Stripe.Subscription);
            break;
          case "invoice.paid":
            await handleInvoicePaid(event.data.object as Stripe.Invoice);
            break;
          case "invoice.payment_failed":
            await handleInvoicePaymentFailed(event.data.object as Stripe.Invoice);
            break;
          default:
            console.log(`[Stripe Webhook] Unhandled event type: ${event.type}`);
        }
      } catch (err) {
        console.error(`[Stripe Webhook] Error handling ${event.type}:`, err);
      }

      res.json({ received: true });
    }
  );
}

async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
  const userId = parseInt(session.metadata?.user_id || session.client_reference_id || "0");
  const planId = session.metadata?.plan_id || "basico";
  const customerId = session.customer as string;
  const subscriptionId = session.subscription as string;

  if (!userId) {
    console.error("[Stripe Webhook] No user_id in checkout session metadata");
    return;
  }

  const db = await getDb();
  if (!db) return;

  await db.update(users).set({
    stripeCustomerId: customerId,
    stripeSubscriptionId: subscriptionId,
    planId: planId,
    subscriptionStatus: "active",
    consultasUsedThisMonth: 0,
    consultasResetAt: new Date(),
  }).where(eq(users.id, userId));

  console.log(`[Stripe Webhook] User ${userId} subscribed to plan "${planId}"`);
}

async function handleSubscriptionUpdated(subscription: Stripe.Subscription) {
  const db = await getDb();
  if (!db) return;

  const customerId = subscription.customer as string;
  const planId = subscription.metadata?.plan_id || null;

  const updateData: Record<string, any> = {
    subscriptionStatus: subscription.status,
    stripeSubscriptionId: subscription.id,
  };

  if (planId) {
    updateData.planId = planId;
  }

  await db.update(users).set(updateData).where(eq(users.stripeCustomerId, customerId));
  console.log(`[Stripe Webhook] Subscription updated for customer ${customerId}: status=${subscription.status}`);
}

async function handleSubscriptionDeleted(subscription: Stripe.Subscription) {
  const db = await getDb();
  if (!db) return;

  const customerId = subscription.customer as string;

  await db.update(users).set({
    subscriptionStatus: "canceled",
    planId: "none",
    stripeSubscriptionId: null,
  }).where(eq(users.stripeCustomerId, customerId));

  console.log(`[Stripe Webhook] Subscription canceled for customer ${customerId}`);
}

async function handleInvoicePaid(invoice: Stripe.Invoice) {
  const db = await getDb();
  if (!db) return;

  const customerId = invoice.customer as string;

  // Reset consultas count on successful payment (new billing cycle)
  await db.update(users).set({
    consultasUsedThisMonth: 0,
    consultasResetAt: new Date(),
    subscriptionStatus: "active",
  }).where(eq(users.stripeCustomerId, customerId));

  console.log(`[Stripe Webhook] Invoice paid for customer ${customerId}, consultas reset`);
}

async function handleInvoicePaymentFailed(invoice: Stripe.Invoice) {
  const db = await getDb();
  if (!db) return;

  const customerId = invoice.customer as string;

  await db.update(users).set({
    subscriptionStatus: "past_due",
  }).where(eq(users.stripeCustomerId, customerId));

  console.log(`[Stripe Webhook] Payment failed for customer ${customerId}`);
}
