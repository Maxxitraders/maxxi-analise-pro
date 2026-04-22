/**
 * Motor de Análise de Crédito - Maxxi Analise Pro
 *
 * Integra com:
 * 1. BrasilAPI (gratuita) - Dados cadastrais reais da Receita Federal (CNPJ)
 * 2. API Full / Boa Vista SCPC (paga) - Score, protestos, dívidas reais (CPF e CNPJ)
 *    Endpoint: POST https://api.apifull.com.br/api/scpc-boavista
 *    Body: { document, link: "scpc-boavista" }
 *    Resposta: { dados: { HEADER, CREDCADASTRAL } }
 *
 * A API Full retorna dados cadastrais (INFORMACOES_DA_EMPRESA, QUADRO_SOCIETARIO, ENDERECO)
 * que são usados como fallback quando a BrasilAPI não está disponível.
 *
 * Suporta tanto CNPJ (14 dígitos) quanto CPF (11 dígitos).
 */

import { ENV } from "./_core/env";

// ── Interfaces ──

export type DocumentType = "cpf" | "cnpj";

export interface Socio {
  nome: string;
  qualificacao: string;
  dataEntrada?: string;
}

export interface ProtestoDetalhe {
  data: string;
  valor: string;
  cartorio: string;
  cidade: string;
}

export interface PendenciaFinanceira {
  data?: string;
  valor: string;
  credor?: string;
}

export interface CadastralData {
  cnpj: string; // Mantém o nome por compatibilidade, mas pode ser CPF formatado
  document: string; // Documento limpo (só dígitos)
  documentType: DocumentType;
  companyName: string; // Para CPF = nome da pessoa
  nomeFantasia: string;
  situacao: string;
  dataAbertura: string; // Para CPF = data de nascimento (se disponível)
  capitalSocial: number;
  naturezaJuridica: string;
  atividadePrincipal: string;
  endereco: string;
  bairro: string;
  cidade: string;
  uf: string;
  cep: string;
  telefone: string;
  email: string;
  porte: string;
  socios: Socio[];
  dataSource: "brasilapi" | "apifull" | "simulado";
}

export interface CreditData {
  score: number;
  scoreMensagem: string;
  scoreClassificacao: string;
  probabilidadeInadimplencia: string;
  hasProtestos: boolean;
  valorDivida: number;
  quantidadeRestricoes: number;
  protestos: ProtestoDetalhe[];
  pendenciasFinanceiras: PendenciaFinanceira[];
  chequesSemFundo: number;
  chequesSustados: number;
  contumacia: number;
  rendaPresumida: string;
  passagensComerciais: number;
  dataSource: "apifull_boavista" | "simulado";
}

export interface AnalysisResult {
  cadastral: CadastralData;
  credit: CreditData;
  status: "APROVADO" | "REPROVADO" | "ANALISE_MANUAL";
  motivo: string;
}

// ── Utilidades ──

function cleanDocument(doc: string): string {
  return doc.replace(/\D/g, "");
}

export function detectDocumentType(doc: string): DocumentType {
  const cleaned = cleanDocument(doc);
  return cleaned.length <= 11 ? "cpf" : "cnpj";
}

export function validateCnpj(cnpj: string): boolean {
  const cleaned = cleanDocument(cnpj);
  if (cleaned.length !== 14) return false;
  if (/^(\d)\1+$/.test(cleaned)) return false;

  const weights1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  const weights2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];

  let sum = 0;
  for (let i = 0; i < 12; i++) sum += parseInt(cleaned[i]) * weights1[i];
  let remainder = sum % 11;
  const digit1 = remainder < 2 ? 0 : 11 - remainder;
  if (parseInt(cleaned[12]) !== digit1) return false;

  sum = 0;
  for (let i = 0; i < 13; i++) sum += parseInt(cleaned[i]) * weights2[i];
  remainder = sum % 11;
  const digit2 = remainder < 2 ? 0 : 11 - remainder;
  if (parseInt(cleaned[13]) !== digit2) return false;

  return true;
}

