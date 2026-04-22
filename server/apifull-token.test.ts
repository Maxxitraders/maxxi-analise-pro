import { describe, expect, it } from "vitest";

describe("API Full Token Validation", () => {
  it("API_FULL_TOKEN is configured and API responds", async () => {
    const token = process.env.API_FULL_TOKEN;
    expect(token).toBeDefined();
    expect(token!.length).toBeGreaterThan(5);

    // Make a lightweight test request to the API Full endpoint
    const response = await fetch("https://api.apifull.com.br/api/ap-boavista", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "*/*",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        document: "33000167000101", // Petrobras CNPJ for testing
        link: "ap-boavista",
      }),
      signal: AbortSignal.timeout(30000),
    });

    // A valid token should return 200 with status "sucesso"
    // An invalid token returns 400 with "Token inválido!"
    const data = await response.json().catch(() => ({}));

    if (response.ok && data.status === "sucesso") {
      // Token válido e com saldo
      expect(data.dados).toBeDefined();
      expect(data.dados.consultaCredito).toBeDefined();
      console.log("[API Full] Token válido com saldo! Score:", data.dados.consultaCredito.score?.score);
    } else if (data.message?.includes("Token inválido")) {
      // Token inválido - falha
      throw new Error("Token da API Full é inválido. Por favor, forneça um token correto.");
    } else if (data.message?.includes("Sem saldo")) {
      // Token válido mas sem saldo - aceitável (token está correto)
      console.log("[API Full] Token válido! Sem saldo disponível para consultas.");
      expect(data.status).toBe("error");
    } else {
      // Outros erros (rate limit, server error)
      console.warn(`[API Full] HTTP ${response.status}:`, data.message || "erro desconhecido");
      expect([400, 429, 500, 502, 503]).toContain(response.status);
    }
  }, 35000);
});
