import { describe, expect, it } from "vitest";

// A API key é injetada pelo servidor em runtime, pode não estar disponível no vitest
// Usamos a key diretamente para testar a conexão
const ASAAS_KEY = process.env.ASAAS_API_KEY || "";

describe("Asaas API Key Validation", () => {
  it("should be able to authenticate with Asaas API", async () => {
    if (!ASAAS_KEY) {
      console.log("[SKIP] ASAAS_API_KEY n\u00e3o dispon\u00edvel no ambiente de teste");
      return;
    }

    const response = await fetch("https://api.asaas.com/v3/finance/getCurrentBalance", {
      method: "GET",
      headers: {
        "accept": "application/json",
        "access_token": ASAAS_KEY,
      },
    });

    // 200 = sucesso, 401 = chave inv\u00e1lida
    expect(response.status).toBe(200);

    const data = await response.json();
    expect(data).toHaveProperty("totalBalance");
  });

  it("should validate Asaas API key format", () => {
    if (!ASAAS_KEY) {
      console.log("[SKIP] ASAAS_API_KEY n\u00e3o dispon\u00edvel no ambiente de teste");
      return;
    }
    expect(ASAAS_KEY.startsWith("$aact_")).toBe(true);
  });
});
