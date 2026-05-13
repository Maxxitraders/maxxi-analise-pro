import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { consultarMargemConsignavel, validateCpf } from "./creditEngine";

// ── Fixtures ──────────────────────────────────────────────────────────────────

const CPF_VALIDO = "52998224725";
const MATRICULA_VALIDA = "09613446080166608132";
const CNPJ_VALIDO = "11222333000181";

const INPUT_VALIDO = {
  cpf: CPF_VALIDO,
  matricula: MATRICULA_VALIDA,
  cnpj: CNPJ_VALIDO,
  userId: 1,
};

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
    expect(validateCpf("12345678901")).toBe(false);
  });

  it("aceita CPF formatado com pontos e hífen", () => {
    expect(validateCpf("529.982.247-25")).toBe(true);
  });
});

// ── Validação de inputs ───────────────────────────────────────────────────────

describe("consultarMargemConsignavel — validação de entrada", () => {
  it("lança erro para CPF com menos de 11 dígitos", async () => {
    await expect(
      consultarMargemConsignavel({ cpf: "123", matricula: MATRICULA_VALIDA, cnpj: CNPJ_VALIDO, userId: 1 })
    ).rejects.toThrow("CPF deve ter 11 dígitos");
  });

  it("lança erro para CPF com mais de 11 dígitos", async () => {
    await expect(
      consultarMargemConsignavel({ cpf: "123456789012", matricula: MATRICULA_VALIDA, cnpj: CNPJ_VALIDO, userId: 1 })
    ).rejects.toThrow("CPF deve ter 11 dígitos");
  });

  it("lança erro para CPF vazio", async () => {
    await expect(
      consultarMargemConsignavel({ cpf: "", matricula: MATRICULA_VALIDA, cnpj: CNPJ_VALIDO, userId: 1 })
    ).rejects.toThrow("CPF deve ter 11 dígitos");
  });

  it("lança erro para matrícula vazia", async () => {
    await expect(
      consultarMargemConsignavel({ cpf: CPF_VALIDO, matricula: "", cnpj: CNPJ_VALIDO, userId: 1 })
    ).rejects.toThrow("Matrícula é obrigatória");
  });

  it("lança erro para matrícula só com espaços", async () => {
    await expect(
      consultarMargemConsignavel({ cpf: CPF_VALIDO, matricula: "   ", cnpj: CNPJ_VALIDO, userId: 1 })
    ).rejects.toThrow("Matrícula é obrigatória");
  });

  it("lança erro para CNPJ com menos de 14 dígitos", async () => {
    await expect(
      consultarMargemConsignavel({ cpf: CPF_VALIDO, matricula: MATRICULA_VALIDA, cnpj: "123", userId: 1 })
    ).rejects.toThrow("CNPJ deve ter 14 dígitos");
  });

  it("lança erro para CNPJ com mais de 14 dígitos", async () => {
    await expect(
      consultarMargemConsignavel({ cpf: CPF_VALIDO, matricula: MATRICULA_VALIDA, cnpj: "123456789012345", userId: 1 })
    ).rejects.toThrow("CNPJ deve ter 14 dígitos");
  });
});

// ── Modo simulado (sem API_FULL_TOKEN) ────────────────────────────────────────

