import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  consultarMargemConsignavel,
  validateCpf,
} from "./creditEngine";

// ── Helpers ──────────────────────────────────────────────────────────────────

const CPF_VALIDO = "52998224725"; // CPF de teste válido
const CPF_INVALIDO = "12345678901";

// ── validateCpf ───────────────────────────────────────────────────────────────

describe("validateCpf", () => {
  it("retorna true para CPF válido", () => {
    expect(validateCpf(CPF_VALIDO)).toBe(true);
  });

  it("retorna false para CPF com dígitos repetidos", () => {
    expect(validateCpf("11111111111")).toBe(false);
  });

  it("retorna false para CPF com comprimento errado", () => {
    expect(validateCpf("1234567890")).toBe(false);
  });

  it("retorna false para CPF inválido", () => {
    expect(validateCpf(CPF_INVALIDO)).toBe(false);
  });

  it("aceita CPF formatado com pontos e hífen", () => {
    expect(validateCpf("529.982.247-25")).toBe(true);
  });
});

// ── consultarMargemConsignavel — modo simulado (sem API_FULL_TOKEN) ────────────

describe("consultarMargemConsignavel — modo simulado", () => {
  beforeEach(() => {
    vi.stubEnv("API_FULL_TOKEN", "");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("retorna resultado simulado quando token não configurado", async () => {
    const result = await consultarMargemConsignavel(CPF_VALIDO);

    expect(result.dataSource).toBe("simulado");
    expect(result.cpf).toMatch(/\d{3}\.\d{3}\.\d{3}-\d{2}/);
    expect(typeof result.margemDisponivel).toBe("number");
    expect(typeof result.margemUtilizada).toBe("number");
    expect(typeof result.margemTotal).toBe("number");
    expect(typeof result.margemCartaoDisponivel).toBe("number");
    expect(typeof result.margemCartaoUtilizada).toBe("number");
  });

  it("margem disponível + utilizada não excede total (simulado)", async () => {
    const result = await consultarMargemConsignavel(CPF_VALIDO);
    expect(result.margemDisponivel + result.margemUtilizada).toBeLessThanOrEqual(
      result.margemTotal + 0.01 // tolerância de arredondamento
    );
  });

  it("retorna CPF formatado corretamente", async () => {
    const result = await consultarMargemConsignavel(CPF_VALIDO);
    expect(result.cpf).toBe("529.982.247-25");
  });
});

// ── consultarMargemConsignavel — CPF inválido ─────────────────────────────────

describe("consultarMargemConsignavel — validação de entrada", () => {
  it("lança erro para CPF com comprimento errado", async () => {
    await expect(consultarMargemConsignavel("123")).rejects.toThrow(
      "CPF inválido para consulta de margem consignável"
    );
  });

  it("lança erro para string vazia", async () => {
    await expect(consultarMargemConsignavel("")).rejects.toThrow(
      "CPF inválido para consulta de margem consignável"
    );
  });
});

// ── consultarMargemConsignavel — com token (mock fetch) ──────────────────────

describe("consultarMargemConsignavel — com token configurado", () => {
  const mockToken = "test-token-123";

  beforeEach(() => {
    vi.stubEnv("API_FULL_TOKEN", mockToken);
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("retorna dados da API quando fetch é bem-sucedido", async () => {
    const mockResponse = {
      dados: {
        nome: "JOÃO DA SILVA",
        dataNascimento: "15/03/1980",
        margemDisponivel: 1200.50,
        margemUtilizada: 800.00,
        margemTotal: 2000.50,
        margemCartaoDisponivel: 300.00,
        margemCartaoUtilizada: 150.00,
        orgao: "INSS",
        competencia: "05/2026",
      },
    };

    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => mockResponse,
    });

    const result = await consultarMargemConsignavel(CPF_VALIDO);

    expect(result.dataSource).toBe("apifull");
    expect(result.nomeCompleto).toBe("JOÃO DA SILVA");
    expect(result.margemDisponivel).toBe(1200.5);
    expect(result.margemTotal).toBe(2000.5);
    expect(result.orgao).toBe("INSS");
  });

  it("lança ApiUnavailableError quando API retorna HTTP 500", async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: false,
      status: 500,
    });

    await expect(consultarMargemConsignavel(CPF_VALIDO)).rejects.toThrow(
      "API de margem consignável retornou HTTP 500"
    );
  });

  it("lança ApiUnavailableError quando fetch lança exceção de rede", async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockRejectedValue(
      new TypeError("Failed to fetch")
    );

    await expect(consultarMargemConsignavel(CPF_VALIDO)).rejects.toThrow(
      "Não foi possível consultar a margem consignável"
    );
  });

  it("envia CPF limpo (só dígitos) no body da requisição", async () => {
    const mockResponse = { dados: {} };
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => mockResponse,
    });

    await consultarMargemConsignavel("529.982.247-25").catch(() => {});

    const [, options] = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    const body = JSON.parse(options.body as string);
    expect(body.document).toBe(CPF_VALIDO);
  });
});
