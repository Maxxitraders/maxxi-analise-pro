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
  getUserById,
} from "./db";
import { getPlanBySlug } from "./products";
import { sendPaymentConfirmationEmail } from "./email";

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

    // Extrair referência externa (formato: "userId:planSlug" ou "recarga:userId")
    const externalRef = payment.externalReference;
    if (!externalRef) {
      console.log("[Asaas Webhook] Sem externalReference, ignorando");
      return res.json({ received: true });
    }

    const parts = externalRef.split(":");
    
    // VERIFICAR SE É RECARGA (formato: "recarga:userId")
    if (parts[0] === "recarga" && isPaymentConfirmed(event)) {
      const userId = parseInt(parts[1], 10);
      
      if (!userId) {
        console.log(`[Asaas Webhook] externalReference de recarga inválida: ${externalRef}`);
        return res.json({ received: true });
      }
      
      console.log(`[Asaas Webhook] Recarga de saldo detectada! User: ${userId}, Valor: R$ ${payment.value}`);
      
      const { addSaldoToUser, insertTransaction } = await import("./db");
      
      // Adicionar saldo ao usuário
      await addSaldoToUser(userId, payment.value);
      
      // Registrar transação de crédito
      await insertTransaction({
        userId,
        tipo: "recarga",
        valor: String(payment.value),
        descricao: `Recarga via ${payment.billingType}`,
        bureauTipo: null,
        asaasPaymentId: payment.id,
      });
      
      console.log(`[Asaas Webhook] Saldo creditado! User: ${userId}, Valor: R$ ${payment.value}`);
      
      // Enviar email confirmando recarga
      try {
        const user = await getUserById(userId);
        if (user?.email) {
          const { sendEmail } = await import("./email");
          await sendEmail({
            to: user.email,
            subject: "Saldo adicionado com sucesso! 💰",
            html: `
              <h2>Olá ${user.name || ""}!</h2>
              <p>Seu saldo foi creditado com sucesso:</p>
              <p style="font-size: 24px; font-weight: bold; color: #2563eb;">
                + R$ ${payment.value.toFixed(2)}
              </p>
              <p>Você já pode usar seus créditos para fazer consultas no Maxxi Analise Pro.</p>
              <p>Método de pagamento: ${payment.billingType === "PIX" ? "PIX" : payment.billingType === "CREDIT_CARD" ? "Cartão de Crédito" : "Boleto"}</p>
            `,
          });
          console.log(`[Asaas Webhook] Email de recarga enviado para: ${user.email}`);
        }
      } catch (emailError) {
        console.error("[Asaas Webhook] Falha ao enviar email de recarga:", emailError);
      }
      
      return res.json({ received: true });
    }

    // CASO CONTRÁRIO: formato assinatura "userId:planSlug"
    const [userIdStr, planSlug] = parts;
    const userId = parseInt(userIdStr, 10);

    if (!userId || !planSlug) {
      console.log(`[Asaas Webhook] externalReference inválida: ${externalRef}`);
      return res.json({ received: true });
    }

    // Pagamento confirmado/recebido → ativar assinatura
    if (isPaymentConfirmed(event)) {
      console.log(`[Asaas Webhook] Pagamento confirmado! User: ${userId}, Plano: ${planSlug}`);

      // Ativar assinatura de plano
      const plan = await getPlanBySlug(planSlug);
      if (!plan) {
        console.error(`[Asaas Webhook] Plano não encontrado: ${planSlug}`);
        return res.json({ received: true });
      }

      // Ativar assinatura do usuário
      const subscriptionId = payment.subscription || payment.id;
      await activateSubscription(userId, planSlug, subscriptionId);

      console.log(`[Asaas Webhook] Assinatura ativada! User: ${userId}, Plano: ${plan.name}`);

      // Enviar email de confirmação de pagamento
      try {
        const user = await getUserById(userId);
        if (user?.email) {
          await sendPaymentConfirmationEmail({
            to: user.email,
            userName: user.name || undefined,
            planName: plan.name,
            consultasLimit: plan.consultasLimit,
          });
          console.log(`[Asaas Webhook] Email de confirmação enviado para: ${user.email}`);
        }
      } catch (emailError) {
        console.error("[Asaas Webhook] Falha ao enviar email de confirmação:", emailError);
        // Não bloquear o fluxo principal
      }
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