describe("consultarMargemConsignavel — modo simulado", () => {
  beforeEach(() => {
    vi.stubEnv("API_FULL_TOKEN", "");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("retorna dataSource=simulado quando token não configurado", async () => {
    const result = await consultarMargemConsignavel(INPUT_VALIDO);
    expect(result.dataSource).toBe("simulado");
  });

  it("retorna CPF formatado com pontos e hífen", async () => {
    const result = await consultarMargemConsignavel(INPUT_VALIDO);
    expect(result.cpf).toBe("529.982.247-25");
  });

  it("ecoa matrícula e CNPJ passados como entrada", async () => {
    const result = await consultarMargemConsignavel(INPUT_VALIDO);
    expect(result.matricula).toBe(MATRICULA_VALIDA);
    expect(result.cnpj).toBe(CNPJ_VALIDO);
  });

  it("retorna campos numéricos com tipo number", async () => {
    const result = await consultarMargemConsignavel(INPUT_VALIDO);
    expect(typeof result.margemDisponivel).toBe("number");
    expect(typeof result.margemUtilizada).toBe("number");
    expect(typeof result.margemTotal).toBe("number");
    expect(typeof result.margemCartaoDisponivel).toBe("number");
    expect(typeof result.margemCartaoUtilizada).toBe("number");
  });

  it("margem utilizada + disponível não excede total (simulado)", async () => {
    const r = await consultarMargemConsignavel(INPUT_VALIDO);
    expect(r.margemUtilizada + r.margemDisponivel).toBeLessThanOrEqual(r.margemTotal + 0.01);
  });
});

// ── Com token configurado (mock fetch) ────────────────────────────────────────

describe("consultarMargemConsignavel — com token e fetch mockado", () => {
  beforeEach(() => {
    vi.stubEnv("API_FULL_TOKEN", "token-de-teste-123");
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("retorna dados normalizados da API quando fetch é bem-sucedido", async () => {
    const mockApiResponse = {
      nomeCompleto: "MARIA JOSE DA SILVA",
      dataNascimento: "15/06/1985",
      margemDisponivel: 1200.50,
      margemUtilizada: 800.00,
      margemTotal: 2000.50,
      margemCartaoDisponivel: 300.00,
      margemCartaoUtilizada: 150.00,
      orgao: "INSS",
      competencia: "05/2026",
    };

    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => mockApiResponse,
    });

    const result = await consultarMargemConsignavel(INPUT_VALIDO);

    expect(result.dataSource).toBe("apifull");
    expect(result.nomeCompleto).toBe("MARIA JOSE DA SILVA");
    expect(result.margemDisponivel).toBe(1200.50);
    expect(result.margemTotal).toBe(2000.50);
    expect(result.orgao).toBe("INSS");
  });

  it("aceita resposta com wrapper 'dados'", async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({
        dados: { nomeCompleto: "JOSE FILHO", margemDisponivel: 500, margemUtilizada: 100, margemTotal: 600 },
      }),
    });

    const result = await consultarMargemConsignavel(INPUT_VALIDO);
    expect(result.nomeCompleto).toBe("JOSE FILHO");
    expect(result.margemDisponivel).toBe(500);
  });

  it("lança ApiUnavailableError quando API retorna HTTP não-ok", async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: false,
      status: 422,
      text: async () => "Unprocessable Entity",
    });

    await expect(consultarMargemConsignavel(INPUT_VALIDO)).rejects.toThrow(
      "API de margem consignável retornou HTTP 422"
    );
  });

  it("lança ApiUnavailableError para erro de rede", async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockRejectedValue(
      new TypeError("Failed to fetch")
    );

    await expect(consultarMargemConsignavel(INPUT_VALIDO)).rejects.toThrow(
      "Não foi possível consultar a margem consignável"
    );
  });

  it("usa endpoint correto /v3/operacoes/consignado-privado/consultar-margem", async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({}),
    });

    await consultarMargemConsignavel(INPUT_VALIDO).catch(() => {});

    const [url] = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(url).toContain("/v3/operacoes/consignado-privado/consultar-margem");
  });

  it("envia cpf, matricula e cnpj no body", async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({}),
    });

    await consultarMargemConsignavel(INPUT_VALIDO).catch(() => {});

    const [, options] = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    const body = JSON.parse(options.body as string);
    expect(body.cpf).toBe(CPF_VALIDO);
    expect(body.matricula).toBe(MATRICULA_VALIDA);
    expect(body.cnpj).toBe(CNPJ_VALIDO);
  });

  it("envia header Authorization Bearer", async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({}),
    });

    await consultarMargemConsignavel(INPUT_VALIDO).catch(() => {});

    const [, options] = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(options.headers["Authorization"]).toBe("Bearer token-de-teste-123");
  });
});
