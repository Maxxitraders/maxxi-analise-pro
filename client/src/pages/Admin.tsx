import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Loader2, Users, UserCheck, Crown, Package, ArrowRight, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLocation } from "wouter";
import { toast } from "sonner";

const statusColors: Record<string, string> = {
  active: "bg-green-100 text-green-800",
  past_due: "bg-yellow-100 text-yellow-800",
  canceled: "bg-red-100 text-red-800",
  none: "bg-gray-100 text-gray-800",
};

const statusLabels: Record<string, string> = {
  active: "Ativa",
  past_due: "Pendente",
  canceled: "Cancelada",
  none: "Sem plano",
};

export default function Admin() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const [deleteTarget, setDeleteTarget] = useState<{ id: number; name: string; email: string } | null>(null);

  const utils = trpc.useUtils();

  const { data: subscribers, isLoading: loadingSubs } = trpc.admin.subscribers.useQuery(undefined, {
    enabled: user?.role === "admin",
  });

  const { data: stats, isLoading: loadingStats } = trpc.admin.subscriptionStats.useQuery(undefined, {
    enabled: user?.role === "admin",
  });

  const deleteMutation = trpc.admin.deleteUser.useMutation({
    onSuccess: (data) => {
      toast.success(data.message);
      setDeleteTarget(null);
      utils.admin.subscribers.invalidate();
      utils.admin.subscriptionStats.invalidate();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  if (user?.role !== "admin") {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <h2 className="text-xl font-semibold mb-2">Acesso Restrito</h2>
          <p className="text-muted-foreground">Esta página é exclusiva para administradores.</p>
        </div>
      </div>
    );
  }

  if (loadingSubs || loadingStats) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight mb-1">Painel Administrativo</h1>
        <p className="text-muted-foreground">
          Gerencie assinantes e acompanhe métricas da plataforma.
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total de Assinantes</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{stats?.totalSubscribers || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Assinaturas Ativas</CardTitle>
            <UserCheck className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-green-600">{stats?.activeSubscribers || 0}</div>
          </CardContent>
        </Card>
        <Card className="border-primary/20 bg-primary/5 hover:shadow-md transition-shadow cursor-pointer" onClick={() => setLocation("/admin/planos")}>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Gerenciar Planos</CardTitle>
            <Package className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Criar, editar e configurar planos</span>
              <ArrowRight className="h-4 w-4 text-primary" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Subscribers Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Crown className="h-5 w-5 text-primary" />
            Assinantes
          </CardTitle>
        </CardHeader>
        <CardContent>
          {!subscribers || subscribers.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              Nenhum assinante encontrado.
            </div>
          ) : (
            <div className="rounded-md border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Usuário</TableHead>
                    <TableHead>Plano</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-center">Consultas</TableHead>
                    <TableHead>Último Acesso</TableHead>
                    <TableHead className="text-center">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {subscribers.map((sub) => (
                    <TableRow key={sub.id}>
                      <TableCell>
                        <div>
                          <p className="font-medium">{sub.name || "—"}</p>
                          <p className="text-xs text-muted-foreground">{sub.email || "—"}</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{sub.planName}</Badge>
                      </TableCell>
                      <TableCell>
                        <Badge className={statusColors[sub.subscriptionStatus || "none"]}>
                          {statusLabels[sub.subscriptionStatus || "none"]}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        <span className="text-sm">
                          {sub.consultasUsed || 0}
                          {sub.consultasLimit > 0 ? ` / ${sub.consultasLimit}` : ""}
                          {sub.consultasLimit === -1 ? " (∞)" : ""}
                        </span>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {sub.lastSignedIn
                          ? new Date(sub.lastSignedIn).toLocaleDateString("pt-BR")
                          : "—"}
                      </TableCell>
                      <TableCell className="text-center">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-red-500 hover:text-red-700 hover:bg-red-50"
                          onClick={() =>
                            setDeleteTarget({
                              id: sub.id,
                              name: sub.name || "Sem nome",
                              email: sub.email || "Sem email",
                            })
                          }
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Dialog de confirmação de exclusão */}
      <Dialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Excluir Usuário</DialogTitle>
            <DialogDescription>
              Tem certeza que deseja excluir este usuário? Esta ação é irreversível e irá remover todas as análises de crédito associadas.
            </DialogDescription>
          </DialogHeader>
          {deleteTarget && (
            <div className="rounded-lg border p-4 bg-red-50">
              <p className="font-medium text-red-900">{deleteTarget.name}</p>
              <p className="text-sm text-red-700">{deleteTarget.email}</p>
            </div>
          )}
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setDeleteTarget(null)}
              disabled={deleteMutation.isPending}
            >
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (deleteTarget) {
                  deleteMutation.mutate({ userId: deleteTarget.id });
                }
              }}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Excluindo...
                </>
              ) : (
                <>
                  <Trash2 className="mr-2 h-4 w-4" />
                  Excluir Usuário
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
