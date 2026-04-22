import { describe, expect, it } from "vitest";
import { Resend } from "resend";

describe("Resend Email Integration", () => {
  it("verifica que a API Key do Resend é válida e pode enviar emails", async () => {
    const apiKey = process.env.RESEND_API_KEY;
    expect(apiKey).toBeTruthy();

    const resend = new Resend(apiKey);

    // Enviar email de teste para o endereço de teste do Resend
    // delivered@resend.dev é um endereço especial que sempre aceita
    const { data, error } = await resend.emails.send({
      from: "Maxxi Analise Pro <onboarding@resend.dev>",
      to: ["delivered@resend.dev"],
      subject: "Teste de API Key - Maxxi Analise Pro",
      html: "<p>Teste de verificação da API Key do Resend.</p>",
    });

    expect(error).toBeNull();
    expect(data).toBeTruthy();
    expect(data?.id).toBeTruthy();
  });
});
