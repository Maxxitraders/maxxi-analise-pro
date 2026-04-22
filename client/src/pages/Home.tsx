import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ShieldCheck,
  ShieldAlert,
  ShieldQuestion,
  BarChart3,
  Search,
  ArrowRight,
  TrendingUp,
  User,
  Building2,
} from "lucide-react";
import { useLocation } from "wouter";

function StatCard({
  title,
  value,
  icon: Icon,
  color,
  loading,
}: {
  title: string;
  value: number;
  icon: React.ElementType;
  color: string;
  loading: boolean;
}) {
  const colorMap: Record<string, string> = {
    primary: "bg-primary/10 text-primary",
    success: "bg-emerald-50 text-emerald-600",
    warning: "bg-amber-50 text-amber-600",
    destructive: "bg-red-50 text-red-600",
  };

  return (
    <Card className="relative overflow-hidden border-0 shadow-sm hover:shadow-md transition-shadow">
      <CardContent className="p-6">
        <div className="flex items-start justify-between">
          <div className="space-y-2">
            <p className="text-sm font-medium text-muted-foreground">{title}</p>
            {loading ? (
              <Skeleton className="h-9 w-20" />
            ) : (
              <p className="text-3xl font-bold tracking-tight">{value.toLocaleString("pt-BR")}</p>
            )}
          </div>
          <div className={`h-12 w-12 rounded-xl flex items-center justify-center ${colorMap[color]}`}>
            <Icon className="h-6 w-6" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function StatusBadge({ status }: { status: string }) {
  const config: Record<string, { label: string; variant: "default" | "destructive" | "secondary" | "outline"; className: string }> = {
    APROVADO: { label: "Aprovado", variant: "default", className: "bg-emerald-100 text-emerald-700 hover:bg-emerald-100 border-0" },
    REPROVADO: { label: "Reprovado", variant: "destructive", className: "bg-red-100 text-red-700 hover:bg-red-100 border-0" },
    ANALISE_MANUAL: { label: "Análise Manual", variant: "secondary", className: "bg-amber-100 text-amber-700 hover:bg-amber-100 border-0" },
  };
  const c = config[status] || config.ANALISE_MANUAL;
  return <Badge variant={c.variant} className={c.className}>{c.label}</Badge>;
}

function ScoreIndicator({ score }: { score: number }) {
  const getColor = (s: number) => {
    if (s >= 700) return "text-emerald-600";
    if (s >= 400) return "text-amber-600";
    return "text-red-600";
  };
  return <span className={`font-bold tabular-nums ${getColor(score)}`}>{score}</span>;
}

export default function Home() {
  const [, setLocation] = useLocation();
  const { data: stats, isLoading: statsLoading } = trpc.credit.stats.useQuery();
  const { data: recentAnalyses, isLoading: listLoading } = trpc.credit.list.useQuery({ limit: 5 });

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground mt-1">Visão geral das análises de crédito</p>
        </div>
        <Button onClick={() => setLocation("/consulta")} className="gap-2 shadow-sm">
          <Search className="h-4 w-4" />
          Nova Consulta
        </Button>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Total de Análises"
          value={stats?.total ?? 0}
          icon={BarChart3}
          color="primary"
          loading={statsLoading}
        />
        <StatCard
          title="Aprovadas"
          value={stats?.aprovados ?? 0}
          icon={ShieldCheck}
          color="success"
          loading={statsLoading}
        />
        <StatCard
          title="Reprovadas"
          value={stats?.reprovados ?? 0}
          icon={ShieldAlert}
          color="destructive"
          loading={statsLoading}
        />
        <StatCard
          title="Análise Manual"
          value={stats?.analise_manual ?? 0}
          icon={ShieldQuestion}
          color="warning"
          loading={statsLoading}
        />
      </div>

      {/* Distribution Chart Placeholder + Recent */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Distribution */}
        <Card className="lg:col-span-2 border-0 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
              Distribuição
            </CardTitle>
          </CardHeader>
          <CardContent>
            {statsLoading ? (
              <div className="space-y-4 py-4">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
              </div>
            ) : (
              <div className="space-y-4 py-2">
                {[
                  { label: "Aprovadas", value: stats?.aprovados ?? 0, color: "bg-emerald-500" },
                  { label: "Reprovadas", value: stats?.reprovados ?? 0, color: "bg-red-500" },
                  { label: "Análise Manual", value: stats?.analise_manual ?? 0, color: "bg-amber-500" },
                ].map((item) => {
                  const total = stats?.total || 1;
                  const pct = Math.round((item.value / total) * 100) || 0;
                  return (
                    <div key={item.label} className="space-y-1.5">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">{item.label}</span>
                        <span className="font-medium tabular-nums">{pct}%</span>
                      </div>
                      <div className="h-2 rounded-full bg-muted overflow-hidden">
                        <div
                          className={`h-full rounded-full ${item.color} transition-all duration-500`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent Analyses */}
        <Card className="lg:col-span-3 border-0 shadow-sm">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-semibold">Últimas Consultas</CardTitle>
              <Button
                variant="ghost"
                size="sm"
                className="text-xs gap-1 text-muted-foreground"
                onClick={() => setLocation("/historico")}
              >
                Ver todas <ArrowRight className="h-3 w-3" />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {listLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-14 w-full rounded-lg" />
                ))}
              </div>
            ) : !recentAnalyses || recentAnalyses.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <div className="h-16 w-16 rounded-2xl bg-muted flex items-center justify-center mb-4">
                  <Search className="h-8 w-8 text-muted-foreground" />
                </div>
                <p className="text-sm text-muted-foreground">Nenhuma análise realizada ainda.</p>
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-4"
                  onClick={() => setLocation("/consulta")}
                >
                  Fazer primeira consulta
                </Button>
              </div>
            ) : (
              <div className="space-y-2">
                {recentAnalyses.map((a) => (
                  <button
                    key={a.id}
                    onClick={() => setLocation(`/detalhes/${a.id}`)}
                    className="w-full flex items-center justify-between p-3 rounded-lg hover:bg-accent/50 transition-colors text-left group"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center shrink-0">
                        <span className="text-xs font-bold text-muted-foreground">
                          {(a.companyName || "?").charAt(0)}
                        </span>
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{a.companyName || "Empresa"}</p>
                        <p className="text-xs text-muted-foreground">{a.cnpj}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <ScoreIndicator score={a.score ?? 0} />
                      <StatusBadge status={a.status} />
                      <ArrowRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                  </button>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