export function validateCpf(cpf: string): boolean {
  const cleaned = cleanDocument(cpf);
  if (cleaned.length !== 11) return false;
  if (/^(\d)\1+$/.test(cleaned)) return false;

  let sum = 0;
  for (let i = 0; i < 9; i++) sum += parseInt(cleaned[i]) * (10 - i);
  let remainder = (sum * 10) % 11;
  if (remainder === 10) remainder = 0;
  if (parseInt(cleaned[9]) !== remainder) return false;

  sum = 0;
  for (let i = 0; i < 10; i++) sum += parseInt(cleaned[i]) * (11 - i);
  remainder = (sum * 10) % 11;
  if (remainder === 10) remainder = 0;
  if (parseInt(cleaned[10]) !== remainder) return false;

  return true;
}

export function validateDocument(doc: string): boolean {
  const type = detectDocumentType(doc);
  return type === "cpf" ? validateCpf(doc) : validateCnpj(doc);
}

export function formatCnpj(cnpj: string): string {
  const cleaned = cleanDocument(cnpj);
  return cleaned.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5");
}

export function formatCpf(cpf: string): string {
  const cleaned = cleanDocument(cpf);
  return cleaned.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, "$1.$2.$3-$4");
}

export function formatDocument(doc: string): string {
  const type = detectDocumentType(doc);
  return type === "cpf" ? formatCpf(doc) : formatCnpj(doc);
}

// Remove caracteres estranhos do telefone e formata para exibição
function formatPhone(raw: string): string {
  if (!raw) return "";
  // Remove tudo que não for dígito
  const digits = raw.replace(/\D/g, "");
  if (!digits) return "";
  // Formato (XX) XXXXX-XXXX ou (XX) XXXX-XXXX
  if (digits.length === 11) {
    return `(${digits.slice(0,2)}) ${digits.slice(2,7)}-${digits.slice(7)}`;
  }
  if (digits.length === 10) {
    return `(${digits.slice(0,2)}) ${digits.slice(2,6)}-${digits.slice(6)}`;
  }
  return digits;
}

function parseBrCurrency(val: string | number | undefined | null): number {
  if (val === undefined || val === null || val === "") return 0;
  const str = String(val).replace(/\./g, "").replace(",", ".");
  return parseFloat(str) || 0;
}

// ── BrasilAPI - Dados Cadastrais Reais (apenas CNPJ) ──

