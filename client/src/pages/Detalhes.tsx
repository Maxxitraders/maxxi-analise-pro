import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ArrowLeft,
  Building2,
  CreditCard,
  ShieldCheck,
  ShieldAlert,
  ShieldQuestion,
  AlertTriangle,
  FileText,
  Calendar,
  Banknote,
  Scale,
  Printer,
  MapPin,
  Users,
  Phone,
  Mail,
  Database,
  Gavel,
  CircleDollarSign,
  History,
} from "lucide-react";
import { useLocation, useParams } from "wouter";

function StatusIcon({ status }: { status: string }) {
  if (status === "APROVADO") return <ShieldCheck className="h-10 w-10 text-emerald-500" />;
  if (status === "REPROVADO") return <ShieldAlert className="h-10 w-10 text-red-500" />;
  return <ShieldQuestion className="h-10 w-10 text-amber-500" />;
}

function StatusBadge({ status }: { status: string }) {
  const config: Record<string, { label: string; className: string }> = {
    APROVADO: { label: "Aprovado", className: "bg-emerald-100 text-emerald-700 border-0 text-base px-5 py-1.5" },
    REPROVADO: { label: "Reprovado", className: "bg-red-100 text-red-700 border-0 text-base px-5 py-1.5" },
    ANALISE_MANUAL: { label: "Análise Manual", className: "bg-amber-100 text-amber-700 border-0 text-base px-5 py-1.5" },
  };
  const c = config[status] || config.ANALISE_MANUAL;
  return <Badge className={c.className}>{c.label}</Badge>;
}

function DataSourceBadge({ source }: { source: string | null | undefined }) {
  if (!source) return null;
  const isReal = source === "brasilapi" || source === "apifull_boavista";
  return (
    <Badge variant="outline" className={`text-[10px] px-2 py-0 font-normal ${isReal ? "border-emerald-300 text-emerald-600" : "border-amber-300 text-amber-600"}`}>
      <Database className="h-2.5 w-2.5 mr-1" />
      {source === "brasilapi" ? "Receita Federal" : source === "apifull_boavista" ? "Boa Vista SCPC" : "Simulado"}
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
    <div className="space-y-3">
      <div className="flex items-baseline justify-between">
        <span className={`text-5xl font-bold tabular-nums ${c.text}`}>{score}</span>
        <span className="text-sm text-muted-foreground">/ 1000</span>
      </div>
      <div className="h-3 rounded-full bg-muted overflow-hidden">
        <div className={`h-full rounded-full ${c.bar} transition-all duration-700`} style={{ width: `${pct}%` }} />
      </div>
      <p className={`text-sm font-medium ${c.text}`}>{c.label}</p>
    </div>
  );
}

function InfoRow({ icon: Icon, label, value, valueClass }: { icon: React.ElementType; label: string; value: string; valueClass?: string }) {
  return (
    <div className="flex items-start gap-3 py-3">
      <div className="h-8 w-8 rounded-lg bg-muted flex items-center justify-center shrink-0 mt-0.5">
        <Icon className="h-4 w-4 text-muted-foreground" />
      </div>
      <div>
        <p className="text-xs text-muted-foreground uppercase tracking-wider">{label}</p>
        <p className={`text-sm font-medium mt-0.5 ${valueClass || ""}`}>{value}</p>
      </div>
    </div>
  );
}

function safeParseJson(val: string | null | undefined): any[] {
  if (!val) return [];
  try { return JSON.parse(val); } catch { return []; }
}

