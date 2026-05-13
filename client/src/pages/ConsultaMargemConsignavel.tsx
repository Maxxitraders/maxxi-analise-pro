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
  Info,
} from "lucide-react";

const CUSTO_CONSULTA = 3.0;

function formatCpfInput(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 11);
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 3)}.${digits.slice(3)}`;
  if (digits.length <= 9) return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`;
  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
}

function formatCnpjInput(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 14);
  if (digits.length <= 2) return digits;
  if (digits.length <= 5) return `${digits.slice(0, 2)}.${digits.slice(2)}`;
  if (digits.length <= 8) return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5)}`;
  if (digits.length <= 12) return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8)}`;
  return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8, 12)}-${digits.slice(12)}`;
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
        <div
          className="h-full bg-red-400 transition-all"
          style={{ width: `${pctUtilizada}%` }}
        />
        <div
          className="h-full bg-emerald-400 transition-all"
          style={{ width: `${pctDisponivel}%` }}
        />
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

export default function ConsultaMargemConsignavel() {
  const [cpf, setCpf] = useState("");
  const [matricula, setMatricula] = useState("");
  const [cnpj, setCnpj] = useState("");
  const [resultado, setResultado] = useState<ResultadoMargem | null>(null);

  const saldoQuery = trpc.wallet.getSaldo.useQuery();
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
  const cpfDigits = cpf.replace(/\D/g, "");
  const cnpjDigits = cnpj.replace(/\D/g, "");
  const formValido = cpfDigits.length === 11 && matricula.trim().length > 0 && cnpjDigits.length === 14;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (cpfDigits.length !== 11) {
      toast.error("CPF deve ter 11 dígitos.");
      return;
    }
    if (!matricula.trim()) {
      toast.error("Matrícula é obrigatória.");
      return;
    }
    if (cnpjDigits.length !== 14) {
      toast.error("CNPJ deve ter 14 dígitos.");
      return;
    }
    consultarMutation.mutate({ cpf: cpfDigits, matricula: matricula.trim(), cnpj: cnpjDigits });
  }

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
            Informe CPF, matrícula e CNPJ para consultar a margem disponível
          </p>
        </div>
      </div>

      {/* Form */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Dados da Consulta</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* 3 campos em grid */}
            <div className="grid gap-4 sm:grid-cols-3">
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
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="cnpj-input">
                  CNPJ da Empresa <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="cnpj-input"
                  placeholder="00.000.000/0000-00"
                  value={cnpj}
                  onChange={(e) => setCnpj(formatCnpjInput(e.target.value))}
                  maxLength={18}
                  autoComplete="off"
                  inputMode="numeric"
                />
              </div>
            </div>

            {/* Dica sobre os campos */}
            <div className="flex items-start gap-2 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-800">
              <Info className="mt-0.5 h-4 w-4 shrink-0" />
              <span>
                <strong>CPF</strong> do titular do empréstimo ·{" "}
                <strong>Matrícula</strong> consta no holerite ·{" "}
                <strong>CNPJ</strong> da empresa empregadora
              </span>
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
              disabled={!formValido || saldoInsuficiente || consultarMutation.isPending}
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

      {/* Resultado */}
      {resultado && (
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
      )}
    </div>
  );
}
