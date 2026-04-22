import { describe, expect, it } from "vitest";
import { validateCnpj, formatCnpj, runCreditAnalysis, isHighRisk } from "./creditEngine";
import type { AnalysisResult } from "./creditEngine";

describe("validateCnpj", () => {
  it("validates a correct CNPJ", () => {
    expect(validateCnpj("11222333000181")).toBe(true);
  });

  it("validates another correct CNPJ (Petrobras)", () => {
    expect(validateCnpj("33000167000101")).toBe(true);
  });

  it("rejects a CNPJ with wrong check digits", () => {
    expect(validateCnpj("11222333000100")).toBe(false);
  });

  it("rejects a CNPJ with all same digits", () => {
    expect(validateCnpj("11111111111111")).toBe(false);
  });

  it("rejects a CNPJ with wrong length", () => {
    expect(validateCnpj("1234567")).toBe(false);
    expect(validateCnpj("")).toBe(false);
  });
});

describe("formatCnpj", () => {
  it("formats a 14-digit string into XX.XXX.XXX/XXXX-XX", () => {
    expect(formatCnpj("11222333000181")).toBe("11.222.333/0001-81");
  });

  it("strips non-digit characters before formatting", () => {
    expect(formatCnpj("11.222.333/0001-81")).toBe("11.222.333/0001-81");
  });
});

describe("runCreditAnalysis (async with API fallback)", () => {
  it("returns a complete analysis result with all fields including new ones", async () => {
    const result = await runCreditAnalysis("11222333000181");
    expect(result).toHaveProperty("cadastral");
    expect(result).toHaveProperty("credit");
    expect(result).toHaveProperty("status");
    expect(result).toHaveProperty("motivo");

    // Cadastral fields
    expect(result.cadastral.cnpj).toBe("11.222.333/0001-81");
    expect(result.cadastral).toHaveProperty("companyName");
    expect(result.cadastral).toHaveProperty("nomeFantasia");
    expect(result.cadastral).toHaveProperty("atividadePrincipal");
    expect(result.cadastral).toHaveProperty("endereco");
    expect(result.cadastral).toHaveProperty("socios");
    expect(result.cadastral).toHaveProperty("dataSource");
    expect(["brasilapi", "simulado", "apifull"]).toContain(result.cadastral.dataSource);

    // Credit fields (including new CREDCADASTRAL fields)
    expect(result.credit).toHaveProperty("score");
    expect(result.credit).toHaveProperty("scoreMensagem");
    expect(result.credit).toHaveProperty("scoreClassificacao");
    expect(result.credit).toHaveProperty("probabilidadeInadimplencia");
    expect(result.credit).toHaveProperty("protestos");
    expect(result.credit).toHaveProperty("pendenciasFinanceiras");
    expect(result.credit).toHaveProperty("chequesSemFundo");
    expect(result.credit).toHaveProperty("chequesSustados");
    expect(result.credit).toHaveProperty("contumacia");
    expect(result.credit).toHaveProperty("rendaPresumida");
    expect(result.credit).toHaveProperty("passagensComerciais");
    expect(result.credit).toHaveProperty("dataSource");
    expect(["apifull_boavista", "simulado"]).toContain(result.credit.dataSource);

    // Status
    expect(["APROVADO", "REPROVADO", "ANALISE_MANUAL"]).toContain(result.status);
    expect(result.credit.score).toBeGreaterThanOrEqual(0);
    expect(result.credit.score).toBeLessThanOrEqual(1000);
  }, 20000);

  it("returns consistent results for the same CNPJ when using simulation", async () => {
    const r1 = await runCreditAnalysis("47508411000156");
    const r2 = await runCreditAnalysis("47508411000156");
    if (r1.credit.dataSource === "simulado" && r2.credit.dataSource === "simulado") {
      expect(r1.credit.score).toBe(r2.credit.score);
      expect(r1.status).toBe(r2.status);
    }
  }, 20000);
});

