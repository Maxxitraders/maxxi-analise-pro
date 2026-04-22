import { useState, useCallback } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import {
  Search,
  Loader2,
  ShieldCheck,
  ShieldAlert,
  ShieldQuestion,
  Building2,
  CreditCard,
  AlertTriangle,
  FileText,
  ArrowRight,
  MapPin,
  Users,
  Database,
  Phone,
  Mail,
  User,
} from "lucide-react";
import { useLocation } from "wouter";

function formatDocumentInput(value: string): string {
  const digits = value.replace(/\D/g, "");

  // CPF: 000.000.000-00
  if (digits.length <= 11) {
    if (digits.length <= 3) return digits;
    if (digits.length <= 6) return `${digits.slice(0, 3)}.${digits.slice(3)}`;
    if (digits.length <= 9) return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`;
    return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
  }

  // CNPJ: 00.000.000/0000-00
  const cnpjDigits = digits.slice(0, 14);
  if (cnpjDigits.length <= 2) return cnpjDigits;
  if (cnpjDigits.length <= 5) return `${cnpjDigits.slice(0, 2)}.${cnpjDigits.slice(2)}`;
  if (cnpjDigits.length <= 8) return `${cnpjDigits.slice(0, 2)}.${cnpjDigits.slice(2, 5)}.${cnpjDigits.slice(5)}`;
  if (cnpjDigits.length <= 12) return `${cnpjDigits.slice(0, 2)}.${cnpjDigits.slice(2, 5)}.${cnpjDigits.slice(5, 8)}/${cnpjDigits.slice(8)}`;
  return `${cnpjDigits.slice(0, 2)}.${cnpjDigits.slice(2, 5)}.${cnpjDigits.slice(5, 8)}/${cnpjDigits.slice(8, 12)}-${cnpjDigits.slice(12)}`;
}

function StatusIcon({ status }: { status: string }) {
  if (status === "APROVADO") return <ShieldCheck className="h-8 w-8 text-emerald-500" />;
  if (status === "REPROVADO") return <ShieldAlert className="h-8 w-8 text-red-500" />;
  return <ShieldQuestion className="h-8 w-8 text-amber-500" />;
}

function StatusBadge({ status }: { status: string }) {
  const config: Record<string, { label: string; className: string }> = {
    APROVADO: { label: "Aprovado", className: "bg-emerald-100 text-emerald-700 border-0 text-sm px-4 py-1" },
    REPROVADO: { label: "Reprovado", className: "bg-red-100 text-red-700 border-0 text-sm px-4 py-1" },
    ANALISE_MANUAL: { label: "Análise Manual", className: "bg-amber-100 text-amber-700 border-0 text-sm px-4 py-1" },
  };
  const c = config[status] || config.ANALISE_MANUAL;
  return <Badge className={c.className}>{c.label}</Badge>;
}

function DataSourceBadge({ source }: { source: string }) {
  const isReal = source === "brasilapi" || source === "apifull_boavista" || source === "apifull";
  return (
    <Badge variant="outline" className={`text-[10px] px-2 py-0 font-normal ${isReal ? "border-emerald-300 text-emerald-600" : "border-amber-300 text-amber-600"}`}>
      <Database className="h-2.5 w-2.5 mr-1" />
      {source === "brasilapi" ? "Receita Federal" : source === "apifull_boavista" ? "Boa Vista SCPC" : source === "apifull" ? "Boa Vista" : "Simulado"}
    </Badge>
  );
}

function ScoreGauge({ score }: { score: number }) {
  const pct = (score / 1000) * 100;
  const getColor = (s: number) => {
    if (s >= 700) return { bar: "bg-emerald-500", text: "text-emerald-600", label: "Excelente" };
    if (s >= 400) return { bar: "bg-amber-500", text: "text-amber-600", label: "Moderado" };
    return { bar: "bg-red-500", text: "text-red-600", label: "Crítico" };
  };
  const c = getColor(score);
  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between">
        <span className={`text-4xl font-bold tabular-nums ${c.text}`}>{score}</span>
        <span className="text-sm text-muted-foreground">/ 1000</span>
      </div>
      <div className="h-3 rounded-full bg-muted overflow-hidden">
        <div className={`h-full rounded-full ${c.bar} transition-all duration-700`} style={{ width: `${pct}%` }} />
      </div>
      <p className={`text-sm font-medium ${c.text}`}>{c.label}</p>
    </div>
  );
}

export default function Consulta() {
  const [docInput, setDocInput] = useState("");
  const [, setLocation] = useLocation();

  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const subscriptionQuery = trpc.subscription.mySubscription.useQuery(undefined, {
    enabled: !!user && !isAdmin,
  });

  const analyzeMutation = trpc.credit.analyze.useMutation({
    onError: (err) => {
      // Se o erro for de limite de consultas ou assinatura, redirecionar para planos
      if (err.message?.includes("limite") || err.message?.includes("assinatura ativa") || err.message?.includes("Plano não encontrado")) {
        toast.error(err.message, {
          action: {
            label: "Ver Planos",
            onClick: () => setLocation("/planos"),
          },
          duration: 8000,
        });
        return;
      }
      // Erro de serviço indisponível — API falhou, crédito NÃO foi debitado
      if (err.message?.includes("não foi possível") || err.message?.includes("não foi debitada") || err.message?.includes("serviço de consulta")) {
        toast.error(err.message, {
          description: "Sua consulta não foi debitada. Tente novamente.",
          duration: 10000,
        });
        return;
      }
      toast.error(err.message || "Erro ao realizar a análise.");
    },
  });

  const handleDocChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setDocInput(formatDocumentInput(e.target.value));
  }, []);

  const digits = docInput.replace(/\D/g, "");
  const isCpf = digits.length <= 11;
  const docLabel = isCpf ? "CPF" : "CNPJ";

  // Verificar se o usuário tem créditos disponíveis
  const sub = subscriptionQuery.data;
  const hasNoSubscription = !isAdmin && sub && sub.subscriptionStatus !== "active";
  const hasExhaustedCredits = !isAdmin && sub && sub.subscriptionStatus === "active" && sub.consultasLimit !== -1 && sub.consultasUsed >= sub.consultasLimit;

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();

      // Verificar assinatura antes de enviar
      if (hasNoSubscription) {
        toast.error("Você precisa de uma assinatura ativa para realizar consultas.", {
          action: {
            label: "Ver Planos",
            onClick: () => setLocation("/planos"),
          },
          duration: 8000,
        });
        return;
      }

      // Verificar créditos antes de enviar
      if (hasExhaustedCredits) {
        toast.error(`Você atingiu o limite de ${sub?.consultasLimit} consultas do seu plano. Faça upgrade para continuar.`, {
          action: {
            label: "Fazer Upgrade",
            onClick: () => setLocation("/planos"),
          },
          duration: 8000,
        });
        return;
      }

      if (isCpf && digits.length !== 11) {
        toast.error("CPF deve conter 11 dígitos.");
        return;
      }
      if (!isCpf && digits.length !== 14) {
        toast.error("CNPJ deve conter 14 dígitos.");
        return;
      }
      analyzeMutation.mutate({ document: digits });
    },
    [digits, isCpf, analyzeMutation, hasNoSubscription, hasExhaustedCredits, sub, setLocation, isAdmin]
  );

  const result = analyzeMutation.data;
  const isResultCpf = result?.cadastral?.documentType === "cpf";

  return (
    <div className="space-y-8 max-w-5xl">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Nova Consulta</h1>
        <p className="text-muted-foreground mt-1">Insira o CPF ou CNPJ para realizar a análise de crédito</p>
      </div>

      {/* Aviso de créditos esgotados */}
      {(hasNoSubscription || hasExhaustedCredits) && (
        <Card className="border-0 shadow-sm border-l-4 border-l-amber-500 bg-amber-50">
          <CardContent className="p-4 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0" />
              <div>
                <p className="text-sm font-medium text-amber-800">
                  {hasNoSubscription
                    ? "Você não possui uma assinatura ativa"
                    : `Você atingiu o limite de ${sub?.consultasLimit} consultas do seu plano`}
                </p>
                <p className="text-xs text-amber-700 mt-0.5">
                  {hasNoSubscription
                    ? "Assine um plano para começar a realizar consultas."
                    : "Faça upgrade do seu plano para continuar consultando."}
                </p>
              </div>
            </div>
            <Button
              variant="default"
              size="sm"
              onClick={() => setLocation("/planos")}
              className="shrink-0"
            >
              {hasNoSubscription ? "Ver Planos" : "Fazer Upgrade"}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Search Card */}
      <Card className="border-0 shadow-sm">
        <CardContent className="p-6">
          <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={isCpf ? "000.000.000-00" : "00.000.000/0000-00"}
                value={docInput}
                onChange={handleDocChange}
                className="pl-10 h-12 text-lg font-mono bg-background"
                maxLength={18}
                autoFocus
              />
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="h-12 px-4 text-sm font-medium shrink-0">
                {isCpf ? <User className="h-4 w-4 mr-1.5" /> : <Building2 className="h-4 w-4 mr-1.5" />}
                {docLabel}
              </Badge>
              <Button
                type="submit"
                size="lg"
                className="h-12 px-8 gap-2 shadow-sm"
                disabled={analyzeMutation.isPending}
              >
                {analyzeMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Analisando...
                  </>
                ) : (
                  <>
                    <Search className="h-4 w-4" />
                    Analisar
                  </>
                )}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Results */}
      {result && (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
          {/* Decision Banner */}
          <Card className="border-0 shadow-sm overflow-hidden">
            <div
              className={`p-6 ${
                result.status === "APROVADO"
                  ? "bg-emerald-50"
                  : result.status === "REPROVADO"
                  ? "bg-red-50"
                  : "bg-amber-50"
              }`}
            >
              <div className="flex items-center gap-4">
                <StatusIcon status={result.status} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 flex-wrap">
                    <h2 className="text-xl font-bold truncate">{result.cadastral.companyName}</h2>
                    <StatusBadge status={result.status} />
                    <Badge variant="outline" className="text-xs">
                      {isResultCpf ? "Pessoa Física" : "Pessoa Jurídica"}
                    </Badge>
                  </div>
                  {result.cadastral.nomeFantasia && (
                    <p className="text-sm text-muted-foreground">{result.cadastral.nomeFantasia}</p>
                  )}
                  <p className="text-sm text-muted-foreground mt-1">{result.motivo}</p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1 shrink-0 bg-white/80"
                  onClick={() => setLocation(`/detalhes/${result.id}`)}
                >
                  <FileText className="h-4 w-4" />
                  Detalhes
                  <ArrowRight className="h-3 w-3" />
                </Button>
              </div>
            </div>
          </Card>

          {/* Details Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Cadastral Data */}
            <Card className="border-0 shadow-sm">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base font-semibold flex items-center gap-2">
                    {isResultCpf ? <User className="h-4 w-4 text-muted-foreground" /> : <Building2 className="h-4 w-4 text-muted-foreground" />}
                    {isResultCpf ? "Dados Pessoais" : "Dados Cadastrais"}
                  </CardTitle>
                  <DataSourceBadge source={result.cadastral.dataSource} />
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wider">{isResultCpf ? "CPF" : "CNPJ"}</p>
                    <p className="text-sm font-mono font-medium mt-1">{result.cadastral.cnpj}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wider">Situação</p>
                    <p className="text-sm font-medium mt-1">
                      <span className={
                        ["ATIVA", "ATIVO", "REGULAR"].includes((result.cadastral.situacao || "").toUpperCase())
                          ? "text-emerald-600"
                          : "text-red-600"
                      }>
                        {result.cadastral.situacao}
                      </span>
                    </p>
                  </div>
                  {result.cadastral.dataAbertura && (
                    <div>
                      <p className="text-xs text-muted-foreground uppercase tracking-wider">{isResultCpf ? "Nascimento" : "Fundação"}</p>
                      <p className="text-sm font-medium mt-1">{result.cadastral.dataAbertura}</p>
                    </div>
                  )}
                  {!isResultCpf && result.cadastral.capitalSocial > 0 && (
                    <div>
                      <p className="text-xs text-muted-foreground uppercase tracking-wider">Capital Social</p>
                      <p className="text-sm font-medium mt-1">
                        R$ {Number(result.cadastral.capitalSocial).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                      </p>
                    </div>
                  )}
                </div>
                {!isResultCpf && result.cadastral.naturezaJuridica && (
                  <>
                    <Separator />
                    <div>
                      <p className="text-xs text-muted-foreground uppercase tracking-wider">Natureza Jurídica</p>
                      <p className="text-sm font-medium mt-1">{result.cadastral.naturezaJuridica}</p>
                    </div>
                  </>
                )}
                {result.cadastral.atividadePrincipal && (
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wider">Atividade Principal</p>
                    <p className="text-sm font-medium mt-1">{result.cadastral.atividadePrincipal}</p>
                  </div>
                )}
                {result.cadastral.porte && (
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wider">Porte</p>
                    <p className="text-sm font-medium mt-1">{result.cadastral.porte}</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Credit Data */}
            <Card className="border-0 shadow-sm">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base font-semibold flex items-center gap-2">
                    <CreditCard className="h-4 w-4 text-muted-foreground" />
                    Indicadores de Crédito
                  </CardTitle>
                  <DataSourceBadge source={result.credit.dataSource} />
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <ScoreGauge score={result.credit.score} />
                {result.credit.scoreMensagem && (
                  <p className="text-xs text-muted-foreground italic">{result.credit.scoreMensagem}</p>
                )}
                {(result.credit.scoreClassificacao || result.credit.probabilidadeInadimplencia) && (
                  <div className="flex gap-4 text-xs">
                    {result.credit.scoreClassificacao && (
                      <span className="text-muted-foreground">Classificação: <strong>{result.credit.scoreClassificacao}</strong></span>
                    )}
                    {result.credit.probabilidadeInadimplencia && (
                      <span className="text-muted-foreground">Prob. Inadimplência: <strong>{result.credit.probabilidadeInadimplencia}</strong></span>
                    )}
                  </div>
                )}
                <Separator />
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wider">Restrições</p>
                    <p className="text-sm font-medium mt-1">
                      {result.credit.hasProtestos ? (
                        <span className="text-red-600 flex items-center gap-1">
                          <AlertTriangle className="h-3.5 w-3.5" /> Sim
                        </span>
                      ) : (
                        <span className="text-emerald-600">Nenhuma</span>
                      )}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wider">Ocorrências</p>
                    <p className="text-sm font-medium mt-1">{result.credit.quantidadeRestricoes}</p>
                  </div>
                  {result.credit.chequesSemFundo > 0 && (
                    <div>
                      <p className="text-xs text-muted-foreground uppercase tracking-wider">Cheques s/ Fundo</p>
                      <p className="text-sm font-medium mt-1 text-red-600">{result.credit.chequesSemFundo}</p>
                    </div>
                  )}
                  {result.credit.contumacia > 0 && (
                    <div>
                      <p className="text-xs text-muted-foreground uppercase tracking-wider">Contumácia</p>
                      <p className="text-sm font-medium mt-1 text-red-600">{result.credit.contumacia}</p>
                    </div>
                  )}
                  {result.credit.passagensComerciais > 0 && (
                    <div>
                      <p className="text-xs text-muted-foreground uppercase tracking-wider">Consultas Anteriores</p>
                      <p className="text-sm font-medium mt-1">{result.credit.passagensComerciais}</p>
                    </div>
                  )}
                </div>
                {result.credit.rendaPresumida && (
                  <div className="p-3 rounded-lg bg-blue-50 border border-blue-100">
                    <p className="text-xs text-blue-600 uppercase tracking-wider font-medium">Renda/Faturamento Presumido</p>
                    <p className="text-sm font-semibold text-blue-700 mt-1">{result.credit.rendaPresumida}</p>
                  </div>
                )}
                {result.credit.valorDivida > 0 && (
                  <div className="p-3 rounded-lg bg-red-50 border border-red-100">
                    <p className="text-xs text-red-600 uppercase tracking-wider font-medium">Valor Total de Dívidas</p>
                    <p className="text-lg font-bold text-red-700 mt-1">
                      R$ {Number(result.credit.valorDivida).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                    </p>
                  </div>
                )}

                {/* Protestos detalhados */}
                {result.credit.protestos && result.credit.protestos.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">Protestos Detalhados</p>
                    <div className="space-y-2 max-h-48 overflow-y-auto">
                      {result.credit.protestos.slice(0, 20).map((p: any, i: number) => (
                        <div key={i} className="p-2 rounded bg-red-50/50 border border-red-100 text-sm">
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">{p.data}</span>
                            <span className="font-semibold text-red-700">R$ {p.valor}</span>
                          </div>
                          {p.cidade && <p className="text-xs text-muted-foreground">{p.cartorio ? `${p.cartorio} - ` : ""}{p.cidade}</p>}
                        </div>
                      ))}
                      {result.credit.protestos.length > 20 && (
                        <p className="text-xs text-muted-foreground text-center">
                          + {result.credit.protestos.length - 20} protestos adicionais
                        </p>
                      )}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Endereço e Contato */}
            {(result.cadastral.endereco || result.cadastral.telefone || result.cadastral.email) && (
              <Card className="border-0 shadow-sm">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base font-semibold flex items-center gap-2">
                    <MapPin className="h-4 w-4 text-muted-foreground" />
                    Endereço e Contato
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {result.cadastral.endereco && (
                    <div>
                      <p className="text-xs text-muted-foreground uppercase tracking-wider">Endereço</p>
                      <p className="text-sm font-medium mt-1">{result.cadastral.endereco}</p>
                      {(result.cadastral.bairro || result.cadastral.cidade) && (
                        <p className="text-sm text-muted-foreground">
                          {[result.cadastral.bairro, result.cadastral.cidade, result.cadastral.uf].filter(Boolean).join(" - ")}
                          {result.cadastral.cep ? ` | CEP: ${result.cadastral.cep}` : ""}
                        </p>
                      )}
                    </div>
                  )}
                  <div className="flex gap-6">
                    {result.cadastral.telefone && (
                      <div className="flex items-center gap-2 text-sm">
                        <Phone className="h-3.5 w-3.5 text-muted-foreground" />
                        <span>{result.cadastral.telefone}</span>
                      </div>
                    )}
                    {result.cadastral.email && (
                      <div className="flex items-center gap-2 text-sm">
                        <Mail className="h-3.5 w-3.5 text-muted-foreground" />
                        <span>{result.cadastral.email}</span>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Sócios (apenas para CNPJ) */}
            {!isResultCpf && result.cadastral.socios && result.cadastral.socios.length > 0 && (
              <Card className="border-0 shadow-sm">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base font-semibold flex items-center gap-2">
                    <Users className="h-4 w-4 text-muted-foreground" />
                    Quadro Societário ({result.cadastral.socios.length})
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3 max-h-64 overflow-y-auto">
                    {result.cadastral.socios.map((s: any, i: number) => (
                      <div key={i} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                        <div>
                          <p className="text-sm font-medium">{s.nome}</p>
                          <p className="text-xs text-muted-foreground">{s.qualificacao}</p>
                        </div>
                        {s.dataEntrada && (
                          <span className="text-xs text-muted-foreground">Desde {s.dataEntrada}</span>
                        )}
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