export default function Detalhes() {
  const params = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const id = parseInt(params.id || "0", 10);

  const { data: analysis, isLoading } = trpc.credit.getById.useQuery(
    { id },
    { enabled: id > 0 }
  );

  if (isLoading) {
    return (
      <div className="space-y-6 max-w-5xl">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-32 w-full" />
        <div className="grid grid-cols-2 gap-6">
          <Skeleton className="h-64 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      </div>
    );
  }

  if (!analysis) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <p className="text-muted-foreground">Análise não encontrada.</p>
        <Button variant="outline" className="mt-4" onClick={() => setLocation("/historico")}>
          Voltar ao Histórico
        </Button>
      </div>
    );
  }

  const capitalSocial = typeof analysis.capitalSocial === "string"
    ? parseFloat(analysis.capitalSocial)
    : Number(analysis.capitalSocial) || 0;

  const valorDivida = typeof analysis.valorDivida === "string"
    ? parseFloat(analysis.valorDivida)
    : Number(analysis.valorDivida) || 0;

  const socios = safeParseJson(analysis.socios);
  const protestos = safeParseJson(analysis.protestosJson);
  const pendencias = safeParseJson(analysis.pendenciasJson);

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => setLocation("/historico")} className="shrink-0">
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold tracking-tight">Relatório de Análise</h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            Consulta #{analysis.id} - {analysis.createdAt ? new Date(analysis.createdAt).toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" }) : "-"}
          </p>
        </div>
        <div className="flex gap-2">
          <DataSourceBadge source={analysis.cadastralDataSource} />
          <DataSourceBadge source={analysis.creditDataSource} />
        </div>
      </div>

      {/* Decision Banner */}
      <Card className="border-0 shadow-sm overflow-hidden">
        <div
          className={`p-8 ${
            analysis.status === "APROVADO"
              ? "bg-emerald-50"
              : analysis.status === "REPROVADO"
              ? "bg-red-50"
              : "bg-amber-50"
          }`}
        >
          <div className="flex items-center gap-5">
            <StatusIcon status={analysis.status} />
            <div className="flex-1">
              <div className="flex items-center gap-3 flex-wrap">
                <h2 className="text-2xl font-bold">{analysis.companyName || "Empresa"}</h2>
                <StatusBadge status={analysis.status} />
              </div>
              {analysis.nomeFantasia && (
                <p className="text-sm text-muted-foreground">{analysis.nomeFantasia}</p>
              )}
              <p className="text-sm text-muted-foreground mt-2 max-w-2xl">{analysis.motivo}</p>
            </div>
          </div>
        </div>
      </Card>

      {/* Details Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Cadastral */}
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <Building2 className="h-4 w-4 text-muted-foreground" />
              Dados Cadastrais
            </CardTitle>
          </CardHeader>
          <CardContent className="divide-y">
            <InfoRow icon={FileText} label="CNPJ" value={analysis.cnpj} />
            <InfoRow
              icon={ShieldCheck}
              label="Situação Cadastral"
              value={analysis.situacao || "-"}
              valueClass={analysis.situacao === "ATIVA" ? "text-emerald-600" : "text-red-600"}
            />
            <InfoRow icon={Calendar} label="Data de Abertura" value={analysis.dataAbertura || "-"} />
            <InfoRow
              icon={Banknote}
              label="Capital Social"
              value={`R$ ${capitalSocial.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`}
            />
            <InfoRow icon={Scale} label="Natureza Jurídica" value={analysis.naturezaJuridica || "-"} />
            {analysis.atividadePrincipal && (
              <InfoRow icon={Building2} label="Atividade Principal" value={analysis.atividadePrincipal} />
            )}
            {analysis.porte && (
              <InfoRow icon={Building2} label="Porte" value={analysis.porte} />
            )}
          </CardContent>
        </Card>

        {/* Credit */}
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <CreditCard className="h-4 w-4 text-muted-foreground" />
              Indicadores de Crédito
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <ScoreGauge score={analysis.score ?? 0} />
            {analysis.scoreMensagem && (
              <p className="text-xs text-muted-foreground italic bg-muted/50 p-3 rounded-lg">{analysis.scoreMensagem}</p>
            )}
            <Separator />
            <div className="space-y-1">
              <InfoRow
                icon={AlertTriangle}
                label="Restrições Financeiras"
                value={analysis.hasProtestos ? "Sim - Protestos encontrados" : "Nenhuma restrição encontrada"}
                valueClass={analysis.hasProtestos ? "text-red-600" : "text-emerald-600"}
              />
              <InfoRow
                icon={FileText}
                label="Quantidade de Ocorrências"
                value={String(analysis.quantidadeRestricoes ?? 0)}
              />
              {(analysis.chequesSemFundo ?? 0) > 0 && (
                <InfoRow icon={AlertTriangle} label="Cheques sem Fundo" value={String(analysis.chequesSemFundo)} valueClass="text-red-600" />
              )}
              {(analysis.chequesSustados ?? 0) > 0 && (
                <InfoRow icon={AlertTriangle} label="Cheques Sustados" value={String(analysis.chequesSustados)} valueClass="text-amber-600" />
              )}
            </div>
            {valorDivida > 0 && (
              <div className="p-4 rounded-xl bg-red-50 border border-red-100">
                <p className="text-xs text-red-600 uppercase tracking-wider font-medium">Valor Total de Dívidas</p>
                <p className="text-2xl font-bold text-red-700 mt-1">
                  R$ {valorDivida.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Endereço e Contato */}
        {(analysis.endereco || analysis.telefone || analysis.email) && (
          <Card className="border-0 shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <MapPin className="h-4 w-4 text-muted-foreground" />
                Endereço e Contato
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {analysis.endereco && (
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wider">Endereço</p>
                  <p className="text-sm font-medium mt-1">{analysis.endereco}</p>
                  {(analysis.bairro || analysis.cidade) && (
                    <p className="text-sm text-muted-foreground">
                      {[analysis.bairro, analysis.cidade, analysis.uf].filter(Boolean).join(" - ")}
                      {analysis.cep ? ` | CEP: ${analysis.cep}` : ""}
                    </p>
                  )}
                </div>
              )}
              <div className="flex gap-6 flex-wrap">
                {analysis.telefone && (
                  <div className="flex items-center gap-2 text-sm">
                    <Phone className="h-3.5 w-3.5 text-muted-foreground" />
                    <span>{analysis.telefone}</span>
                  </div>
                )}
                {analysis.email && (
                  <div className="flex items-center gap-2 text-sm">
                    <Mail className="h-3.5 w-3.5 text-muted-foreground" />
                    <span>{analysis.email}</span>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Sócios */}
        {socios.length > 0 && (
          <Card className="border-0 shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <Users className="h-4 w-4 text-muted-foreground" />
                Quadro Societário ({socios.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {socios.map((s: any, i: number) => (
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

      {/* Protestos Detalhados */}
      {protestos.length > 0 && (
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <Gavel className="h-4 w-4 text-red-500" />
              Protestos Detalhados ({protestos.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left">
                    <th className="pb-2 text-xs text-muted-foreground uppercase tracking-wider font-medium">Data</th>
                    <th className="pb-2 text-xs text-muted-foreground uppercase tracking-wider font-medium">Valor</th>
                    <th className="pb-2 text-xs text-muted-foreground uppercase tracking-wider font-medium">Cartório</th>
                    <th className="pb-2 text-xs text-muted-foreground uppercase tracking-wider font-medium">Cidade</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {protestos.map((p: any, i: number) => (
                    <tr key={i}>
                      <td className="py-2.5">{p.data}</td>
                      <td className="py-2.5 font-semibold text-red-700">R$ {p.valor}</td>
                      <td className="py-2.5">{p.cartorio ? `Cartório ${p.cartorio}` : "-"}</td>
                      <td className="py-2.5">{p.cidade || "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Pendências Financeiras */}
      {pendencias.length > 0 && (
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <CircleDollarSign className="h-4 w-4 text-amber-500" />
              Pendências Financeiras ({pendencias.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left">
                    <th className="pb-2 text-xs text-muted-foreground uppercase tracking-wider font-medium">Data</th>
                    <th className="pb-2 text-xs text-muted-foreground uppercase tracking-wider font-medium">Valor</th>
                    <th className="pb-2 text-xs text-muted-foreground uppercase tracking-wider font-medium">Credor</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {pendencias.map((p: any, i: number) => (
                    <tr key={i}>
                      <td className="py-2.5">{p.data || "-"}</td>
                      <td className="py-2.5 font-semibold text-amber-700">R$ {p.valor}</td>
                      <td className="py-2.5">{p.credor || "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Actions */}
      <div className="flex justify-end gap-3 print:hidden">
        <Button variant="outline" className="gap-2" onClick={() => window.print()}>
          <Printer className="h-4 w-4" />
          Imprimir / PDF
        </Button>
        <Button variant="outline" className="gap-2" onClick={() => setLocation("/consulta")}>
          Nova Consulta
        </Button>
      </div>
    </div>
  );
}