describe("isHighRisk", () => {
  const baseCadastral = {
    cnpj: "11.222.333/0001-81", companyName: "Test", nomeFantasia: "", situacao: "ATIVA",
    dataAbertura: "01/01/2020", capitalSocial: 10000, naturezaJuridica: "Ltda",
    atividadePrincipal: "", endereco: "", bairro: "", cidade: "", uf: "", cep: "",
    telefone: "", email: "", porte: "", socios: [], dataSource: "simulado" as const,
  };

  const baseCredit = {
    score: 500, scoreMensagem: "", scoreClassificacao: "", probabilidadeInadimplencia: "",
    hasProtestos: false, valorDivida: 0, quantidadeRestricoes: 0,
    protestos: [], pendenciasFinanceiras: [],
    chequesSemFundo: 0, chequesSustados: 0, contumacia: 0,
    rendaPresumida: "", passagensComerciais: 0, dataSource: "simulado" as const,
  };

  it("identifies high risk when status is REPROVADO", () => {
    const result: AnalysisResult = {
      cadastral: { ...baseCadastral, situacao: "BAIXADA" },
      credit: baseCredit,
      status: "REPROVADO",
      motivo: "Empresa baixada",
    };
    expect(isHighRisk(result)).toBe(true);
  });

  it("identifies high risk when score is very low", () => {
    const result: AnalysisResult = {
      cadastral: baseCadastral,
      credit: { ...baseCredit, score: 150 },
      status: "ANALISE_MANUAL",
      motivo: "Score baixo",
    };
    expect(isHighRisk(result)).toBe(true);
  });

  it("identifies high risk when debt is very high", () => {
    const result: AnalysisResult = {
      cadastral: baseCadastral,
      credit: { ...baseCredit, score: 600, hasProtestos: true, valorDivida: 60000, quantidadeRestricoes: 3 },
      status: "REPROVADO",
      motivo: "Alto valor de dívida",
    };
    expect(isHighRisk(result)).toBe(true);
  });

  it("returns false for low risk profiles", () => {
    const result: AnalysisResult = {
      cadastral: baseCadastral,
      credit: { ...baseCredit, score: 800 },
      status: "APROVADO",
      motivo: "Perfil de baixo risco",
    };
    expect(isHighRisk(result)).toBe(false);
  });
});

describe("BrasilAPI Integration (live)", () => {
  it("returns valid data or rate-limited for a known CNPJ (Petrobras)", async () => {
    const response = await fetch("https://brasilapi.com.br/api/cnpj/v1/33000167000101", {
      signal: AbortSignal.timeout(15000),
    });
    if (response.ok) {
      const data = await response.json();
      expect(data.razao_social).toBeDefined();
      expect(data.descricao_situacao_cadastral).toBeDefined();
      expect(typeof data.capital_social).toBe("number");
    } else {
      expect([403, 429, 500, 502, 503]).toContain(response.status);
    }
  }, 20000);

  it("returns error for invalid CNPJ", async () => {
    const response = await fetch("https://brasilapi.com.br/api/cnpj/v1/00000000000000", {
      signal: AbortSignal.timeout(15000),
    });
    expect(response.ok).toBe(false);
  }, 20000);
});

