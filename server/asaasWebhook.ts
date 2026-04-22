/**
 * Webhook handler para eventos da Asaas.
 * Processa confirmações de pagamento e ativa/desativa assinaturas.
 */

import type { Request, Response } from "express";
import { isPaymentConfirmed, type AsaasWebhookPayload } from "./asaas";
import {
  getUserByAsaasCustomerId,
  activateSubscription,
  deactivateSubscription,
} from "./db";
import { getPlanBySlug } from "./products";

export async function handleAsaasWebhook(req: Request, res: Response) {
  try {
    // Validar token de autenticação do webhook
    const webhookToken = process.env.ASAAS_WEBHOOK_TOKEN || "";
    if (webhookToken) {
      const receivedToken = req.headers["asaas-access-token"] as string;
      if (!receivedToken || receivedToken !== webhookToken) {
        console.error(`[Asaas Webhook] Token de autenticação inválido ou ausente. Recebido: ${receivedToken ? 'token presente mas incorreto' : 'sem token'}`);
        return res.status(401).json({ error: "Unauthorized" });
      }
    }

    const payload = req.body as AsaasWebhookPayload;
    const { event, payment } = payload;

    console.log(`[Asaas Webhook] Evento recebido: ${event} | Payment: ${payment?.id} | Status: ${payment?.status}`);

    if (!payment) {
      console.log("[Asaas Webhook] Payload sem dados de pagamento, ignorando");
      return res.json({ received: true });
    }

    // Extrair referência externa (formato: "userId:planSlug")
    const externalRef = payment.externalReference;
    if (!externalRef) {
      console.log("[Asaas Webhook] Sem externalReference, ignorando");
      return res.json({ received: true });
    }

    const [userIdStr, planSlug] = externalRef.split(":");
    const userId = parseInt(userIdStr, 10);

    if (!userId || !planSlug) {
      console.log(`[Asaas Webhook] externalReference inválida: ${externalRef}`);
      return res.json({ received: true });
    }

    // Pagamento confirmado/recebido → ativar assinatura
    if (isPaymentConfirmed(event)) {
      console.log(`[Asaas Webhook] Pagamento confirmado! User: ${userId}, Plano: ${planSlug}`);

      const plan = await getPlanBySlug(planSlug);
      if (!plan) {
        console.error(`[Asaas Webhook] Plano não encontrado: ${planSlug}`);
        return res.json({ received: true });
      }

      // Ativar assinatura do usuário
      const subscriptionId = payment.subscription || payment.id;
      await activateSubscription(userId, planSlug, subscriptionId);

      console.log(`[Asaas Webhook] Assinatura ativada! User: ${userId}, Plano: ${plan.name}`);
    }

    // Pagamento estornado/removido → desativar assinatura
    if (event === "PAYMENT_REFUNDED" || event === "PAYMENT_DELETED") {
      console.log(`[Asaas Webhook] Pagamento cancelado/estornado! User: ${userId}`);
      await deactivateSubscription(userId);
    }

    return res.json({ received: true });
  } catch (error) {
    console.error("[Asaas Webhook] Erro ao processar webhook:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
}
