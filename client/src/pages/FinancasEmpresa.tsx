import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  Building2,
  TrendingUp,
  TrendingDown,
  DollarSign,
  Target,
  Clock,
  BarChart3,
  PiggyBank,
  Percent,
  RefreshCw,
  Save,
  Info,
} from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

const STORAGE_KEY = "maxxi-financas-empresa";

interface DadosFinanceiros {
  receitaBruta: string;
  custosVariaveis: string;
  custosFixos: string;
  patrimonioLiquido: string;
  investimentoTotal: string;
  lucroMeta: string;
  valorMercado: string;
  nomeEmpresa: string;
}

const DEFAULTS: DadosFinanceiros = {
  // Receita: 11 clientes × R$ 53,00 (mensalidade com desconto pontualidade)
  receitaBruta: "583,00",
  // Variáveis por cliente: Asaas mensagem (0,99) + cartão (2,82) + NF (0,99) + imposto 6% (3,18) = R$ 7,98 × 11
  custosVariaveis: "87,78",
  // Fixos: MaxTracker (60) + Chips M2M (54) + Freelancer mkt (500) + Facebook Ads (480) + Contador (300)
  custosFixos: "1394,00",
  patrimonioLiquido: "",
  // Investimento: 11 instalações (2.200) + 11 kits rastreador/chicote/relé (2.640) + 20 ativações chip (40)
  investimentoTotal: "4880,00",
  lucroMeta: "",
  valorMercado: "",
  nomeEmpresa: "",
};

function parseBR(v: string): number {
  const n = parseFloat(v.replace(/\./g, "").replace(",", "."));
  return isNaN(n) ? 0 : n;
}