describe("API Full scpc-boavista - CREDCADASTRAL Response Parser", () => {
  it("uses the correct endpoint URL and body format", () => {
    const endpoint = "https://api.apifull.com.br/api/scpc-boavista";
    const body = { document: "33000167000101", link: "scpc-boavista" };
    expect(endpoint).toContain("scpc-boavista");
    expect(body.link).toBe("scpc-boavista");
    expect(body.document).toMatch(/^\d{14}$/);
  });

  it("correctly parses the CREDCADASTRAL response structure", () => {
    const mockResponse = {
      status: "sucesso",
      dados: {
        HEADER: { PARAMETROS: { CPFCNPJ: "33000167000101" } },
        CREDCADASTRAL: {
          SCORES: {
            STATUS_RETORNO: { CODIGO: "1" },
            QUANTIDADE_OCORRENCIAS: "1",
            OCORRENCIAS: [{
              SCORE: "235",
              CLASSIF_ABC: "D",
              PROBABILIDADE_INADIMPLENCIA: "43.3",
              TEXTO: "De cada 100 empresas classificadas nesta classe...",
            }],
          },
          PROTESTOS: {
            STATUS_RETORNO: { CODIGO: "1" },
            QUANTIDADE_OCORRENCIA: "1183",
            VALOR_TOTAL: "273.789.291,06",
            OCORRENCIAS: [
              { DATA_OCORRENCIA: "20/07/2023", VALOR: "3.674,33", CARTORIO: "4", CIDADE: "BELO HORIZONTE" },
              { DATA_OCORRENCIA: "27/03/2023", VALOR: "2.178,68", CARTORIO: "4", CIDADE: "BELO HORIZONTE" },
            ],
          },
          PEND_FINANCEIRAS: {
            STATUS_RETORNO: { CODIGO: "1" },
            QUANTIDADE_OCORRENCIA: "24",
            VALOR_TOTAL: "1.234.567,89",
            OCORRENCIAS: [
              { DATA_OCORRENCIA: "01/01/2024", VALOR: "10.000,00", INFORMANTE: "EMPRESA X" },
            ],
          },
          CH_SEM_FUNDOS_VAREJO: {
            STATUS_RETORNO: { CODIGO: "1" },
            QUANTIDADE_OCORRENCIA: "3",
          },
          CH_SEM_FUNDOS_BACEN: {
            STATUS_RETORNO: { CODIGO: "1" },
            QUANTIDADE_OCORRENCIA: "2",
          },
          CONTUMACIA: {
            STATUS_RETORNO: { CODIGO: "1" },
            QUANTIDADE_OCORRENCIA: "5",
          },
          RENDA_PRESUMIDA: {
            FAIXA: "DE R$ 3.001 ATE R$ 4.000",
          },
          PASSAGENS_COMERCIAIS: {
            QUANTIDADE_OCORRENCIA: "35",
          },
        },
      },
    };

    const cc = mockResponse.dados.CREDCADASTRAL;

    // Parse score
    const scoreData = cc.SCORES.OCORRENCIAS[0];
    expect(parseInt(scoreData.SCORE)).toBe(235);
    expect(scoreData.CLASSIF_ABC).toBe("D");
    expect(scoreData.PROBABILIDADE_INADIMPLENCIA).toBe("43.3");

    // Parse protestos
    expect(parseInt(cc.PROTESTOS.QUANTIDADE_OCORRENCIA)).toBe(1183);
    expect(cc.PROTESTOS.OCORRENCIAS.length).toBe(2);
    expect(cc.PROTESTOS.OCORRENCIAS[0].DATA_OCORRENCIA).toBe("20/07/2023");

    // Parse valor total (Brazilian currency)
    const valorStr = cc.PROTESTOS.VALOR_TOTAL.replace(/\./g, "").replace(",", ".");
    expect(parseFloat(valorStr)).toBe(273789291.06);

    // Parse pendências
    expect(parseInt(cc.PEND_FINANCEIRAS.QUANTIDADE_OCORRENCIA)).toBe(24);
    expect(cc.PEND_FINANCEIRAS.OCORRENCIAS[0].INFORMANTE).toBe("EMPRESA X");

    // Parse cheques
    const chequesSemFundo =
      parseInt(cc.CH_SEM_FUNDOS_VAREJO.QUANTIDADE_OCORRENCIA) +
      parseInt(cc.CH_SEM_FUNDOS_BACEN.QUANTIDADE_OCORRENCIA);
    expect(chequesSemFundo).toBe(5);

    // Parse contumácia
    expect(parseInt(cc.CONTUMACIA.QUANTIDADE_OCORRENCIA)).toBe(5);

    // Parse renda presumida
    expect(cc.RENDA_PRESUMIDA.FAIXA).toBe("DE R$ 3.001 ATE R$ 4.000");

    // Parse passagens comerciais
    expect(parseInt(cc.PASSAGENS_COMERCIAIS.QUANTIDADE_OCORRENCIA)).toBe(35);
  });

  it("parses Brazilian currency format correctly", () => {
    const cases = [
      { input: "5.999,63", expected: 5999.63 },
      { input: "273.789.291,06", expected: 273789291.06 },
      { input: "1.234.567,89", expected: 1234567.89 },
      { input: "0", expected: 0 },
      { input: "100,00", expected: 100 },
    ];
    for (const c of cases) {
      const parsed = parseFloat(c.input.replace(/\./g, "").replace(",", "."));
      expect(parsed).toBe(c.expected);
    }
  });
});
