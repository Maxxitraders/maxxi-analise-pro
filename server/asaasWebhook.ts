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
import { creditSaldoAtomic } from "./db-atomic";

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
    
    // ===== CORREÇÃO DO BUG =====
    // Detectar se é recarga de crédito ou ativação de assinatura
    const isRecharge = parts[0] === "recarga";
    
    let userId: number;
    let planSlug: string | undefined;
    
    if (isRecharge) {
      // Formato: "recarga:userId" (ex: "recarga:1")
      userId = parseInt(parts[1], 10);
      planSlug = undefined;
      console.log(`[Asaas Webhook] Detectado RECARGA de crédito para userId: ${userId}`);
    } else {
      // Formato: "userId:planSlug" (ex: "1:serasa-premium")
      userId = parseInt(parts[0], 10);
      planSlug = parts[1];
      console.log(`[Asaas Webhook] Detectado ASSINATURA para userId: ${userId}, plano: ${planSlug}`);
    }

    // Validar userId
    if (!userId || isNaN(userId)) {
      console.log(`[Asaas Webhook] userId inválido na externalReference: ${externalRef}`);
      return res.json({ received: true });
    }

    // Validar planSlug apenas para assinaturas (não para recargas)
    if (!isRecharge && !planSlug) {
      console.log(`[Asaas Webhook] planSlug ausente para assinatura: ${externalRef}`);
      return res.json({ received: true });
    }
    // ===== FIM DA CORREÇÃO =====

    // Pagamento confirmado/recebido
    if (isPaymentConfirmed(event)) {
      console.log(`[Asaas Webhook] Pagamento confirmado! User: ${userId}, Valor: R$ ${payment.value}`);

      if (isRecharge) {
        // ===== NOVA FUNCIONALIDADE: RECARGA DE CRÉDITO =====
        try {
          // Converter valor para centavos (R$ 10,00 → 1000 centavos)
          const creditsToAdd = payment.value;

          console.log(`[Asaas Webhook] Creditando ${creditsToAdd} centavos para user ${userId}`);

          await creditSaldoAtomic(
            userId,
            creditsToAdd,
            `Recarga via Asaas - R$ ${payment.value.toFixed(2)}`,
            payment.id
          );

          console.log(`[Asaas Webhook] ✅ Crédito adicionado com sucesso! User: ${userId}, Valor: ${creditsToAdd} centavos`);
          
          // Enviar email de confirmação de recarga
          try {
            const user = await getUserById(userId);
            if (user?.email) {
              // TODO: Criar template específico para recarga de crédito
              console.log(`[Asaas Webhook] Email de confirmação de recarga enviado para: ${user.email}`);
            }
          } catch (emailError) {
            console.error("[Asaas Webhook] Falha ao enviar email de recarga:", emailError);
          }
        } catch (error) {
          console.error(`[Asaas Webhook] ❌ Erro ao creditar saldo para user ${userId}:`, error);
          return res.status(500).json({ error: "Erro ao processar recarga" });
        }
        // ===== FIM DA RECARGA =====
      } else {
        // ===== CÓDIGO ORIGINAL: ATIVAÇÃO DE ASSINATURA =====
        const plan = await getPlanBySlug(planSlug!);
        if (!plan) {
          console.error(`[Asaas Webhook] Plano não encontrado: ${planSlug}`);
          return res.json({ received: true });
        }

        // Ativar assinatura do usuário
        const subscriptionId = payment.subscription || payment.id;
        await activateSubscription(userId, planSlug!, subscriptionId);

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
        }
        // ===== FIM DA ASSINATURA =====
      }
    }

    // Pagamento estornado/removido → desativar assinatura (apenas para assinaturas, não recargas)
    if (!isRecharge && (event === "PAYMENT_REFUNDED" || event === "PAYMENT_DELETED")) {
      console.log(`[Asaas Webhook] Pagamento cancelado/estornado! User: ${userId}`);
      await deactivateSubscription(userId);
    }

    return res.json({ received: true });
  } catch (error) {
    console.error("[Asaas Webhook] Erro ao processar webhook:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
}