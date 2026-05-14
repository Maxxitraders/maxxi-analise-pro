import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import {
  TrendingUp,
  Loader2,
  User,
  Building2,
  DollarSign,
  CreditCard,
  Calendar,
  Database,
  AlertCircle,
  Wallet,
  Search,
  ArrowLeft,
  CheckCircle2,
} from "lucide-react";

const CUSTO_CONSULTA = 3.0;

function formatCpfInput(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 11);
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 3)}.${digits.slice(3)}`;
  if (digits.length <= 9) return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`;
  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
}

function formatCnpj(cnpj: string): string {
  return cnpj.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5");
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

function MargemBar({ disponivel, utilizada, total }: { disponivel: number; utilizada: number; total: number }) {
  const pctUtilizada = total > 0 ? Math.min((utilizada / total) * 100, 100) : 0;
  const pctDisponivel = total > 0 ? Math.min((disponivel / total) * 100, 100) : 0;

  return (
    <div className="space-y-1">
      <div className="flex h-3 w-full overflow-hidden rounded-full bg-muted">
        <div className="h-full bg-red-400 transition-all" style={{ width: `${pctUtilizada}%` }} />
        <div className="h-full bg-emerald-400 transition-all" style={{ width: `${pctDisponivel}%` }} />
      </div>
      <div className="flex justify-between text-xs text-muted-foreground">
        <span className="flex items-center gap-1">
          <span className="inline-block h-2 w-2 rounded-full bg-red-400" /> Utilizado
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block h-2 w-2 rounded-full bg-emerald-400" /> Disponível
        </span>
      </div>
    </div>
  );
}

type VinculoEmpresa = {
  cnpj: string;
  nomeEmpresa: string;
  matricula: string | null;
  situacao: string | null;
};

type ResultadoMargem = {
  cpf: string;
  matricula: string;
  cnpj: string;
  nomeCompleto: string | null;
  dataNascimento: string | null;
  margemDisponivel: number;
  margemUtilizada: number;
  margemTotal: number;
  margemCartaoDisponivel: number;
  margemCartaoUtilizada: number;
  orgao: string | null;
  competencia: string | null;
  dataSource: "apifull" | "simulado";
};

type Etapa = "cpf" | "vinculos" | "confirmar";

export default function ConsultaMargemConsignavel() {
  const [etapa, setEtapa] = useState<Etapa>("cpf");
  const [cpf, setCpf] = useState("");
  const [cpfBuscado, setCpfBuscado] = useState("");
  const [vinculoSelecionado, setVinculoSelecionado] = useState<VinculoEmpresa | null>(null);
  const [matricula, setMatricula] = useState("");
  const [resultado, setResultado] = useState<ResultadoMargem | null>(null);

  const saldoQuery = trpc.wallet.getSaldo.useQuery();

  const vinculosQuery = trpc.margem.consultarVinculos.useQuery(
    { cpf: cpfBuscado },
    { enabled: cpfBuscado.length === 11 }
  );

  const consultarMutation = trpc.margem.consultar.useMutation({
    onSuccess(data) {
      setResultado(data as ResultadoMargem);
      saldoQuery.refetch();
      toast.success("Consulta realizada com sucesso!");
    },
    onError(err) {
      toast.error(err.message || "Erro ao consultar margem consignável.");
    },
  });

  const saldo = saldoQuery.data?.saldo ?? 0;
  const saldoInsuficiente = Number(saldo) < CUSTO_CONSULTA;

  function handleBuscarVinculos(e: React.FormEvent) {
    e.preventDefault();
    const digits = cpf.replace(/\D/g, "");
    if (digits.length !== 11) {
      toast.error("CPF deve ter 11 dígitos.");
      return;
    }
    setCpfBuscado(digits);
    setEtapa("vinculos");
  }

  function handleSelecionarVinculo(vinculo: VinculoEmpresa) {
    setVinculoSelecionado(vinculo);
    setMatricula(vinculo.matricula ?? "");
    setEtapa("confirmar");
  }

  function handleConfirmar(e: React.FormEvent) {
    e.preventDefault();
    if (!vinculoSelecionado) return;
    if (!matricula.trim()) {
      toast.error("Matrícula é obrigatória.");
      return;
    }
    consultarMutation.mutate({
      cpf: cpfBuscado,
      matricula: matricula.trim(),
      cnpj: vinculoSelecionado.cnpj,
    });
  }

  function handleVoltarParaCpf() {
    setEtapa("cpf");
    setCpfBuscado("");
    setVinculoSelecionado(null);
    setMatricula("");
    setResultado(null);
  }

  function handleVoltarParaVinculos() {
    setEtapa("vinculos");
    setVinculoSelecionado(null);
    setMatricula("");
    setResultado(null);
  }

  const vinculos = vinculosQuery.data?.vinculos ?? [];
  const nomeConsultado = vinculosQuery.data?.nomeCompleto;

  return (
    <div className="mx-auto max-w-2xl space-y-6 p-4 md:p-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
          <TrendingUp className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="text-xl font-semibold">Consulta de Margem Consignável</h1>
          <p className="text-sm text-muted-foreground">
            {etapa === "cpf" && "Digite o CPF para localizar os vínculos empregatícios"}
            {etapa === "vinculos" && "Selecione a empresa para consultar a margem"}
            {etapa === "confirmar" && "Confirme os dados e consulte a margem"}
          </p>
        </div>
      </div>

      {/* Indicador de etapas */}
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <span className={etapa === "cpf" ? "font-semibold text-primary" : ""}>1. CPF</span>
        <span>›</span>
        <span className={etapa === "vinculos" ? "font-semibold text-primary" : ""}>2. Vínculos</span>
        <span>›</span>
        <span className={etapa === "confirmar" ? "font-semibold text-primary" : ""}>3. Margem</span>
      </div>

      {/* ── ETAPA 1: CPF ── */}
      {etapa === "cpf" && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Buscar Vínculos por CPF</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleBuscarVinculos} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="cpf-input">
                  CPF do Titular <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="cpf-input"
                  placeholder="000.000.000-00"
                  value={cpf}
                  onChange={(e) => setCpf(formatCpfInput(e.target.value))}
                  maxLength={14}
                  autoComplete="off"
                  inputMode="numeric"
                />
              </div>

              <div className="flex items-center justify-between rounded-lg border bg-muted/40 px-3 py-2 text-sm">
                <span className="text-muted-foreground">Busca de vínculos</span>
                <Badge variant="secondary" className="text-xs">Gratuito</Badge>
              </div>

              <Button
                type="submit"
                disabled={cpf.replace(/\D/g, "").length !== 11}
                className="w-full"
              >
                <Search className="mr-2 h-4 w-4" />
                Buscar Vínculos
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      {/* ── ETAPA 2: VÍNCULOS ── */}
      {etapa === "vinculos" && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Vínculos Encontrados</CardTitle>
              <Button variant="ghost" size="sm" onClick={handleVoltarParaCpf}>
                <ArrowLeft className="mr-1 h-4 w-4" />
                Novo CPF
              </Button>
            </div>
            {nomeConsultado && (
              <div className="flex items-center gap-2 pt-1 text-sm">
                <User className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium">{nomeConsultado}</span>
                {vinculosQuery.data?.dataSource === "simulado" && (
                  <Badge variant="outline" className="border-amber-300 text-amber-600 text-[10px]">
                    Simulado
                  </Badge>
                )}
              </div>
            )}
          </CardHeader>
          <CardContent className="space-y-3">
            {vinculosQuery.isLoading && (
              <div className="flex items-center justify-center py-8 text-muted-foreground">
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                Buscando vínculos...
              </div>
            )}

            {vinculosQuery.isError && (
              <div className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-3 text-sm text-destructive">
                <AlertCircle className="h-4 w-4 shrink-0" />
                {vinculosQuery.error.message || "Erro ao buscar vínculos."}
              </div>
            )}

            {!vinculosQuery.isLoading && !vinculosQuery.isError && vinculos.length === 0 && (
              <div className="py-6 text-center text-sm text-muted-foreground">
                Nenhum vínculo encontrado para este CPF.
              </div>
            )}

            {vinculos.map((v, i) => (
              <div
                key={i}
                className="flex items-start justify-between gap-3 rounded-lg border p-3"
              >
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex items-center gap-2">
                    <Building2 className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <span className="truncate text-sm font-medium">{v.nomeEmpresa || "Empresa"}</span>
                  </div>
                  <p className="pl-6 text-xs text-muted-foreground">
                    CNPJ: {v.cnpj ? formatCnpj(v.cnpj) : "—"}
                  </p>
                  {v.matricula && (
                    <p className="pl-6 text-xs text-muted-foreground">
                      Matrícula: {v.matricula}
                    </p>
                  )}
                  {v.situacao && (
                    <div className="pl-6">
                      <Badge
                        variant="outline"
                        className={`text-[10px] ${
                          v.situacao.toUpperCase() === "ATIVO"
                            ? "border-emerald-300 text-emerald-600"
                            : "border-muted-foreground/30 text-muted-foreground"
                        }`}
                      >
                        {v.situacao}
                      </Badge>
                    </div>
                  )}
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  className="shrink-0"
                  onClick={() => handleSelecionarVinculo(v)}
                >
                  Selecionar
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* ── ETAPA 3: CONFIRMAR ── */}
      {etapa === "confirmar" && vinculoSelecionado && !resultado && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Confirmar Consulta</CardTitle>
              <Button variant="ghost" size="sm" onClick={handleVoltarParaVinculos}>
                <ArrowLeft className="mr-1 h-4 w-4" />
                Voltar
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleConfirmar} className="space-y-4">
              {/* Empresa selecionada */}
              <div className="flex items-start gap-2 rounded-lg border bg-muted/30 px-3 py-2">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{vinculoSelecionado.nomeEmpresa}</p>
                  <p className="text-xs text-muted-foreground">
                    CNPJ: {formatCnpj(vinculoSelecionado.cnpj)}
                  </p>
                </div>
              </div>

              {/* Matrícula (pré-preenchida se disponível) */}
              <div className="space-y-1.5">
                <Label htmlFor="matricula-input">
                  Matrícula <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="matricula-input"
                  placeholder="Ex: 09613446080166608132"
                  value={matricula}
                  onChange={(e) => setMatricula(e.target.value)}
                  autoComplete="off"
                />
                {vinculoSelecionado.matricula && (
                  <p className="text-xs text-muted-foreground">
                    Pré-preenchida com o vínculo selecionado. Ajuste se necessário.
                  </p>
                )}
              </div>

              {/* Custo e saldo */}
              <div className="flex items-center justify-between rounded-lg border bg-muted/40 px-3 py-2 text-sm">
                <span className="flex items-center gap-1.5 text-muted-foreground">
                  <Wallet className="h-4 w-4" />
                  Custo da consulta
                </span>
                <span className="font-semibold text-primary">{formatCurrency(CUSTO_CONSULTA)}</span>
              </div>

              {saldoInsuficiente && (
                <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-700">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  Saldo insuficiente. Você tem {formatCurrency(Number(saldo))} — recarregue sua carteira.
                </div>
              )}

              <Button
                type="submit"
                disabled={!matricula.trim() || saldoInsuficiente || consultarMutation.isPending}
                className="w-full"
              >
                {consultarMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Consultando...
                  </>
                ) : (
                  "Consultar Margem"
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      {/* ── RESULTADO ── */}
      {resultado && (
        <>
          <Button variant="outline" size="sm" onClick={handleVoltarParaCpf} className="w-full">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Nova Consulta
          </Button>

          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">Resultado da Consulta</CardTitle>
                <Badge
                  variant="outline"
                  className={
                    resultado.dataSource === "simulado"
                      ? "border-amber-300 text-amber-600 text-[10px]"
                      : "border-emerald-300 text-emerald-600 text-[10px]"
                  }
                >
                  <Database className="mr-1 h-2.5 w-2.5" />
                  {resultado.dataSource === "simulado" ? "Simulado" : "API Full"}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Dados pessoais */}
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="flex items-start gap-2">
                  <User className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                  <div>
                    <p className="text-xs text-muted-foreground">Nome Completo</p>
                    <p className="text-sm font-medium">{resultado.nomeCompleto ?? "—"}</p>
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <Calendar className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                  <div>
                    <p className="text-xs text-muted-foreground">Data de Nascimento</p>
                    <p className="text-sm font-medium">{resultado.dataNascimento ?? "—"}</p>
                  </div>
                </div>
                <div className="flex items-start gap-2 sm:col-span-2">
                  <Building2 className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                  <div>
                    <p className="text-xs text-muted-foreground">Órgão / Empresa</p>
                    <p className="text-sm font-medium">{resultado.orgao ?? "—"}</p>
                  </div>
                </div>
              </div>

              <Separator />

              {/* Margem crédito */}
              <div>
                <div className="mb-2 flex items-center gap-2">
                  <DollarSign className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-semibold">Margem para Empréstimo</span>
                  {resultado.competencia && (
                    <span className="ml-auto text-xs text-muted-foreground">
                      Competência: {resultado.competencia}
                    </span>
                  )}
                </div>
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="rounded-lg border bg-muted/30 p-2">
                    <p className="text-[11px] text-muted-foreground">Total</p>
                    <p className="text-sm font-semibold">{formatCurrency(resultado.margemTotal)}</p>
                  </div>
                  <div className="rounded-lg border border-red-200 bg-red-50 p-2">
                    <p className="text-[11px] text-red-600">Utilizado</p>
                    <p className="text-sm font-semibold text-red-700">{formatCurrency(resultado.margemUtilizada)}</p>
                  </div>
                  <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-2">
                    <p className="text-[11px] text-emerald-600">Disponível</p>
                    <p className="text-sm font-semibold text-emerald-700">{formatCurrency(resultado.margemDisponivel)}</p>
                  </div>
                </div>
                <div className="mt-3">
                  <MargemBar
                    disponivel={resultado.margemDisponivel}
                    utilizada={resultado.margemUtilizada}
                    total={resultado.margemTotal}
                  />
                </div>
              </div>

              <Separator />

              {/* Margem cartão */}
              <div>
                <div className="mb-2 flex items-center gap-2">
                  <CreditCard className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-semibold">Margem para Cartão Consignado</span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-center">
                  <div className="rounded-lg border border-red-200 bg-red-50 p-2">
                    <p className="text-[11px] text-red-600">Utilizado</p>
                    <p className="text-sm font-semibold text-red-700">{formatCurrency(resultado.margemCartaoUtilizada)}</p>
                  </div>
                  <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-2">
                    <p className="text-[11px] text-emerald-600">Disponível</p>
                    <p className="text-sm font-semibold text-emerald-700">{formatCurrency(resultado.margemCartaoDisponivel)}</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
