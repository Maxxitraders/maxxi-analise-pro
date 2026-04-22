import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { History, Search, ArrowRight, Filter, X, Building2, User } from "lucide-react";
import { useLocation } from "wouter";

function StatusBadge({ status }: { status: string }) {
  const config: Record<string, { label: string; className: string }> = {
    APROVADO: { label: "Aprovado", className: "bg-emerald-100 text-emerald-700 hover:bg-emerald-100 border-0" },
    REPROVADO: { label: "Reprovado", className: "bg-red-100 text-red-700 hover:bg-red-100 border-0" },
    ANALISE_MANUAL: { label: "Análise Manual", className: "bg-amber-100 text-amber-700 hover:bg-amber-100 border-0" },
  };
  const c = config[status] || config.ANALISE_MANUAL;
  return <Badge className={c.className}>{c.label}</Badge>;
}

function ScoreCell({ score }: { score: number }) {
  const getColor = (s: number) => {
    if (s >= 700) return "text-emerald-600";
    if (s >= 400) return "text-amber-600";
    return "text-red-600";
  };
  return <span className={`font-bold tabular-nums ${getColor(score)}`}>{score}</span>;
}

export default function Historico() {
  const [, setLocation] = useLocation();
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [docTypeFilter, setDocTypeFilter] = useState<string>("all");
  const [searchTerm, setSearchTerm] = useState("");

  const { data: analyses, isLoading } = trpc.credit.list.useQuery({
    status: statusFilter !== "all" ? statusFilter : undefined,
    limit: 100,
  });

  const filtered = useMemo(() => {
    if (!analyses) return [];
    if (!searchTerm) return analyses;
    const term = searchTerm.toLowerCase();
    return analyses.filter(
      (a) =>
        ((a.companyName || "").toLowerCase().includes(term) ||
        (a.cnpj || "").includes(term)) &&
        (docTypeFilter === "all" || a.documentType === docTypeFilter)
    );
  }, [analyses, searchTerm]);

  const clearFilters = () => {
    setStatusFilter("all");
    setDocTypeFilter("all");
    setSearchTerm("");
  };

  const hasFilters = statusFilter !== "all" || docTypeFilter !== "all" || searchTerm !== "";

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <History className="h-6 w-6 text-muted-foreground" />
          Histórico de Consultas
        </h1>
        <p className="text-muted-foreground mt-1">Todas as análises de crédito realizadas</p>
      </div>

      {/* Filters */}
      <Card className="border-0 shadow-sm">
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
            <div className="relative flex-1 w-full sm:max-w-xs">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por empresa, CPF ou CNPJ..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-muted-foreground" />
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Filtrar por status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os Status</SelectItem>
                  <SelectItem value="APROVADO">Aprovado</SelectItem>
                  <SelectItem value="REPROVADO">Reprovado</SelectItem>
                  <SelectItem value="ANALISE_MANUAL">Análise Manual</SelectItem>
                </SelectContent>
              </Select>
              <Select value={docTypeFilter} onValueChange={setDocTypeFilter}>
                <SelectTrigger className="w-[160px]">
                  <SelectValue placeholder="Tipo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">CPF e CNPJ</SelectItem>
                  <SelectItem value="cpf">Pessoa Física (CPF)</SelectItem>
                  <SelectItem value="cnpj">Pessoa Jurídica (CNPJ)</SelectItem>
                </SelectContent>
              </Select>
              {hasFilters && (
                <Button variant="ghost" size="sm" onClick={clearFilters} className="gap-1 text-muted-foreground">
                  <X className="h-3 w-3" /> Limpar
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card className="border-0 shadow-sm overflow-hidden">
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-6 space-y-4">
              {[1, 2, 3, 4, 5].map((i) => (
                <Skeleton key={i} className="h-14 w-full rounded-lg" />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="h-16 w-16 rounded-2xl bg-muted flex items-center justify-center mb-4">
                <History className="h-8 w-8 text-muted-foreground" />
              </div>
              <p className="text-sm text-muted-foreground">
                {hasFilters ? "Nenhuma análise encontrada com os filtros aplicados." : "Nenhuma análise realizada ainda."}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b bg-muted/30">
                    <th className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider px-6 py-3">
                      Empresa
                    </th>
                    <th className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider px-4 py-3">
                      Documento
                    </th>
                    <th className="text-center text-xs font-medium text-muted-foreground uppercase tracking-wider px-4 py-3">
                      Score
                    </th>
                    <th className="text-center text-xs font-medium text-muted-foreground uppercase tracking-wider px-4 py-3">
                      Status
                    </th>
                    <th className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider px-4 py-3">
                      Data
                    </th>
                    <th className="px-4 py-3"></th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((a) => (
                    <tr
                      key={a.id}
                      className="border-b last:border-0 hover:bg-accent/30 transition-colors cursor-pointer group"
                      onClick={() => setLocation(`/detalhes/${a.id}`)}
                    >
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                            {a.documentType === "cpf" ? (
                              <User className="h-4 w-4 text-primary" />
                            ) : (
                              <span className="text-xs font-bold text-primary">
                                {(a.companyName || "?").charAt(0)}
                              </span>
                            )}
                          </div>
                          <span className="text-sm font-medium truncate max-w-[200px]">
                            {a.companyName || "Empresa"}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <span className="text-sm font-mono text-muted-foreground">{a.cnpj}</span>
                      </td>
                      <td className="px-4 py-4 text-center">
                        <ScoreCell score={a.score ?? 0} />
                      </td>
                      <td className="px-4 py-4 text-center">
                        <StatusBadge status={a.status} />
                      </td>
                      <td className="px-4 py-4">
                        <span className="text-sm text-muted-foreground">
                          {a.createdAt ? new Date(a.createdAt).toLocaleDateString("pt-BR") : "-"}
                        </span>
                      </td>
                      <td className="px-4 py-4">
                        <ArrowRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Summary */}
      {filtered.length > 0 && (
        <p className="text-sm text-muted-foreground text-center">
          Exibindo {filtered.length} {filtered.length === 1 ? "resultado" : "resultados"}
        </p>
      )}
    </div>
  );
}
