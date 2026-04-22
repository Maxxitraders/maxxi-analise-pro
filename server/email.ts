/**
 * Módulo de envio de emails usando Resend.
 * Usado para recuperação de senha e notificações ao cliente.
 */

import { Resend } from "resend";

function getResend(): Resend | null {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.warn("[Email] RESEND_API_KEY não configurada");
    return null;
  }
  return new Resend(apiKey);
}

const DEFAULT_FROM = "Maxxi Analise Pro <noreply@maxxianalise.com>";

export async function sendPasswordResetEmail(params: {
  to: string;
  resetLink: string;
  userName?: string;
}): Promise<boolean> {
  const resend = getResend();
  if (!resend) {
    console.warn("[Email] Não foi possível enviar email de recuperação: Resend não configurado");
    return false;
  }

  const { to, resetLink, userName } = params;
  const greeting = userName ? `Olá, ${userName}` : "Olá";

  try {
    const { data, error } = await resend.emails.send({
      from: DEFAULT_FROM,
      to: [to],
      subject: "Redefinição de Senha - Maxxi Analise Pro",
      html: `
        <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="text-align: center; margin-bottom: 30px;">
            <h1 style="color: #1a1a2e; font-size: 24px; margin: 0;">Maxxi Analise Pro</h1>
            <p style="color: #666; font-size: 14px; margin: 4px 0 0 0;">Análise de Crédito Empresarial</p>
          </div>
          
          <div style="background: #f8f9fa; border-radius: 12px; padding: 32px; margin-bottom: 24px;">
            <h2 style="color: #1a1a2e; font-size: 20px; margin: 0 0 16px 0;">Redefinição de Senha</h2>
            <p style="color: #444; font-size: 15px; line-height: 1.6; margin: 0 0 12px 0;">
              ${greeting},
            </p>
            <p style="color: #444; font-size: 15px; line-height: 1.6; margin: 0 0 24px 0;">
              Recebemos uma solicitação para redefinir a senha da sua conta. Clique no botão abaixo para criar uma nova senha:
            </p>
            <div style="text-align: center; margin: 24px 0;">
              <a href="${resetLink}" 
                 style="display: inline-block; background: #1a1a2e; color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-size: 15px; font-weight: 600;">
                Redefinir Minha Senha
              </a>
            </div>
            <p style="color: #888; font-size: 13px; line-height: 1.5; margin: 24px 0 0 0;">
              Se você não solicitou esta redefinição, ignore este email. O link expira em <strong>1 hora</strong>.
            </p>
          </div>
          
          <div style="text-align: center; padding-top: 16px; border-top: 1px solid #eee;">
            <p style="color: #aaa; font-size: 12px; margin: 0;">
              Este email foi enviado automaticamente pela plataforma Maxxi Analise Pro.
            </p>
            <p style="color: #aaa; font-size: 12px; margin: 4px 0 0 0;">
              Se o botão não funcionar, copie e cole este link no navegador:<br/>
              <a href="${resetLink}" style="color: #666; word-break: break-all;">${resetLink}</a>
            </p>
          </div>
        </div>
      `,
    });

    if (error) {
      console.error("[Email] Erro ao enviar email de recuperação:", error);
      return false;
    }

    console.log("[Email] Email de recuperação enviado com sucesso:", data?.id, "para:", to);
    return true;
  } catch (error) {
    console.error("[Email] Exceção ao enviar email:", error);
    return false;
  }
}

export async function sendWelcomeEmail(params: {
  to: string;
  userName: string;
}): Promise<boolean> {
  const resend = getResend();
  if (!resend) return false;

  try {
    const { error } = await resend.emails.send({
      from: DEFAULT_FROM,
      to: [params.to],
      subject: "Bem-vindo(a) à Maxxi Analise Pro!",
      html: `
        <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="text-align: center; margin-bottom: 30px;">
            <h1 style="color: #1a1a2e; font-size: 24px; margin: 0;">Maxxi Analise Pro</h1>
            <p style="color: #666; font-size: 14px; margin: 4px 0 0 0;">Análise de Crédito Empresarial</p>
          </div>
          
          <div style="background: #f8f9fa; border-radius: 12px; padding: 32px;">
            <h2 style="color: #1a1a2e; font-size: 20px; margin: 0 0 16px 0;">Bem-vindo(a), ${params.userName}!</h2>
            <p style="color: #444; font-size: 15px; line-height: 1.6; margin: 0 0 16px 0;">
              Sua conta na Maxxi Analise Pro foi criada com sucesso. Agora você pode realizar análises de crédito de CPF e CNPJ com dados reais.
            </p>
            <p style="color: #444; font-size: 15px; line-height: 1.6; margin: 0 0 24px 0;">
              Para começar, escolha um plano de assinatura que atenda às suas necessidades.
            </p>
            <div style="text-align: center;">
              <a href="https://maxxianalise.com/planos" 
                 style="display: inline-block; background: #1a1a2e; color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-size: 15px; font-weight: 600;">
                Ver Planos
              </a>
            </div>
          </div>
          
          <div style="text-align: center; padding-top: 16px; border-top: 1px solid #eee; margin-top: 24px;">
            <p style="color: #aaa; font-size: 12px; margin: 0;">
              Este email foi enviado automaticamente pela plataforma Maxxi Analise Pro.
            </p>
          </div>
        </div>
      `,
    });

    if (error) {
      console.error("[Email] Erro ao enviar email de boas-vindas:", error);
      return false;
    }
    return true;
  } catch (error) {
    console.error("[Email] Exceção ao enviar email de boas-vindas:", error);
    return false;
  }
}

/**
 * Verifica se a API Key do Resend é válida fazendo uma chamada leve.
 */
export async function verifyResendApiKey(): Promise<boolean> {
  const resend = getResend();
  if (!resend) return false;

  try {
    // Listar domínios é uma chamada leve que verifica se a key é válida
    const { error } = await resend.domains.list();
    if (error) {
      console.error("[Email] API Key do Resend inválida:", error);
      return false;
    }
    return true;
  } catch (error) {
    console.error("[Email] Erro ao verificar API Key:", error);
    return false;
  }
}
