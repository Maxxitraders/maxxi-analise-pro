import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import {
  insertCreditAnalysis,
  getCreditAnalysisById,
  listCreditAnalyses,
  getDashboardStats,
  updateAnalysisPdfUrl,
  markAlertSent,
  getUserById,
  incrementConsultasUsed,
  getAllSubscribers,
  getAllUsers,
  getSubscriptionStats,
  updateUserAsaasCustomerId,
  updateUserAsaasSubscription,
  activateSubscription,
  deactivateSubscription,
  deleteUser,
  deleteSimulatedAnalyses,
  updateUserProfile,
  resetUserConsultas,
  addBonusConsultas,
  setUserPlan,
} from "./db";
import {
  runCreditAnalysis,
  validateDocument,
  formatDocument,
  detectDocumentType,
  isHighRisk,
  ApiUnavailableError,
} from "./creditEngine";
import { notifyOwner } from "./_core/notification";
import {
  getActivePlans,
  getAllPlans,
  getPlanBySlug,
  getPlanByDbId,
  createPlan,
  updatePlan,
  deletePlan,
  formatPrice,
  type PlanData,
} from "./products";
import {
  createCheckoutSession,
  createBillingPortalSession,
  getSubscriptionDetails,
  ensureStripePriceForPlan,
  invalidatePriceCache,
} from "./stripe";
import {
  registerUser,
  loginUser,
  requestPasswordReset,
  resetPassword,
  getUserByEmail,
} from "./localAuth";
import { sendPasswordResetEmail, sendWelcomeEmail, sendPaymentConfirmationEmail, isEmailConfigured } from "./email";
import {
  ensureAsaasCustomer,
  createAsaasPayment,
  getPixQrCode,
  getAsaasPaymentStatus,
  listAsaasPayments,
  cancelAsaasSubscription,
  type BillingType,
} from "./asaas";

// Helper: check if user has active subscription or is admin
function checkSubscriptionAccess(user: any) {
  if (user.role === "admin") return; // Admin has unlimited access
  if (user.subscriptionStatus !== "active") {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Você precisa de uma assinatura ativa para realizar consultas. Acesse a página de Planos para assinar.",
    });
  }
}