function fmtBRL(v: number): string {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function fmtPct(v: number, decimals = 1): string {
  return `${v.toFixed(decimals)}%`;
}

interface MetricCardProps {
  icon: React.ReactNode;
  title: string;
  value: string;
  subtitle?: string;
  color?: "green" | "red" | "blue" | "yellow" | "purple" | "default";
  tooltip?: string;
}

function MetricCard({ icon, title, value, subtitle, color = "default", tooltip }: MetricCardProps) {
  const colorMap = {
    green: "bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-800",
    red: "bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800",
    blue: "bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800",
    yellow: "bg-yellow-50 dark:bg-yellow-950/30 border-yellow-200 dark:border-yellow-800",
    purple: "bg-purple-50 dark:bg-purple-950/30 border-purple-200 dark:border-purple-800",
    default: "bg-card border-border",
  };
  const textColorMap = {
    green: "text-green-700 dark:text-green-400",
    red: "text-red-700 dark:text-red-400",
    blue: "text-blue-700 dark:text-blue-400",
    yellow: "text-yellow-700 dark:text-yellow-400",
    purple: "text-purple-700 dark:text-purple-400",
    default: "text-foreground",
  };

  return (
    <div className={`rounded-xl border p-4 space-y-2 ${colorMap[color]}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-muted-foreground text-sm font-medium">
          {icon}
          <span>{title}</span>
        </div>
        {tooltip && (
          <Tooltip>
            <TooltipTrigger>
              <Info className="h-3.5 w-3.5 text-muted-foreground/60" />
            </TooltipTrigger>
            <TooltipContent className="max-w-56 text-xs">{tooltip}</TooltipContent>
          </Tooltip>
        )}
      </div>
      <p className={`text-2xl font-bold ${textColorMap[color]}`}>{value}</p>
      {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
    </div>
  );
}

interface FieldProps {
  label: string;
  id: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  prefix?: string;
  tooltip?: string;
}

function Field({ label, id, value, onChange, placeholder = "0,00", prefix = "R$", tooltip }: FieldProps) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-1.5">
        <Label htmlFor={id} className="text-sm font-medium">
          {label}
        </Label>
        {tooltip && (
          <Tooltip>
            <TooltipTrigger>
              <Info className="h-3.5 w-3.5 text-muted-foreground/50" />
            </TooltipTrigger>
            <TooltipContent className="max-w-56 text-xs">{tooltip}</TooltipContent>
          </Tooltip>
        )}
      </div>
      <div className="relative">
        {prefix && (
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm select-none">
            {prefix}
          </span>
        )}
        <Input
          id={id}
          type="text"
          inputMode="decimal"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className={prefix ? "pl-10" : ""}
        />
      </div>
    </div>
  );
}

export default function FinancasEmpresa() {
  const [dados, setDados] = useState<DadosFinanceiros>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      return saved ? { ...DEFAULTS, ...JSON.parse(saved) } : DEFAULTS;
    } catch {
      return DEFAULTS;
    }
  });
  const [saved, setSaved] = useState(false);

  const set = useCallback((key: keyof DadosFinanceiros) => (v: string) => {
    setDados((prev) => ({ ...prev, [key]: v }));
    setSaved(false);
  }, []);

  const handleSave = () => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(dados));
      setSaved(true);
      toast.success("Dados salvos com sucesso!");
    } catch {
      toast.error("Erro ao salvar dados");
    }
  };

  const handleReset = () => {
    setDados(DEFAULTS);
    localStorage.removeItem(STORAGE_KEY);
    setSaved(false);
    toast.info("Dados limpos");
  };

  // Auto-save on change after 1s debounce
  useEffect(() => {
    const t = setTimeout(() => {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(dados));
      } catch {}
    }, 1000);
    return () => clearTimeout(t);
  }, [dados]);

  // --- Cálculos ---
  const receita = parseBR(dados.receitaBruta);
  const custosVar = parseBR(dados.custosVariaveis);
  const custosFixos = parseBR(dados.custosFixos);
  const pl = parseBR(dados.patrimonioLiquido);
  const investimento = parseBR(dados.investimentoTotal);
  const meta = parseBR(dados.lucroMeta);
  const valorMercado = parseBR(dados.valorMercado);

  const lucrobruto = receita - custosVar;
  const lucroLiquido = receita - custosVar - custosFixos;
  const margemBruta = receita > 0 ? (lucrobruto / receita) * 100 : 0;
  const margemLiquida = receita > 0 ? (lucroLiquido / receita) * 100 : 0;
  const roi = investimento > 0 ? (lucroLiquido / investimento) * 100 : 0;
  const roiAnual = roi * 12;
  const paybackMeses = lucroLiquido > 0 && investimento > 0 ? investimento / lucroLiquido : 0;
  const pvp = pl > 0 && valorMercado > 0 ? valorMercado / pl : 0;
  const atingimentoMeta = meta > 0 ? (lucroLiquido / meta) * 100 : 0;
  const retornoSobrePL = pl > 0 ? (lucroLiquido / pl) * 100 : 0;

  const hasData = receita > 0 || custosVar > 0 || custosFixos > 0;

  return (
    <div className="container mx-auto p-6 max-w-6xl space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Building2 className="h-8 w-8" />
            Finanças da Empresa
            {dados.nomeEmpresa && (
              <span className="text-muted-foreground font-normal text-xl">— {dados.nomeEmpresa}</span>
            )}
          </h1>
          <p className="text-muted-foreground mt-1">
            Mapeie seus números, acompanhe métricas e monitore o retorno do negócio
          </p>
        </div>
        <div className="flex gap-2 shrink-0">
          <Button variant="outline" size="sm" onClick={handleReset}>
            <RefreshCw className="h-4 w-4 mr-1" />
            Limpar
          </Button>
          <Button size="sm" onClick={handleSave} variant={saved ? "outline" : "default"}>
            <Save className="h-4 w-4 mr-1" />
            {saved ? "Salvo" : "Salvar"}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Coluna de Inputs */}
        <div className="lg:col-span-1 space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <DollarSign className="h-4 w-4" />
                Dados da Empresa
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Field
                label="Nome da Empresa"
                id="nome"
                value={dados.nomeEmpresa}
                onChange={set("nomeEmpresa")}
                placeholder="Ex: Maxxi Traders"
                prefix=""
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <BarChart3 className="h-4 w-4" />
                DRE Mensal
              </CardTitle>
              <CardDescription className="text-xs">Demonstrativo de Resultado</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Field
                label="Receita Bruta"
                id="receita"
                value={dados.receitaBruta}
                onChange={set("receitaBruta")}
                tooltip="Total de faturamento bruto no mês (antes de qualquer dedução)"
              />
              <Field
                label="Custos Variáveis"
                id="custos-var"
                value={dados.custosVariaveis}
                onChange={set("custosVariaveis")}
                tooltip="Custos que variam com as vendas: comissões, matéria-prima, impostos sobre receita, etc."
              />
              <Field
                label="Custos Fixos"
                id="custos-fix"
                value={dados.custosFixos}
                onChange={set("custosFixos")}
                tooltip="Custos fixos mensais: aluguel, salários, energia, internet, etc."
              />
              <Separator />
              {hasData && (
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Lucro Bruto</span>
                    <span className={`font-medium ${lucrobruto >= 0 ? "text-green-600" : "text-red-600"}`}>
                      {fmtBRL(lucrobruto)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Lucro Líquido</span>
                    <span className={`font-semibold ${lucroLiquido >= 0 ? "text-green-600" : "text-red-600"}`}>
                      {fmtBRL(lucroLiquido)}
                    </span>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <PiggyBank className="h-4 w-4" />
                Patrimônio e Investimento
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Field
                label="Patrimônio Líquido (PL)"
                id="pl"
                value={dados.patrimonioLiquido}
                onChange={set("patrimonioLiquido")}
                tooltip="PL = Total de Ativos − Total de Passivos. É o valor contábil real da empresa."
              />
              <Field
                label="Investimento Total"
                id="investimento"
                value={dados.investimentoTotal}
                onChange={set("investimentoTotal")}
                tooltip="Capital total investido no negócio, incluindo o aporte inicial e reinvestimentos."
              />
              <Field
                label="Valor de Mercado"
                id="valor-mercado"
                value={dados.valorMercado}
                onChange={set("valorMercado")}
                tooltip="Quanto vale a empresa no mercado (quanto pagaria um comprador). Usado para calcular o PVP."
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Target className="h-4 w-4" />
                Metas
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Field
                label="Meta de Lucro Mensal"
                id="meta"
                value={dados.lucroMeta}
                onChange={set("lucroMeta")}
                tooltip="Qual o lucro líquido mensal que você quer atingir."
              />
            </CardContent>
          </Card>
        </div>

        {/* Coluna de Métricas */}
        <div className="lg:col-span-2 space-y-4">
          {/* Resultado Operacional */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <TrendingUp className="h-4 w-4" />
                Resultado Operacional
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <MetricCard
                  icon={<DollarSign className="h-4 w-4" />}
                  title="Receita Bruta"
                  value={receita > 0 ? fmtBRL(receita) : "—"}
                  color="blue"
                  tooltip="Faturamento total antes de qualquer custo"
                />
                <MetricCard
                  icon={<TrendingUp className="h-4 w-4" />}
                  title="Lucro Bruto"
                  value={receita > 0 ? fmtBRL(lucrobruto) : "—"}
                  subtitle={receita > 0 ? `Margem: ${fmtPct(margemBruta)}` : undefined}
                  color={lucrobruto >= 0 ? "green" : "red"}
                  tooltip="Receita − Custos Variáveis"
                />
                <MetricCard
                  icon={lucroLiquido >= 0 ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
                  title="Lucro Líquido"
                  value={receita > 0 ? fmtBRL(lucroLiquido) : "—"}
                  subtitle={receita > 0 ? `Margem: ${fmtPct(margemLiquida)}` : undefined}
                  color={lucroLiquido >= 0 ? "green" : "red"}
                  tooltip="Receita − Custos Variáveis − Custos Fixos"
                />
              </div>
            </CardContent>
          </Card>

          {/* Margens */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Percent className="h-4 w-4" />
                Margens
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <MetricCard
                  icon={<Percent className="h-4 w-4" />}
                  title="Margem Bruta"
                  value={receita > 0 ? fmtPct(margemBruta) : "—"}
                  subtitle="Sobre receita bruta"
                  color={margemBruta >= 30 ? "green" : margemBruta >= 10 ? "yellow" : receita > 0 ? "red" : "default"}
                  tooltip="(Lucro Bruto / Receita) × 100"
                />
                <MetricCard
                  icon={<Percent className="h-4 w-4" />}
                  title="Margem Líquida"
                  value={receita > 0 ? fmtPct(margemLiquida) : "—"}
                  subtitle="Sobre receita bruta"
                  color={margemLiquida >= 15 ? "green" : margemLiquida >= 5 ? "yellow" : receita > 0 ? "red" : "default"}
                  tooltip="(Lucro Líquido / Receita) × 100"
                />
                <MetricCard
                  icon={<BarChart3 className="h-4 w-4" />}
                  title="Custo Total"
                  value={receita > 0 ? fmtBRL(custosVar + custosFixos) : "—"}
                  subtitle={receita > 0 ? `${fmtPct(((custosVar + custosFixos) / receita) * 100)} da receita` : undefined}
                  color="default"
                  tooltip="Soma de custos variáveis e fixos"
                />
                <MetricCard
                  icon={<Percent className="h-4 w-4" />}
                  title="Retorno s/ PL"
                  value={pl > 0 && receita > 0 ? fmtPct(retornoSobrePL) : "—"}
                  subtitle="ROE mensal"
                  color={retornoSobrePL >= 2 ? "green" : retornoSobrePL > 0 ? "yellow" : "default"}
                  tooltip="(Lucro Líquido / Patrimônio Líquido) × 100 — Return on Equity"
                />
              </div>
            </CardContent>
          </Card>

          {/* Retorno do Investimento */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Clock className="h-4 w-4" />
                Retorno do Investimento
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <MetricCard
                  icon={<Percent className="h-4 w-4" />}
                  title="ROI Mensal"
                  value={investimento > 0 && receita > 0 ? fmtPct(roi) : "—"}
                  subtitle="Retorno sobre investimento"
                  color={roi >= 3 ? "green" : roi > 0 ? "yellow" : investimento > 0 ? "red" : "default"}
                  tooltip="(Lucro Líquido / Investimento Total) × 100"
                />
                <MetricCard
                  icon={<TrendingUp className="h-4 w-4" />}
                  title="ROI Anual"
                  value={investimento > 0 && receita > 0 ? fmtPct(roiAnual) : "—"}
                  subtitle="Projeção 12 meses"
                  color={roiAnual >= 36 ? "green" : roiAnual > 0 ? "yellow" : investimento > 0 ? "red" : "default"}
                  tooltip="ROI Mensal × 12 (assumindo resultado constante)"
                />
                <MetricCard
                  icon={<Clock className="h-4 w-4" />}
                  title="Payback"
                  value={
                    investimento > 0 && lucroLiquido > 0
                      ? paybackMeses >= 12
                        ? `${(paybackMeses / 12).toFixed(1)} anos`
                        : `${paybackMeses.toFixed(1)} meses`
                      : "—"
                  }
                  subtitle="Tempo para recuperar investimento"
                  color={paybackMeses > 0 && paybackMeses <= 12 ? "green" : paybackMeses <= 24 ? "yellow" : investimento > 0 ? "red" : "default"}
                  tooltip="Investimento Total / Lucro Líquido Mensal"
                />
                <MetricCard
                  icon={<BarChart3 className="h-4 w-4" />}
                  title="PVP"
                  value={pvp > 0 ? pvp.toFixed(2) + "x" : "—"}
                  subtitle="Preço / Valor Patrimonial"
                  color={pvp > 0 && pvp < 1 ? "green" : pvp <= 3 ? "yellow" : pvp > 0 ? "red" : "default"}
                  tooltip="Valor de Mercado / Patrimônio Líquido. PVP < 1 = empresa negociada abaixo do valor contábil"
                />
              </div>
            </CardContent>
          </Card>

          {/* Meta */}
          {meta > 0 && receita > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Target className="h-4 w-4" />
                  Acompanhamento de Meta
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Lucro atual vs meta</span>
                  <div className="flex items-center gap-2">
                    <span className={`font-semibold ${lucroLiquido >= meta ? "text-green-600" : "text-amber-600"}`}>
                      {fmtBRL(lucroLiquido)}
                    </span>
                    <span className="text-muted-foreground">/</span>
                    <span className="text-muted-foreground">{fmtBRL(meta)}</span>
                    <Badge
                      variant="outline"
                      className={
                        atingimentoMeta >= 100
                          ? "bg-green-50 text-green-700 border-green-300"
                          : atingimentoMeta >= 70
                          ? "bg-yellow-50 text-yellow-700 border-yellow-300"
                          : "bg-red-50 text-red-700 border-red-300"
                      }
                    >
                      {fmtPct(atingimentoMeta, 0)}
                    </Badge>
                  </div>
                </div>
                <div className="w-full bg-muted rounded-full h-3 overflow-hidden">
                  <div
                    className={`h-3 rounded-full transition-all ${
                      atingimentoMeta >= 100 ? "bg-green-500" : atingimentoMeta >= 70 ? "bg-yellow-500" : "bg-red-500"
                    }`}
                    style={{ width: `${Math.min(atingimentoMeta, 100)}%` }}
                  />
                </div>
                {lucroLiquido < meta && (
                  <p className="text-xs text-muted-foreground">
                    Faltam {fmtBRL(meta - lucroLiquido)} para atingir a meta mensal
                  </p>
                )}
                {lucroLiquido >= meta && (
                  <p className="text-xs text-green-600 font-medium">
                    Meta atingida! Superada em {fmtBRL(lucroLiquido - meta)}
                  </p>
                )}
              </CardContent>
            </Card>
          )}

          {/* Resumo Anual */}
          {receita > 0 && (
            <Card className="bg-gradient-to-br from-slate-800 to-slate-900 text-white border-0">
              <CardHeader className="pb-2">
                <CardTitle className="text-base text-slate-200 flex items-center gap-2">
                  <BarChart3 className="h-4 w-4" />
                  Projeção Anual (12 meses)
                </CardTitle>
                <CardDescription className="text-slate-400 text-xs">
                  Com base nos dados mensais atuais
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <p className="text-slate-400 text-xs">Receita</p>
                    <p className="text-xl font-bold text-white">{fmtBRL(receita * 12)}</p>
                  </div>
                  <div>
                    <p className="text-slate-400 text-xs">Custos Totais</p>
                    <p className="text-xl font-bold text-red-400">{fmtBRL((custosVar + custosFixos) * 12)}</p>
                  </div>
                  <div>
                    <p className="text-slate-400 text-xs">Lucro Líquido</p>
                    <p className={`text-xl font-bold ${lucroLiquido >= 0 ? "text-green-400" : "text-red-400"}`}>
                      {fmtBRL(lucroLiquido * 12)}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {!hasData && (
            <div className="flex flex-col items-center justify-center py-16 text-center text-muted-foreground">
              <Building2 className="h-12 w-12 mb-3 opacity-30" />
              <p className="font-medium">Preencha os dados à esquerda</p>
              <p className="text-sm mt-1">As métricas serão calculadas automaticamente</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
