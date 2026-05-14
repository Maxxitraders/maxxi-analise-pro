import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import {
  FileSearch,
  Loader2,
  AlertCircle,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  User,
  TrendingUp,
  Wallet,
  FileText,
  CreditCard,
  RefreshCw,
} from "lucide-react";
import type { ResultadoSerasa } from "@server/creditEngine";

// ── helpers ──────────────────────────────────────────────────────────────────

function formatCpfInput(value: string): string {
  const d = value.replace(/\D/g, "").slice(0, 11);
  if (d.length <= 3) return d;
  if (d.length <= 6) return `${d.slice(0, 3)}.${d.slice(3)}`;
  if (d.length <= 9) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6)}`;
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
}

function formatBRL(value: number): string {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function scoreColor(score: number): string {
  if (score >= 700) return "text-emerald-600";
  if (score >= 500) return "text-amber-500";
  if (score >= 300) return "text-orange-500";
  return "text-red-600";
}

function scoreBg(score: number): string {
  if (score >= 700) return "bg-emerald-50 border-emerald-200";
  if (score >= 500) return "bg-amber-50 border-amber-200";
  if (score >= 300) return "bg-orange-50 border-orange-200";
  return "bg-red-50 border-red-200";
}

function ScoreIcon({ score }: { score: number }) {
  if (score >= 700) return <CheckCircle2 className="h-6 w-6 text-emerald-600" />;
  if (score >= 500) return <AlertTriangle className="h-6 w-6 text-amber-500" />;
  return <XCircle className="h-6 w-6 text-red-500" />;
}

// ── main component ────────────────────────────────────────────────────────────

export default function ConsultaSerasa() {
  const { user } = useAuth();
  const [cpfInput, setCpfInput] = useState("");
  const [resultado, setResultado] = useState<ResultadoSerasa | null>(null);

  const saldoQuery = trpc.wallet.getSaldo.useQuery();
  const saldo = parseFloat(String(saldoQuery.data?.saldo ?? "0"));

  const consultarMut = trpc.serasa.consultar.useMutation({
    onSuccess: (data) => {
      setResultado(data);
      saldoQuery.refetch();
      toast.success("Consulta Serasa Premium concluída!");
    },
    onError: (err) => {
      toast.error(err.message || "Erro ao consultar Serasa Premium.");
    },
  });

  const cpfDigits = cpfInput.replace(/\D/g, "");
  const cpfValido = cpfDigits.length === 11;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!cpfValido) return;
    setResultado(null);
    consultarMut.mutate({ cpf: cpfDigits });
  }

  function handleNova() {
    setCpfInput("");
    setResultado(null);
  }

  const isLoading = consultarMut.isPending;

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 mb-1">
          <FileSearch className="h-5 w-5 text-primary" />
          <h1 className="text-xl font-semibold">Serasa Premium</h1>
        </div>
        <p className="text-sm text-muted-foreground">
          Consulta completa de CPF com score, pendências, protestos e cheques.
        </p>
      </div>

      {/* Formulário */}
      {!resultado && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center justify-between">
              <span>Consultar CPF</span>
              <div className="flex items-center gap-1.5 text-sm font-normal text-muted-foreground">
                <Wallet className="h-4 w-4" />
                {saldoQuery.isLoading ? (
                  <span>carregando...</span>
                ) : (
                  <span>
                    Saldo:{" "}
                    <span className={saldo >= 15 ? "text-emerald-600 font-medium" : "text-red-500 font-medium"}>
                      {formatBRL(saldo)}
                    </span>
                  </span>
                )}
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-sm font-medium">CPF</label>
                <Input
                  placeholder="000.000.000-00"
                  value={cpfInput}
                  onChange={(e) => setCpfInput(formatCpfInput(e.target.value))}
                  maxLength={14}
                  disabled={isLoading}
                  className="font-mono text-base tracking-wider"
                />
              </div>

              {saldo < 15 && !saldoQuery.isLoading && (
                <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm text-amber-700">
                  <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                  <span>
                    Saldo insuficiente. Você precisa de{" "}
                    <strong>R$ 15,00</strong> para esta consulta.{" "}
                    <a href="/carteira" className="underline font-medium">
                      Adicionar créditos
                    </a>
                  </span>
                </div>
              )}

              <Button
                type="submit"
                className="w-full"
                disabled={!cpfValido || isLoading || saldo < 15}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Consultando...
                  </>
                ) : (
                  <>
                    <FileSearch className="mr-2 h-4 w-4" />
                    Consultar Serasa Premium — R$ 15,00
                  </>
                )}
              </Button>

              <p className="text-xs text-muted-foreground text-center">
                O valor de R$ 15,00 será debitado do seu saldo. Se a consulta falhar, o valor é estornado automaticamente.
              </p>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Resultado */}
      {resultado && (
        <div className="space-y-4">
          {/* Cabeçalho do resultado */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <User className="h-4 w-4 text-muted-foreground" />
              <span className="font-medium">{resultado.nome}</span>
              {resultado.dataNascimento && (
                <span className="text-sm text-muted-foreground">
                  — Nasc. {resultado.dataNascimento}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Badge
                variant="outline"
                className={
                  resultado.dataSource === "simulado"
                    ? "border-amber-300 text-amber-600"
                    : "border-emerald-300 text-emerald-600"
                }
              >
                {resultado.dataSource === "simulado" ? "Simulado" : "Dados Reais"}
              </Badge>
              <Button size="sm" variant="outline" onClick={handleNova}>
                <RefreshCw className="mr-1 h-3.5 w-3.5" />
                Nova consulta
              </Button>
            </div>
          </div>

          <p className="text-xs text-muted-foreground">
            CPF: {resultado.cpf}
          </p>

          {/* Score */}
          <Card className={`border-2 ${scoreBg(resultado.score)}`}>
            <CardContent className="pt-5 pb-5">
              <div className="flex items-center gap-4">
                <div className="flex flex-col items-center justify-center rounded-xl border-2 border-current w-24 h-24 shrink-0" style={{ borderColor: "currentColor" }}>
                  <span className={`text-3xl font-bold tabular-nums ${scoreColor(resultado.score)}`}>
                    {resultado.score}
                  </span>
                  <span className="text-xs text-muted-foreground">/ 1000</span>
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <ScoreIcon score={resultado.score} />
                    <span className={`text-lg font-semibold ${scoreColor(resultado.score)}`}>
                      {resultado.scoreCategoria}
                    </span>
                  </div>
                  {resultado.scoreMensagem && (
                    <p className="text-sm text-muted-foreground line-clamp-3">
                      {resultado.scoreMensagem}
                    </p>
                  )}
                  {resultado.probabilidadeInadimplencia && (
                    <p className="text-xs text-muted-foreground mt-1">
                      Probabilidade de inadimplência: {resultado.probabilidadeInadimplencia}
                    </p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Cards de resumo */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <SummaryCard
              label="Pendências"
              value={resultado.pendencias.quantidade}
              total={resultado.pendencias.total}
              danger={resultado.pendencias.quantidade > 0}
            />
            <SummaryCard
              label="Protestos"
              value={resultado.protestos.quantidade}
              total={resultado.protestos.total}
              danger={resultado.protestos.quantidade > 0}
            />
            <SummaryCard
              label="Cheques s/ Fundo"
              value={resultado.chequesSemFundo}
              danger={resultado.chequesSemFundo > 0}
            />
            <SummaryCard
              label="Cheques Sustados"
              value={resultado.chequesSustados}
              danger={resultado.chequesSustados > 0}
            />
          </div>

          {/* Informações adicionais */}
          {(resultado.rendaPresumida || resultado.contumacia > 0) && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-muted-foreground" />
                  Informações Adicionais
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-1.5 text-sm">
                {resultado.rendaPresumida && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Renda Presumida</span>
                    <span className="font-medium">{resultado.rendaPresumida}</span>
                  </div>
                )}
                {resultado.contumacia > 0 && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Contumácia</span>
                    <span className="font-medium text-red-600">{resultado.contumacia}</span>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Pendências financeiras */}
          {resultado.pendencias.itens.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 text-red-500" />
                  Pendências Financeiras
                  <Badge variant="destructive" className="ml-auto">
                    {resultado.pendencias.quantidade}
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="divide-y">
                  {resultado.pendencias.itens.map((p, i) => (
                    <div key={i} className="flex items-center justify-between px-4 py-2.5 text-sm">
                      <div>
                        <p className="font-medium">{p.credor || "Credor não informado"}</p>
                        {p.data && (
                          <p className="text-xs text-muted-foreground">{p.data}</p>
                        )}
                      </div>
                      <span className="font-medium text-red-600 tabular-nums">
                        {formatBRL(parseFloat(p.valor) || 0)}
                      </span>
                    </div>
                  ))}
                </div>
                <div className="flex justify-between px-4 py-2.5 border-t bg-muted/30 text-sm font-semibold">
                  <span>Total</span>
                  <span className="text-red-600">{formatBRL(resultado.pendencias.total)}</span>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Protestos */}
          {resultado.protestos.itens.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <FileText className="h-4 w-4 text-orange-500" />
                  Protestos
                  <Badge className="ml-auto bg-orange-100 text-orange-700 hover:bg-orange-100">
                    {resultado.protestos.quantidade}
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="divide-y">
                  {resultado.protestos.itens.map((p, i) => (
                    <div key={i} className="flex items-center justify-between px-4 py-2.5 text-sm">
                      <div>
                        <p className="font-medium">{p.cartorio || "Cartório não informado"}</p>
                        <p className="text-xs text-muted-foreground">
                          {p.cidade && `${p.cidade} — `}{p.data}
                        </p>
                      </div>
                      <span className="font-medium text-orange-600 tabular-nums">
                        {formatBRL(parseFloat(p.valor) || 0)}
                      </span>
                    </div>
                  ))}
                </div>
                <div className="flex justify-between px-4 py-2.5 border-t bg-muted/30 text-sm font-semibold">
                  <span>Total</span>
                  <span className="text-orange-600">{formatBRL(resultado.protestos.total)}</span>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Sem restrições */}
          {resultado.pendencias.quantidade === 0 &&
            resultado.protestos.quantidade === 0 &&
            resultado.chequesSemFundo === 0 &&
            resultado.chequesSustados === 0 && (
              <Card className="border-emerald-200 bg-emerald-50/50">
                <CardContent className="py-5 flex items-center gap-3">
                  <CheckCircle2 className="h-8 w-8 text-emerald-600 shrink-0" />
                  <div>
                    <p className="font-semibold text-emerald-800">Sem restrições encontradas</p>
                    <p className="text-sm text-emerald-700">
                      Nenhuma pendência, protesto ou cheque sem fundo registrado.
                    </p>
                  </div>
                </CardContent>
              </Card>
            )}

          <Separator />
          <p className="text-xs text-muted-foreground text-center">
            Fonte: Serasa Experian via API Full •{" "}
            {new Date().toLocaleDateString("pt-BR", {
              day: "2-digit",
              month: "long",
              year: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            })}
          </p>
        </div>
      )}
    </div>
  );
}

// ── componentes auxiliares ────────────────────────────────────────────────────

function SummaryCard({
  label,
  value,
  total,
  danger,
}: {
  label: string;
  value: number;
  total?: number;
  danger: boolean;
}) {
  return (
    <Card className={danger ? "border-red-200 bg-red-50/40" : "border-emerald-200 bg-emerald-50/40"}>
      <CardContent className="py-3 px-4">
        <p className="text-xs text-muted-foreground mb-1">{label}</p>
        <p className={`text-2xl font-bold tabular-nums ${danger ? "text-red-600" : "text-emerald-600"}`}>
          {value}
        </p>
        {total !== undefined && total > 0 && (
          <p className="text-xs text-red-500 font-medium mt-0.5">
            {total.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