async function fetchBrasilAPI(cnpj: string): Promise<CadastralData | null> {
  const cleaned = cleanDocument(cnpj);
  if (cleaned.length !== 14) return null; // BrasilAPI só suporta CNPJ

  try {
    const response = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cleaned}`, {
      signal: AbortSignal.timeout(15000),
    });
    if (!response.ok) {
      console.warn(`[BrasilAPI] HTTP ${response.status} para CNPJ ${cleaned}`);
      return null;
    }
    const data = await response.json();

    const socios: Socio[] = (data.qsa || []).map((s: any) => ({
      nome: s.nome_socio || "",
      qualificacao: s.qualificacao_socio || "",
      dataEntrada: s.data_entrada_sociedade || undefined,
    }));

    const descLogradouro = data.descricao_tipo_de_logradouro || "";
    const logradouro = data.logradouro || "";
    const numero = data.numero || "";
    const complemento = data.complemento || "";
    const enderecoFull = [descLogradouro, logradouro, numero, complemento].filter(Boolean).join(", ");

    return {
      cnpj: formatCnpj(cleaned),
      document: cleaned,
      documentType: "cnpj",
      companyName: data.razao_social || "Não informado",
      nomeFantasia: data.nome_fantasia || "",
      situacao: data.descricao_situacao_cadastral || "DESCONHECIDA",
      dataAbertura: data.data_inicio_atividade
        ? new Date(data.data_inicio_atividade).toLocaleDateString("pt-BR")
        : "",
      capitalSocial: data.capital_social || 0,
      naturezaJuridica: data.natureza_juridica || "",
      atividadePrincipal: data.cnae_fiscal_descricao || "",
      endereco: enderecoFull,
      bairro: data.bairro || "",
      cidade: data.municipio || "",
      uf: data.uf || "",
      cep: data.cep || "",
      telefone: formatPhone(data.ddd_telefone_1 || ""),
      email: data.email || "",
      porte: data.porte || data.descricao_porte || "",
      socios,
      dataSource: "brasilapi",
    };
  } catch (error) {
    console.warn("[BrasilAPI] Erro na consulta:", error);
    return null;
  }
}

// ── API Full / Boa Vista SCPC ──
// Retorna TANTO dados de crédito QUANTO dados cadastrais
// Funciona para CPF e CNPJ

interface ApiFullResult {
  credit: CreditData;
  cadastral: CadastralData | null; // Dados cadastrais extraídos da resposta
}

async function fetchApiFullBoaVista(doc: string): Promise<ApiFullResult | null> {
  const token = ENV.apiFullToken;
  if (!token) {
    console.info("[APIFull] Token não configurado. Usando dados simulados.");
    return null;
  }

  const cleaned = cleanDocument(doc);
  const docType = detectDocumentType(cleaned);

  try {
    const response = await fetch("https://api.apifull.com.br/api/scpc-boavista", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "*/*",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        document: cleaned,
        link: "scpc-boavista",
      }),
      signal: AbortSignal.timeout(30000),
    });

    const result = await response.json();

    if (!response.ok || result.status !== "sucesso" || !result.dados?.CREDCADASTRAL) {
      const msg = result.message || result.status || `HTTP ${response.status}`;
      console.warn(`[APIFull] ${msg} para ${docType.toUpperCase()} ${cleaned}`);
      return null;
    }

    const cc = result.dados.CREDCADASTRAL;

    // ── Parse SCORES ──
    let score = 0;
    let scoreMensagem = "";
    let scoreClassificacao = "";
    let probabilidadeInadimplencia = "";

    if (cc.SCORES?.OCORRENCIAS?.length > 0) {
      const scoreData = cc.SCORES.OCORRENCIAS[0];
      score = parseInt(scoreData.SCORE || "0", 10);
      scoreMensagem = scoreData.TEXTO || "";
      scoreClassificacao = scoreData.CLASSIF_ABC || "";
      probabilidadeInadimplencia = scoreData.PROBABILIDADE_INADIMPLENCIA || "";
    }

    // ── Parse PROTESTOS ──
    const protestosSection = cc.PROTESTOS || {};
    const protestoQtd = parseInt(protestosSection.QUANTIDADE_OCORRENCIA || protestosSection.QUANTIDADE_OCORRENCIAS || "0", 10);
    const protestoValorTotal = parseBrCurrency(protestosSection.VALOR_TOTAL);
    const protestosRaw = protestosSection.OCORRENCIAS || [];
    const protestos: ProtestoDetalhe[] = protestosRaw.map((p: any) => ({
      data: p.DATA_OCORRENCIA || p.DATA || "",
      valor: p.VALOR || "0",
      cartorio: p.CARTORIO || p.INFORMANTE || "",
      cidade: p.CIDADE || p.PRACA || "",
    }));

    // ── Parse PENDÊNCIAS FINANCEIRAS ──
    const pendenciasSection = cc.PEND_FINANCEIRAS || {};
    const pendenciaQtd = parseInt(pendenciasSection.QUANTIDADE_OCORRENCIA || pendenciasSection.QUANTIDADE_OCORRENCIAS || "0", 10);
    const pendenciaValorTotal = parseBrCurrency(pendenciasSection.VALOR_TOTAL);
    const pendenciasRaw = pendenciasSection.OCORRENCIAS || [];
    const pendenciasFinanceiras: PendenciaFinanceira[] = pendenciasRaw.map((p: any) => ({
      data: p.DATA_OCORRENCIA || p.DATA || undefined,
      valor: p.VALOR || "0",
      credor: p.INFORMANTE || p.CREDOR || undefined,
    }));

    // ── Parse CHEQUES ──
    const chVarejo = cc.CH_SEM_FUNDOS_VAREJO || {};
    const chBacen = cc.CH_SEM_FUNDOS_BACEN || {};
    const chequesSemFundo =
      parseInt(chVarejo.QUANTIDADE_OCORRENCIA || chVarejo.QUANTIDADE_OCORRENCIAS || "0", 10) +
      parseInt(chBacen.QUANTIDADE_OCORRENCIA || chBacen.QUANTIDADE_OCORRENCIAS || "0", 10);

    // ── Parse CONTUMACIA ──
    const contumaciaSection = cc.CONTUMACIA || {};
    const contumacia = parseInt(contumaciaSection.QUANTIDADE_OCORRENCIA || contumaciaSection.QUANTIDADE_OCORRENCIAS || "0", 10);

    // ── Parse RENDA PRESUMIDA ──
    const rendaSection = cc.RENDA_PRESUMIDA || {};
    const rendaPresumida = rendaSection.FAIXA || rendaSection.DESCRICAO || "";

    // ── Parse PASSAGENS COMERCIAIS ──
    const passagensSection = cc.PASSAGENS_COMERCIAIS || {};
    const passagensComerciais = parseInt(passagensSection.QUANTIDADE_OCORRENCIA || passagensSection.QUANTIDADE_OCORRENCIAS || "0", 10);

    // ── Totais ──
    const valorDivida = protestoValorTotal + pendenciaValorTotal;
    const hasProtestos = protestoQtd > 0 || pendenciaQtd > 0;
    const quantidadeRestricoes = protestoQtd + pendenciaQtd;

    const credit: CreditData = {
      score,
      scoreMensagem,
      scoreClassificacao,
      probabilidadeInadimplencia,
      hasProtestos,
      valorDivida,
      quantidadeRestricoes,
      protestos,
      pendenciasFinanceiras,
      chequesSemFundo,
      chequesSustados: 0,
      contumacia,
      rendaPresumida,
      passagensComerciais,
      dataSource: "apifull_boavista",
    };

    // ── Extrair dados cadastrais da resposta da API Full ──
    let cadastral: CadastralData | null = null;

    if (docType === "cpf") {
      // ── CPF: dados em IDENTIFICACAO_PESSOA_FISICA ──
      const ipf = cc.IDENTIFICACAO_PESSOA_FISICA;
      
      // Aceitar dados se ipf existe e tem NOME, independente do STATUS_RETORNO
      if (ipf && (ipf.NOME || ipf.STATUS_RETORNO?.CODIGO === "1")) {
        cadastral = {
          cnpj: formatCpf(cleaned),
          document: cleaned,
          documentType: "cpf",
          companyName: ipf.NOME || "Não informado",
          nomeFantasia: ipf.NOME_SOCIAL || "",
          situacao: ipf.CPF_SITUACAO || ipf.SITUACAO || "DESCONHECIDA",
          dataAbertura: ipf.NASCIMENTO || ipf.DATA_NASCIMENTO || "",
          capitalSocial: 0,
          naturezaJuridica: "Pessoa Física",
          atividadePrincipal: "",
          endereco: ipf.END_LOGRADOURO || ipf.ENDERECO || "",
          bairro: ipf.END_BAIRRO || ipf.BAIRRO || "",
          cidade: ipf.END_CIDADE || ipf.CIDADE || "",
          uf: ipf.END_UF || ipf.UF || ipf.CPF_ORIGEM || "",
          cep: ipf.END_CEP || ipf.CEP || "",
          telefone: formatPhone(ipf.TELEFONE || ipf.DDD_TELEFONE || ""),
          email: ipf.EMAIL || "",
          porte: ipf.FAIXA_RENDA || ipf.CLASSE_SOCIAL || ipf.RENDA_PRESUMIDA || "",
          socios: [],
          dataSource: "apifull",
        };
        console.info(`[APIFull] Dados cadastrais de CPF obtidos: ${ipf.NOME}`);
      } else if (!ipf) {
        // Tentar buscar nome em outras seções conhecidas da API Full
        const header = result.dados?.HEADER || cc.HEADER;
        const nomeFromHeader = header?.NOME || header?.NOME_CONSULTADO;
        if (nomeFromHeader) {
          console.info(`[APIFull] CPF - Nome encontrado no HEADER: ${nomeFromHeader}`);
          cadastral = {
            cnpj: formatCpf(cleaned),
            document: cleaned,
            documentType: "cpf",
            companyName: nomeFromHeader,
            nomeFantasia: "",
            situacao: "DESCONHECIDA",
            dataAbertura: "",
            capitalSocial: 0,
            naturezaJuridica: "Pessoa Física",
            atividadePrincipal: "",
            endereco: "",
            bairro: "",
            cidade: "",
            uf: "",
            cep: "",
            telefone: "",
            email: "",
            porte: "",
            socios: [],
            dataSource: "apifull",
          };
        }
      }
    } else {
      // ── CNPJ: dados em INFORMACOES_DA_EMPRESA ──
      const ie = cc.INFORMACOES_DA_EMPRESA;
      if (ie && ie.STATUS_RETORNO?.CODIGO === "1") {
        const endObj = ie.ENDERECO || cc.ENDERECO || {};
        const qs = cc.QUADRO_SOCIETARIO;
        const socios: Socio[] = [];
        if (qs?.OCORRENCIAS?.length > 0) {
          for (const s of qs.OCORRENCIAS) {
            socios.push({
              nome: s.NOME || "",
              qualificacao: s.CARGO || s.TIPO_DOCUMENTO || "",
              dataEntrada: s.DATA_ENTRADA_SOCIEDADE || undefined,
            });
          }
        }

        cadastral = {
          cnpj: ie.CNPJ || formatDocument(cleaned),
          document: cleaned,
          documentType: "cnpj",
          companyName: ie.RAZAO_SOCIAL || "Não informado",
          nomeFantasia: ie.NOME_FANTASIA || "",
          situacao: ie.SITUACAO || "DESCONHECIDA",
          dataAbertura: ie.DATA_FUNDACAO || "",
          capitalSocial: parseBrCurrency(ie.CAPITAL_SOCIAL),
          naturezaJuridica: ie.NATUREZA_JURIDICA || "",
          atividadePrincipal: ie.RAMO_ATIVIDADE_PRIMARIO || ie.CNAE_PRIMARIO || "",
          endereco: endObj.ENDERECO || "",
          bairro: endObj.BAIRRO || "",
          cidade: endObj.CIDADE || "",
          uf: endObj.UF || "",
          cep: endObj.CEP || "",
          telefone: formatPhone(ie.TELEFONE || ""),
          email: ie.EMAIL || "",
          porte: ie.PORTE || "",
          socios,
          dataSource: "apifull",
        };
        console.info(`[APIFull] Dados cadastrais de CNPJ obtidos: ${ie.RAZAO_SOCIAL}`);
      }
    }

    return { credit, cadastral };
  } catch (error) {
    console.warn("[APIFull] Erro na consulta:", error);
    return null;
  }
}

// ── Simulação (Fallback) ──

function seededRandom(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 16807 + 0) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

function simulateCadastralData(doc: string): CadastralData {
  const cleaned = cleanDocument(doc);
  const docType = detectDocumentType(cleaned);
  const seed = cleaned.split("").reduce((acc, d) => acc + parseInt(d), 0);
  const rand = seededRandom(seed);

  if (docType === "cpf") {
    const nomes = [
      "João da Silva Santos", "Maria Oliveira Costa", "Carlos Eduardo Pereira",
      "Ana Paula Ferreira", "Roberto Almeida Junior", "Fernanda Lima Souza",
      "Pedro Henrique Rocha", "Juliana Martins Ribeiro",
    ];
    const idx = Math.floor(rand() * nomes.length);
    return {
      cnpj: formatCpf(cleaned),
      document: cleaned,
      documentType: "cpf",
      companyName: nomes[idx],
      nomeFantasia: "",
      situacao: "REGULAR",
      dataAbertura: "",
      capitalSocial: 0,
      naturezaJuridica: "Pessoa Física",
      atividadePrincipal: "",
      endereco: "Rua Exemplo, 123",
      bairro: "Centro",
      cidade: "São Paulo",
      uf: "SP",
      cep: "01000-000",
      telefone: "",
      email: "",
      porte: "",
      socios: [],
      dataSource: "simulado",
    };
  }

  const empresas = [
    "Tech Solutions Brasil Ltda", "Comércio Integrado S.A.",
    "Serviços Digitais Eireli", "Indústria Nacional do Aço Ltda",
    "Logística Express Brasil S.A.", "Consultoria Empresarial Prime Ltda",
    "Distribuidora Central do Brasil S.A.", "Agropecuária Vale Verde Ltda",
  ];
  const situacoes = ["ATIVA", "ATIVA", "ATIVA", "ATIVA", "ATIVA", "BAIXADA", "SUSPENSA", "INAPTA"];

  const idx = Math.floor(rand() * empresas.length);
  const sitIdx = Math.floor(rand() * situacoes.length);
  const day = Math.floor(rand() * 28) + 1;
  const month = Math.floor(rand() * 12) + 1;
  const year = Math.floor(rand() * 30) + 1994;
  const capital = Math.floor(rand() * 4990000) + 10000;

  return {
    cnpj: formatCnpj(cleaned),
    document: cleaned,
    documentType: "cnpj",
    companyName: empresas[idx],
    nomeFantasia: "",
    situacao: situacoes[sitIdx],
    dataAbertura: `${String(day).padStart(2, "0")}/${String(month).padStart(2, "0")}/${year}`,
    capitalSocial: capital,
    naturezaJuridica: "206-2 - Sociedade Empresária Limitada",
    atividadePrincipal: "Atividades de consultoria em gestão empresarial",
    endereco: "Rua Exemplo, 123",
    bairro: "Centro",
    cidade: "São Paulo",
    uf: "SP",
    cep: "01000-000",
    telefone: "",
    email: "",
    porte: "DEMAIS",
    socios: [],
    dataSource: "simulado",
  };
}

function simulateCreditData(doc: string): CreditData {
  const cleaned = cleanDocument(doc);
  const seed = cleaned.split("").reduce((acc, d) => acc + parseInt(d), 0) + 42;
  const rand = seededRandom(seed);

  const score = Math.floor(rand() * 1000);
  const hasProtestos = rand() < 0.3;
  const valorDivida = hasProtestos ? Math.floor(rand() * 80000) + 500 : 0;
  const quantidadeRestricoes = hasProtestos ? Math.floor(rand() * 8) + 1 : 0;

  return {
    score,
    scoreMensagem: `De cada 100 consultados classificados nesta classe de score, é provável que ${Math.floor((1 - score / 1000) * 100)} apresentem débitos no mercado nos próximos 12 meses.`,
    scoreClassificacao: "",
    probabilidadeInadimplencia: "",
    hasProtestos,
    valorDivida,
    quantidadeRestricoes,
    protestos: [],
    pendenciasFinanceiras: [],
    chequesSemFundo: 0,
    chequesSustados: 0,
    contumacia: 0,
    rendaPresumida: "",
    passagensComerciais: 0,
    dataSource: "simulado",
  };
}

// ── Motor Principal ──

function determineStatus(
  cadastral: CadastralData,
  credit: CreditData
): { status: "APROVADO" | "REPROVADO" | "ANALISE_MANUAL"; motivo: string } {
  const situacaoUpper = (cadastral.situacao || "").toUpperCase();

  // Para CNPJ: verificar situação cadastral
  if (cadastral.documentType === "cnpj") {
    if (situacaoUpper !== "ATIVA" && situacaoUpper !== "ATIVO") {
      return {
        status: "REPROVADO",
        motivo: `Empresa com situação cadastral "${cadastral.situacao}". Não é possível aprovar crédito para empresas inativas.`,
      };
    }
  }

  // Para CPF: verificar situação
  if (cadastral.documentType === "cpf") {
    if (situacaoUpper && situacaoUpper !== "REGULAR" && situacaoUpper !== "ATIVO") {
      return {
        status: "REPROVADO",
        motivo: `CPF com situação "${cadastral.situacao}". Não é possível aprovar crédito.`,
      };
    }
  }

  if (credit.hasProtestos && credit.valorDivida > 10000) {
    return {
      status: "REPROVADO",
      motivo: `Alto valor de dívida em protesto: R$ ${credit.valorDivida.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}. Risco elevado de inadimplência.`,
    };
  }
  if (credit.score < 300 && credit.score > 0) {
    return {
      status: "REPROVADO",
      motivo: `Score de crédito muito baixo (${credit.score}/1000). Histórico financeiro comprometido.`,
    };
  }
  if (credit.score === 0 && credit.scoreMensagem) {
    return {
      status: "ANALISE_MANUAL",
      motivo: `Score não classificado pelo bureau. ${credit.scoreMensagem}`,
    };
  }
  if (credit.score < 600 || credit.hasProtestos) {
    const motivo = credit.hasProtestos
      ? `Presença de restrições financeiras com valor de R$ ${credit.valorDivida.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}. Requer análise detalhada.`
      : `Score intermediário (${credit.score}/1000). Recomenda-se avaliação complementar.`;
    return { status: "ANALISE_MANUAL", motivo };
  }
  return {
    status: "APROVADO",
    motivo: "Perfil de baixo risco. Bom histórico e sem restrições relevantes.",
  };
}

export class ApiUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ApiUnavailableError";
  }
}

export async function runCreditAnalysis(doc: string): Promise<AnalysisResult> {
  const cleaned = cleanDocument(doc);
  const docType = detectDocumentType(cleaned);

  // 1. Verificar se token está configurado antes de tentar
  if (!ENV.apiFullToken) {
    throw new ApiUnavailableError(
      "O serviço de consulta de crédito não está configurado no momento. Entre em contato com o suporte."
    );
  }

  // 2. Buscar dados da API Full (crédito + cadastrais)
  const apiFullResult = await fetchApiFullBoaVista(cleaned);

  // 3. Dados de crédito — se API falhou, NÃO usar simulação, lançar erro
  let credit: CreditData;
  if (apiFullResult?.credit) {
    credit = apiFullResult.credit;
  } else {
    // API falhou (saldo zerado, timeout, erro de rede, etc.)
    // NÃO debitamos o crédito do usuário neste caso
    throw new ApiUnavailableError(
      "Não foi possível obter os dados de crédito no momento. Sua consulta não foi debitada. Tente novamente em instantes ou contate o suporte."
    );
  }

  // 4. Dados cadastrais: BrasilAPI (CNPJ) > API Full
  let cadastral: CadastralData | null = null;

  if (docType === "cnpj") {
    cadastral = await fetchBrasilAPI(cleaned);
  }

  if (!cadastral && apiFullResult?.cadastral) {
    console.info(`[CreditEngine] Usando dados cadastrais da API Full para: ${cleaned}`);
    cadastral = apiFullResult.cadastral;
  }

  // Se não tem dados cadastrais mas tem dados de crédito (raro para CPF),
  // usar dados mínimos do próprio resultado da API Full
  if (!cadastral) {
    throw new ApiUnavailableError(
      "Não foi possível obter os dados cadastrais no momento. Sua consulta não foi debitada. Tente novamente."
    );
  }

  // 5. Determinar status e motivo
  const { status, motivo } = determineStatus(cadastral, credit);

  return { cadastral, credit, status, motivo };
}

export function isHighRisk(result: AnalysisResult): boolean {
  return (
    result.status === "REPROVADO" ||
    result.credit.score < 200 ||
    result.credit.valorDivida > 50000
  );
}