// Helper: check consultas limit
async function checkConsultasLimit(user: any) {
  if (user.role === "admin") return; // Admin has unlimited access
  const plan = await getPlanBySlug(user.planId || "none");
  if (!plan) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Plano não encontrado. Acesse a página de Planos para assinar.",
    });
  }
  if (plan.consultasLimit !== -1 && (user.consultasUsedThisMonth || 0) >= plan.consultasLimit) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: `Você atingiu o limite de ${plan.consultasLimit} consultas do plano ${plan.name}. Faça upgrade para continuar.`,
    });
  }
}

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),

    // ── Atualizar perfil ──
    updateProfile: protectedProcedure
      .input(z.object({
        name: z.string().min(2, "Nome deve ter pelo menos 2 caracteres").optional(),
        email: z.string().email("Email inválido").optional(),
        newPassword: z.string().min(6, "Senha deve ter pelo menos 6 caracteres").optional(),
        currentPassword: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const { hashPassword, verifyPassword } = await import("./localAuth");
        const db_module = await import("./db");
        const db = await db_module.getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Banco de dados não disponível" });

        const { users: usersTable } = await import("../drizzle/schema");
        const { eq } = await import("drizzle-orm");

        const currentUser = await db_module.getUserById(ctx.user.id);
        if (!currentUser) throw new TRPCError({ code: "NOT_FOUND", message: "Usuário não encontrado" });

        // Se quiser trocar senha, verificar senha atual
        if (input.newPassword) {
          if (!currentUser.passwordHash) {
            throw new TRPCError({ code: "BAD_REQUEST", message: "Esta conta não possui senha definida. Use o fluxo de recuperação de senha." });
          }
          if (!input.currentPassword) {
            throw new TRPCError({ code: "BAD_REQUEST", message: "Informe a senha atual para definir uma nova." });
          }
          const valid = await verifyPassword(input.currentPassword, currentUser.passwordHash);
          if (!valid) {
            throw new TRPCError({ code: "BAD_REQUEST", message: "Senha atual incorreta." });
          }
        }

        // Verificar se email já está em uso por outro usuário
        if (input.email && input.email !== currentUser.email) {
          const existing = await getUserByEmail(input.email);
          if (existing && existing.id !== ctx.user.id) {
            throw new TRPCError({ code: "BAD_REQUEST", message: "Este email já está em uso por outra conta." });
          }
        }

        const updates: Record<string, unknown> = {};
        if (input.name) updates.name = input.name;
        if (input.email) updates.email = input.email;
        if (input.newPassword) updates.passwordHash = await hashPassword(input.newPassword);

        if (Object.keys(updates).length > 0) {
          await db.update(usersTable).set(updates).where(eq(usersTable.id, ctx.user.id));
        }

        return { success: true, message: "Perfil atualizado com sucesso." };
      }),


    register: publicProcedure
      .input(z.object({
        name: z.string().min(2, "Nome deve ter pelo menos 2 caracteres"),
        email: z.string().email("Email inválido"),
        password: z.string().min(6, "Senha deve ter pelo menos 6 caracteres"),
      }))
      .mutation(async ({ input, ctx }) => {
        try {
          const { userId, openId } = await registerUser(input);
          // Criar sessão automaticamente após registro
          const { SignJWT } = await import("jose");
          const secretKey = new TextEncoder().encode(process.env.JWT_SECRET || "");
          const sessionToken = await new SignJWT({
            openId,
            appId: process.env.VITE_APP_ID || "local",
            name: input.name,
          })
            .setProtectedHeader({ alg: "HS256", typ: "JWT" })
            .setExpirationTime(Math.floor((Date.now() + 365 * 24 * 60 * 60 * 1000) / 1000))
            .sign(secretKey);

          const cookieOptions = getSessionCookieOptions(ctx.req);
          ctx.res.cookie(COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: 365 * 24 * 60 * 60 * 1000 });

          // Enviar email de boas-vindas (não bloquear se falhar)
          sendWelcomeEmail({ to: input.email, userName: input.name }).catch(() => {});

          return { success: true, message: "Cadastro realizado com sucesso!" };
        } catch (error: any) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: error.message || "Erro ao criar conta.",
          });
        }
      }),

    // ── Login com email/senha ──
    login: publicProcedure
      .input(z.object({
        email: z.string().email("Email inválido"),
        password: z.string().min(1, "Senha é obrigatória"),
      }))
      .mutation(async ({ input, ctx }) => {
        try {
          const { user, sessionToken } = await loginUser(input);
          const cookieOptions = getSessionCookieOptions(ctx.req);
          ctx.res.cookie(COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: 365 * 24 * 60 * 60 * 1000 });
          return { success: true, userName: user.name };
        } catch (error: any) {
          throw new TRPCError({
            code: "UNAUTHORIZED",
            message: error.message || "Email ou senha incorretos.",
          });
        }
      }),

    // ── Solicitar recuperação de senha ──
    requestPasswordReset: publicProcedure
      .input(z.object({
        email: z.string().email("Email inválido"),
        origin: z.string(), // URL base do frontend
      }))
      .mutation(async ({ input }) => {
        // Se Resend não estiver configurado, avisar imediatamente (não silenciar)
        if (!isEmailConfigured()) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Serviço de email não configurado. Entre em contato com o suporte.",
          });
        }

        const result = await requestPasswordReset(input.email);
        if (result) {
          const resetLink = `${input.origin}/redefinir-senha?token=${result.token}`;
          const user = await getUserByEmail(input.email);
          const emailSent = await sendPasswordResetEmail({
            to: input.email,
            resetLink,
            userName: user?.name || undefined,
          });
          if (!emailSent) {
            // Email configurado mas falhou no envio (domínio não verificado, etc)
            throw new TRPCError({
              code: "INTERNAL_SERVER_ERROR",
              message: "Não foi possível enviar o email. Verifique se o domínio está verificado no Resend e tente novamente.",
            });
          }
        }
        // Sempre retornar sucesso para não revelar se o email existe
        return { success: true, message: "Se o email estiver cadastrado, você receberá as instruções em instantes." };
      }),

    // ── Redefinir senha com token ──
    resetPassword: publicProcedure
      .input(z.object({
        token: z.string().min(1, "Token é obrigatório"),
        newPassword: z.string().min(6, "Senha deve ter pelo menos 6 caracteres"),
      }))
      .mutation(async ({ input }) => {
        try {
          await resetPassword(input);
          return { success: true, message: "Senha redefinida com sucesso! Faça login com sua nova senha." };
        } catch (error: any) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: error.message || "Erro ao redefinir senha.",
          });
        }
      }),
  }),

  // ── Subscription & Plans ──
  subscription: router({
    plans: publicProcedure.query(async () => {
      const activePlans = await getActivePlans();
      return activePlans.map((p: PlanData) => ({
        ...p,
        priceFormatted: formatPrice(p.monthlyPrice),
      }));
    }),

    mySubscription: protectedProcedure.query(async ({ ctx }) => {
      const user = await getUserById(ctx.user.id);
      if (!user) throw new TRPCError({ code: "NOT_FOUND", message: "Usu\u00e1rio n\u00e3o encontrado." });

      const plan = await getPlanBySlug(user.planId || "none");

      return {
        planId: user.planId || "none",
        planName: plan?.name || "Sem plano",
        subscriptionStatus: user.subscriptionStatus || "none",
        consultasUsed: user.consultasUsedThisMonth || 0,
        consultasLimit: plan?.consultasLimit ?? 0,
        consultasResetAt: user.consultasResetAt,
        hasAsaasCustomer: !!user.asaasCustomerId,
      };
    }),

    // Criar cobran\u00e7a via Asaas (PIX, boleto ou cart\u00e3o)
    createAsaasCheckout: protectedProcedure
      .input(z.object({
        planSlug: z.string(),
        billingType: z.enum(["BOLETO", "CREDIT_CARD", "PIX", "UNDEFINED"]),
        cpfCnpj: z.string().optional(),
        phone: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const user = await getUserById(ctx.user.id);
        if (!user) throw new TRPCError({ code: "NOT_FOUND" });

        const plan = await getPlanBySlug(input.planSlug);
        if (!plan || !plan.active) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Plano não encontrado ou inativo." });
        }

        // Validar CPF/CNPJ — obrigatório para criar cobrança Asaas
        const cleanedCpfCnpj = (input.cpfCnpj || user.cpfCnpj || "").replace(/\D/g, "");
        if (!cleanedCpfCnpj || (cleanedCpfCnpj.length !== 11 && cleanedCpfCnpj.length !== 14)) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "CPF ou CNPJ é obrigatório para gerar a cobrança. Informe um CPF (11 dígitos) ou CNPJ (14 dígitos).",
          });
        }

        // Salvar CPF/CNPJ e telefone no cadastro do usuário se ainda não tiver
        const db_module = await import("./db");
        const db = await db_module.getDb();
        if (db && (!user.cpfCnpj || (input.phone && !user.phone))) {
          const { users: usersTable } = await import("../drizzle/schema");
          const { eq } = await import("drizzle-orm");
          await db.update(usersTable).set({
            ...(!user.cpfCnpj && { cpfCnpj: cleanedCpfCnpj }),
            ...(input.phone && !user.phone && { phone: input.phone.replace(/\D/g, "") }),
          }).where(eq(usersTable.id, ctx.user.id));
        }

        // Garantir que o cliente existe na Asaas (agora com CPF/CNPJ)
        let asaasCustomerId = user.asaasCustomerId;
        if (!asaasCustomerId) {
          asaasCustomerId = await ensureAsaasCustomer({
            name: user.name || "Cliente",
            email: user.email || "",
            cpfCnpj: cleanedCpfCnpj,
          });
          await updateUserAsaasCustomerId(ctx.user.id, asaasCustomerId);
        }

        // Calcular data de vencimento (amanh\u00e3)
        const dueDate = new Date();
        dueDate.setDate(dueDate.getDate() + 1);
        const dueDateStr = dueDate.toISOString().split("T")[0];

        // Valor em reais (monthlyPrice est\u00e1 em centavos)
        const valueInReais = plan.monthlyPrice / 100;

        // Criar cobran\u00e7a
        const payment = await createAsaasPayment({
          customerId: asaasCustomerId,
          billingType: input.billingType as BillingType,
          value: valueInReais,
          dueDate: dueDateStr,
          description: `Plano ${plan.name} - Maxxi An\u00e1lise Pro`,
          externalReference: `${ctx.user.id}:${plan.id}`,
        });

        // Se for PIX, obter QR Code
        let pixData = null;
        if (input.billingType === "PIX") {
          try {
            pixData = await getPixQrCode(payment.id);
          } catch (e) {
            console.error("[Asaas] Erro ao obter QR Code PIX:", e);
          }
        }

        return {
          paymentId: payment.id,
          invoiceUrl: payment.invoiceUrl,
          bankSlipUrl: payment.bankSlipUrl,
          status: payment.status,
          billingType: payment.billingType,
          value: payment.value,
          pixData,
        };
      }),

    // Verificar status de um pagamento Asaas
    checkPaymentStatus: protectedProcedure
      .input(z.object({ paymentId: z.string() }))
      .query(async ({ input }) => {
        const status = await getAsaasPaymentStatus(input.paymentId);
        return status;
      }),

    // Cancelar assinatura
    cancelSubscription: protectedProcedure
      .mutation(async ({ ctx }) => {
        const user = await getUserById(ctx.user.id);
        if (!user) throw new TRPCError({ code: "NOT_FOUND" });

        if (user.asaasSubscriptionId) {
          try {
            await cancelAsaasSubscription(user.asaasSubscriptionId);
          } catch (e) {
            console.error("[Asaas] Erro ao cancelar assinatura:", e);
          }
        }

        await deactivateSubscription(ctx.user.id);
        return { success: true };
      }),

    // Manter createCheckout do Stripe como fallback
    createCheckout: protectedProcedure
      .input(z.object({
        planId: z.string(),
        origin: z.string(),
      }))
      .mutation(async ({ ctx, input }) => {
        const user = await getUserById(ctx.user.id);
        if (!user) throw new TRPCError({ code: "NOT_FOUND" });

        const url = await createCheckoutSession({
          planId: input.planId,
          userId: ctx.user.id,
          userEmail: user.email || "",
          userName: user.name || "",
          origin: input.origin,
          stripeCustomerId: user.stripeCustomerId,
        });

        return { url };
      }),

    manageBilling: protectedProcedure
      .input(z.object({ origin: z.string() }))
      .mutation(async ({ ctx, input }) => {
        const user = await getUserById(ctx.user.id);
        if (!user?.stripeCustomerId) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Nenhuma assinatura encontrada.",
          });
        }

        const url = await createBillingPortalSession({
          stripeCustomerId: user.stripeCustomerId,
          origin: input.origin,
        });

        return { url };
      }),
  }),

  // ── Admin ──
  admin: router({
    subscribers: protectedProcedure.query(async ({ ctx }) => {
      if (ctx.user.role !== "admin") {
        throw new TRPCError({ code: "FORBIDDEN", message: "Acesso restrito a administradores." });
      }
      const subscribers = await getAllSubscribers();
      const allPlans = await getAllPlans();
      const planMap = new Map(allPlans.map((p: PlanData) => [p.id, p]));

      return subscribers.map(s => {
        const plan = planMap.get(s.planId || "none");
        return {
          id: s.id,
          name: s.name,
          email: s.email,
          planId: s.planId,
          planName: plan?.name || "Sem plano",
          subscriptionStatus: s.subscriptionStatus,
          consultasUsed: s.consultasUsedThisMonth,
          consultasLimit: plan?.consultasLimit ?? 0,
          createdAt: s.createdAt,
          lastSignedIn: s.lastSignedIn,
        };
      });
    }),

    subscriptionStats: protectedProcedure.query(async ({ ctx }) => {
      if (ctx.user.role !== "admin") {
        throw new TRPCError({ code: "FORBIDDEN" });
      }
      return getSubscriptionStats();
    }),

    // ── Excluir usuário (Admin) ──
    deleteUser: protectedProcedure
      .input(z.object({ userId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        if (ctx.user.role !== "admin") {
          throw new TRPCError({ code: "FORBIDDEN", message: "Acesso restrito a administradores." });
        }
        // Não permitir excluir a si mesmo
        if (ctx.user.id === input.userId) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Você não pode excluir sua própria conta." });
        }
        await deleteUser(input.userId);
        return { success: true, message: "Usuário excluído com sucesso." };
      }),

    // ── Listar todos os usuários (Admin) ──
    allUsers: protectedProcedure.query(async ({ ctx }) => {
      if (ctx.user.role !== "admin") {
        throw new TRPCError({ code: "FORBIDDEN", message: "Acesso restrito a administradores." });
      }
      const all = await getAllUsers();
      const allPlans = await getAllPlans();
      const planMap = new Map(allPlans.map((p: PlanData) => [p.id, p]));

      return all.map(u => {
        const plan = planMap.get(u.planId || "none");
        return {
          id: u.id,
          name: u.name,
          email: u.email,
          planId: u.planId,
          planName: plan?.name || "Sem plano",
          subscriptionStatus: u.subscriptionStatus,
          consultasUsed: u.consultasUsedThisMonth,
          consultasLimit: plan?.consultasLimit ?? 0,
          loginMethod: u.loginMethod,
          createdAt: u.createdAt,
          lastSignedIn: u.lastSignedIn,
        };
      });
    }),

    // ── Plan Management (Admin CRUD) ──
    listPlans: protectedProcedure.query(async ({ ctx }) => {
      if (ctx.user.role !== "admin") {
        throw new TRPCError({ code: "FORBIDDEN", message: "Acesso restrito a administradores." });
      }
      const allPlans = await getAllPlans();
      return allPlans.map((p: PlanData) => ({
        ...p,
        priceFormatted: formatPrice(p.monthlyPrice),
      }));
    }),

    getPlan: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ ctx, input }) => {
        if (ctx.user.role !== "admin") {
          throw new TRPCError({ code: "FORBIDDEN" });
        }
        const plan = await getPlanByDbId(input.id);
        if (!plan) throw new TRPCError({ code: "NOT_FOUND", message: "Plano não encontrado." });
        return { ...plan, priceFormatted: formatPrice(plan.monthlyPrice) };
      }),

    createPlan: protectedProcedure
      .input(z.object({
        slug: z.string().min(2).max(32).regex(/^[a-z0-9_-]+$/, "Slug deve conter apenas letras minúsculas, números, hífen e underline."),
        name: z.string().min(1).max(64),
        description: z.string().max(500).optional(),
        monthlyPrice: z.number().int().min(0),
        consultasLimit: z.number().int().min(-1),
        features: z.array(z.string()).min(1),
        popular: z.boolean().optional(),
        sortOrder: z.number().int().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        if (ctx.user.role !== "admin") {
          throw new TRPCError({ code: "FORBIDDEN" });
        }

        // Verificar slug único
        const existing = await getPlanBySlug(input.slug);
        if (existing) {
          throw new TRPCError({ code: "CONFLICT", message: "Já existe um plano com este slug." });
        }

        // Se marcou como popular, desmarcar os outros
        if (input.popular) {
          const allP = await getAllPlans();
          for (const p of allP) {
            if (p.popular) {
              await updatePlan(p.dbId, { popular: false });
            }
          }
        }

        const id = await createPlan({
          slug: input.slug,
          name: input.name,
          description: input.description || "",
          monthlyPrice: input.monthlyPrice,
          consultasLimit: input.consultasLimit,
          features: input.features,
          popular: input.popular,
          sortOrder: input.sortOrder,
        });

        return { id, slug: input.slug };
      }),

    updatePlan: protectedProcedure
      .input(z.object({
        id: z.number(),
        slug: z.string().min(2).max(32).regex(/^[a-z0-9_-]+$/).optional(),
        name: z.string().min(1).max(64).optional(),
        description: z.string().max(500).optional(),
        monthlyPrice: z.number().int().min(0).optional(),
        consultasLimit: z.number().int().min(-1).optional(),
        features: z.array(z.string()).optional(),
        popular: z.boolean().optional(),
        active: z.boolean().optional(),
        sortOrder: z.number().int().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        if (ctx.user.role !== "admin") {
          throw new TRPCError({ code: "FORBIDDEN" });
        }

        const existing = await getPlanByDbId(input.id);
        if (!existing) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Plano não encontrado." });
        }

        // Verificar slug único se mudou
        if (input.slug && input.slug !== existing.id) {
          const slugExists = await getPlanBySlug(input.slug);
          if (slugExists) {
            throw new TRPCError({ code: "CONFLICT", message: "Já existe um plano com este slug." });
          }
        }

        // Se marcou como popular, desmarcar os outros
        if (input.popular) {
          const allP = await getAllPlans();
          for (const p of allP) {
            if (p.popular && p.dbId !== input.id) {
              await updatePlan(p.dbId, { popular: false });
            }
          }
        }

        const { id, ...updateData } = input;

        // Se preço mudou, invalidar cache do Stripe e limpar stripePriceId no banco
        if (input.monthlyPrice !== undefined && input.monthlyPrice !== existing.monthlyPrice) {
          (updateData as any).stripePriceId = null;
          // Limpar cache em memória para forçar recriação no próximo checkout
          invalidatePriceCache(existing.id);
        }

        await updatePlan(id, updateData as any);

        return { success: true };
      }),

    deletePlan: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        if (ctx.user.role !== "admin") {
          throw new TRPCError({ code: "FORBIDDEN" });
        }

        const existing = await getPlanByDbId(input.id);
        if (!existing) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Plano não encontrado." });
        }

        await deletePlan(input.id);
        return { success: true };
      }),

    syncPlanToStripe: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        if (ctx.user.role !== "admin") {
          throw new TRPCError({ code: "FORBIDDEN" });
        }

        const plan = await getPlanByDbId(input.id);
        if (!plan) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Plano não encontrado." });
        }

        try {
          const priceId = await ensureStripePriceForPlan(plan);
          return { success: true, stripePriceId: priceId, stripeProductId: plan.stripeProductId };
        } catch (err: any) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: `Erro ao sincronizar com Stripe: ${err.message}`,
          });
        }
      }),

    // ── Limpar registros simulados ──
    deleteSimulatedAnalyses: protectedProcedure
      .mutation(async ({ ctx }) => {
        if (ctx.user.role !== "admin") {
          throw new TRPCError({ code: "FORBIDDEN", message: "Acesso restrito a administradores." });
        }
        const count = await deleteSimulatedAnalyses();
        return { success: true, deleted: count, message: `${count} registro(s) simulado(s) removido(s) com sucesso.` };
      }),

    // ── Diagnóstico de email ──
    emailStatus: protectedProcedure.query(async ({ ctx }) => {
      if (ctx.user.role !== "admin") {
        throw new TRPCError({ code: "FORBIDDEN", message: "Acesso restrito a administradores." });
      }
      const { isEmailConfigured, verifyResendApiKey } = await import("./email");
      const configured = isEmailConfigured();
      let working = false;
      if (configured) {
        working = await verifyResendApiKey();
      }
      return { configured, working };
    }),

    // ── Zerar consultas do usuário ──
    resetUserConsultas: protectedProcedure
      .input(z.object({ userId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        if (ctx.user.role !== "admin") {
          throw new TRPCError({ code: "FORBIDDEN", message: "Acesso restrito a administradores." });
        }
        await resetUserConsultas(input.userId);
        return { success: true, message: "Consultas zeradas com sucesso." };
      }),

    // ── Dar consultas bônus ──
    addBonusConsultas: protectedProcedure
      .input(z.object({ userId: z.number(), bonus: z.number().int().min(1).max(1000) }))
      .mutation(async ({ ctx, input }) => {
        if (ctx.user.role !== "admin") {
          throw new TRPCError({ code: "FORBIDDEN", message: "Acesso restrito a administradores." });
        }
        await addBonusConsultas(input.userId, input.bonus);
        return { success: true, message: `${input.bonus} consulta(s) adicionada(s) com sucesso.` };
      }),

    // ── Mudar plano do usuário ──
    setUserPlan: protectedProcedure
      .input(z.object({ userId: z.number(), planSlug: z.string() }))
      .mutation(async ({ ctx, input }) => {
        if (ctx.user.role !== "admin") {
          throw new TRPCError({ code: "FORBIDDEN", message: "Acesso restrito a administradores." });
        }
        const plan = await getPlanBySlug(input.planSlug);
        if (!plan) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Plano não encontrado." });
        }
        await setUserPlan(input.userId, input.planSlug, plan.consultasLimit);
        return { success: true, message: `Plano alterado para ${plan.name} com sucesso.` };
      }),
  }),

  // ── Credit Analysis ──
  credit: router({
    analyze: protectedProcedure
      .input(z.object({ 
        document: z.string().min(11).max(18),
        bureau: z.enum(["boavista", "serasa_premium"]).optional().default("boavista")
      }))
      .mutation(async ({ ctx, input }) => {
        const cleaned = input.document.replace(/\D/g, "");
        if (!validateDocument(cleaned)) {
          const docType = detectDocumentType(cleaned);
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: docType === "cpf"
              ? "CPF inválido. Verifique os dígitos e tente novamente."
              : "CNPJ inválido. Verifique os dígitos e tente novamente.",
          });
        }

        // NOVO: Verificar saldo ANTES de tudo
        const custoConsulta = input.bureau === "serasa_premium" ? 15.00 : 6.50;
        const { getUserSaldo, debitSaldoFromUser, addSaldoToUser, insertTransaction } = await import("./db");
        const saldoAtual = await getUserSaldo(ctx.user.id);
        
        if (saldoAtual < custoConsulta) {
          throw new TRPCError({
            code: "PRECONDITION_FAILED",
            message: `Saldo insuficiente. Você tem R$ ${saldoAtual.toFixed(2)} e precisa de R$ ${custoConsulta.toFixed(2)}. Faltam R$ ${(custoConsulta - saldoAtual).toFixed(2)}.`
          });
        }

        // Debitar saldo ANTES da consulta
        await debitSaldoFromUser(ctx.user.id, custoConsulta);
        
        // Registrar transação de débito
        await insertTransaction({
          userId: ctx.user.id,
          tipo: "consulta",
          valor: String(-custoConsulta),
          descricao: `Consulta ${input.bureau === "serasa_premium" ? "Serasa Premium" : "Boa Vista"} - ${cleaned}`,
          bureauTipo: input.bureau,
          asaasPaymentId: null,
        });

        let result;
        try {
          result = await runCreditAnalysis(cleaned, input.bureau);
        } catch (err: any) {
          // SE FALHAR: estornar o saldo
          await addSaldoToUser(ctx.user.id, custoConsulta);
          await insertTransaction({
            userId: ctx.user.id,
            tipo: "estorno",
            valor: String(custoConsulta),
            descricao: `Estorno - falha na consulta ${input.bureau}`,
            bureauTipo: input.bureau,
            asaasPaymentId: null,
          });
          
          if (err instanceof ApiUnavailableError) {
            throw new TRPCError({
              code: "SERVICE_UNAVAILABLE",
              message: err.message,
            });
          }
          throw err;
        }

        const id = await insertCreditAnalysis({
          userId: ctx.user.id,
          cnpj: result.cadastral.cnpj,
          documentType: result.cadastral.documentType,
          companyName: result.cadastral.companyName,
          situacao: result.cadastral.situacao,
          dataAbertura: result.cadastral.dataAbertura,
          capitalSocial: String(result.cadastral.capitalSocial),
          naturezaJuridica: result.cadastral.naturezaJuridica,
          score: result.credit.score,
          hasProtestos: result.credit.hasProtestos,
          valorDivida: String(result.credit.valorDivida),
          quantidadeRestricoes: result.credit.quantidadeRestricoes,
          status: result.status,
          motivo: result.motivo,
          nomeFantasia: result.cadastral.nomeFantasia,
          atividadePrincipal: result.cadastral.atividadePrincipal,
          endereco: result.cadastral.endereco,
          bairro: result.cadastral.bairro,
          cidade: result.cadastral.cidade,
          uf: result.cadastral.uf,
          cep: result.cadastral.cep,
          telefone: result.cadastral.telefone,
          email: result.cadastral.email,
          porte: result.cadastral.porte,
          socios: JSON.stringify(result.cadastral.socios),
          scoreMensagem: result.credit.scoreMensagem,
          protestosJson: JSON.stringify(result.credit.protestos),
          pendenciasJson: JSON.stringify(result.credit.pendenciasFinanceiras),
          chequesSemFundo: result.credit.chequesSemFundo,
          chequesSustados: result.credit.chequesSustados,
          cadastralDataSource: result.cadastral.dataSource,
          creditDataSource: result.credit.dataSource,
          bureau: input.bureau,
        });

        // Increment consultas used (para estatísticas)
        await incrementConsultasUsed(ctx.user.id);

        // Enviar alerta ao proprietário se alto risco
        if (isHighRisk(result)) {
          try {
            const sourceInfo = result.credit.dataSource === "apifull_boavista"
              ? " (dados reais Boa Vista SCPC)"
              : result.credit.dataSource === "apifull_serasa_premium"
              ? " (dados reais Serasa Premium)"
              : " (dados simulados)";
            const docLabel = result.cadastral.documentType === "cpf" ? "CPF" : "CNPJ";
            await notifyOwner({
              title: `Alerta de Alto Risco - ${result.cadastral.companyName}`,
              content: `Uma análise de crédito identificou alto risco${sourceInfo}:\n\n**${docLabel}:** ${result.cadastral.cnpj}\n**Nome:** ${result.cadastral.companyName}\n**Score:** ${result.credit.score}/1000\n**Status:** ${result.status}\n**Motivo:** ${result.motivo}\n\nConsulta realizada por: ${ctx.user.name || ctx.user.email || "Usuário #" + ctx.user.id}`,
            });
            await markAlertSent(id);
          } catch (e) {
            console.error("[Alert] Failed to notify owner:", e);
          }
        }

        return { id, ...result };
      }),

    getById: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ ctx, input }) => {
        const analysis = await getCreditAnalysisById(input.id);
        if (!analysis) throw new TRPCError({ code: "NOT_FOUND", message: "Análise não encontrada." });
        // Usuários normais só podem ver suas próprias análises
        if (ctx.user.role !== "admin" && analysis.userId !== ctx.user.id) {
          throw new TRPCError({ code: "FORBIDDEN", message: "Você não tem permissão para ver esta análise." });
        }
        return analysis;
      }),

    list: protectedProcedure
      .input(
        z.object({
          status: z.string().optional(),
          dateFrom: z.string().optional(),
          dateTo: z.string().optional(),
          search: z.string().optional(),
          limit: z.number().min(1).max(100).optional(),
          offset: z.number().min(0).optional(),
        }).optional()
      )
      .query(async ({ ctx, input }) => {
        // Usuários normais só veem suas próprias consultas
        // Admins veem todas
        const userId = ctx.user.role === "admin" ? undefined : ctx.user.id;
        return listCreditAnalyses({
          userId,
          status: input?.status,
          dateFrom: input?.dateFrom ? new Date(input.dateFrom) : undefined,
          dateTo: input?.dateTo ? new Date(input.dateTo) : undefined,
          search: input?.search,
          limit: input?.limit,
          offset: input?.offset,
        });
      }),

    stats: protectedProcedure.query(async ({ ctx }) => {
      // Usuários normais veem stats apenas das suas consultas
      // Admins veem stats globais
      const userId = ctx.user.role === "admin" ? undefined : ctx.user.id;
      return getDashboardStats(userId);
    }),


    validateDocument: publicProcedure
      .input(z.object({ document: z.string() }))
      .query(({ input }) => {
        const cleaned = input.document.replace(/\D/g, "");
        const isValid = validateDocument(cleaned);
        const docType = detectDocumentType(cleaned);
        return {
          isValid,
          documentType: docType,
          formatted: isValid ? formatDocument(cleaned) : null,
        };
      }),
  }),

  // ── Wallet / Carteira ──
  wallet: router({
    getSaldo: protectedProcedure.query(async ({ ctx }) => {
      const { getUserSaldo } = await import("./db");
      const saldo = await getUserSaldo(ctx.user.id);
      return { saldo };
    }),

    getTransacoes: protectedProcedure
      .input(z.object({ 
        limit: z.number().default(20),
        offset: z.number().default(0) 
      }))
      .query(async ({ ctx, input }) => {
        const { listTransactions } = await import("./db");
        return await listTransactions(ctx.user.id, input.limit, input.offset);
      }),

    adicionarSaldo: protectedProcedure
      .input(z.object({
        valor: z.number().min(5).max(1000),
        metodoPagamento: z.enum(["PIX", "CREDIT_CARD", "BOLETO"])
      }))
      .mutation(async ({ ctx, input }) => {
        // Cria cobrança no Asaas
        const payment = await createAsaasPayment({
          customer: ctx.user.asaasCustomerId!,
          value: input.valor,
          billingType: input.metodoPagamento as BillingType,
          description: `Recarga de créditos - Maxxi Analise`,
        });

        return { 
          paymentUrl: payment.invoiceUrl, 
          paymentId: payment.id 
        };
      }),
  }),
});

export type AppRouter = typeof appRouter;
