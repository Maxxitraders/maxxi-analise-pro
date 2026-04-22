import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Loader2, Users, UserCheck, Crown, Package, ArrowRight, Trash2, UserX, Mail, CheckCircle, XCircle, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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

type Tab = "assinantes" | "todos";

export default function Admin() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const [deleteTarget, setDeleteTarget] = useState<{ id: number; name: string; email: string } | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>("todos");
  const [search, setSearch] = useState("");

  const utils = trpc.useUtils();

  const { data: subscribers, isLoading: loadingSubs } = trpc.admin.subscribers.useQuery(undefined, {
    enabled: user?.role === "admin",
  });

  const { data: allUsers, isLoading: loadingAllUsers } = trpc.admin.allUsers.useQuery(undefined, {
    enabled: user?.role === "admin",
  });

  const { data: stats, isLoading: loadingStats } = trpc.admin.subscriptionStats.useQuery(undefined, {
    enabled: user?.role === "admin",
  });

  const { data: emailStatus } = trpc.admin.emailStatus.useQuery(undefined, {
    enabled: user?.role === "admin",
  });

  const deleteMutation = trpc.admin.deleteUser.useMutation({
    onSuccess: (data) => {
      toast.success(data.message);
      setDeleteTarget(null);
      utils.admin.subscribers.invalidate();
      utils.admin.allUsers.invalidate();
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

  if (loadingSubs || loadingStats || loadingAllUsers) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const totalUsers = allUsers?.length || 0;
  const noSubscription = (allUsers || []).filter(u => !u.planId || u.planId === "none").length;

  const displayData = activeTab === "assinantes" ? (subscribers || []) : (allUsers || []);
  const filtered = search
    ? displayData.filter(u =>
        (u.name || "").toLowerCase().includes(search.toLowerCase()) ||
        (u.email || "").toLowerCase().includes(search.toLowerCase())
      )
    : displayData;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight mb-1">Painel Administrativo</h1>
        <p className="text-muted-foreground">Gerencie usuários e acompanhe métricas da plataforma.</p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total de Usuários</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{totalUsers}</div>
            <p className="text-xs text-muted-foreground mt-1">{noSubscription} sem plano</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Assinantes</CardTitle>
            <Crown className="h-4 w-4 text-muted-foreground" />
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
        <Card
          className="border-primary/20 bg-primary/5 hover:shadow-md transition-shadow cursor-pointer"
          onClick={() => setLocation("/admin/planos")}
        >
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Gerenciar Planos</CardTitle>
            <Package className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Criar e editar planos</span>
              <ArrowRight className="h-4 w-4 text-primary" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Diagnóstico de Email */}
      <Card className={
        !emailStatus ? "border-gray-200" :
        emailStatus.working ? "border-green-200 bg-green-50/50" :
        emailStatus.configured ? "border-yellow-200 bg-yellow-50/50" :
        "border-red-200 bg-red-50/50"
      }>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Mail className="h-4 w-4" />
            Status do Serviço de Email (Resend)
          </CardTitle>
        </CardHeader>
        <CardContent>
          {!emailStatus ? (
            <p className="text-sm text-muted-foreground">Verificando...</p>
          ) : emailStatus.working ? (
            <div className="flex items-center gap-2 text-green-700">
              <CheckCircle className="h-4 w-4" />
              <span className="text-sm font-medium">Funcionando — emails de recuperação de senha chegam aos clientes.</span>
            </div>
          ) : emailStatus.configured ? (
            <div className="flex items-center gap-2 text-yellow-700">
              <AlertTriangle className="h-4 w-4" />
              <span className="text-sm">API Key configurada, mas houve falha na verificação. Verifique se o domínio <strong>maxxianalise.com</strong> está verificado no Resend.</span>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-red-700">
              <XCircle className="h-4 w-4" />
              <span className="text-sm">Email <strong>não configurado</strong> — defina a variável <code className="bg-red-100 px-1 rounded">RESEND_API_KEY</code> no ambiente de produção.</span>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <CardTitle className="text-lg">Usuários</CardTitle>
            <div className="flex gap-1 bg-muted rounded-lg p-1 w-fit">
              <button
                onClick={() => setActiveTab("todos")}
                className={`px-3 py-1.5 text-sm rounded-md transition-colors font-medium ${
                  activeTab === "todos"
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Todos ({totalUsers})
              </button>
              <button
                onClick={() => setActiveTab("assinantes")}
                className={`px-3 py-1.5 text-sm rounded-md transition-colors font-medium ${
                  activeTab === "assinantes"
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Assinantes ({stats?.totalSubscribers || 0})
              </button>
            </div>
          </div>
          <div className="mt-3">
            <Input
              placeholder="Buscar por nome ou email..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="max-w-sm"
            />
          </div>
        </CardHeader>
        <CardContent>
          {filtered.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              {search ? "Nenhum usuário encontrado para esta busca." : "Nenhum usuário encontrado."}
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
                    {activeTab === "todos" && <TableHead>Login</TableHead>}
                    <TableHead>Cadastro</TableHead>
                    <TableHead className="text-center">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((u) => (
                    <TableRow key={u.id}>
                      <TableCell>
                        <div>
                          <p className="font-medium">{u.name || "—"}</p>
                          <p className="text-xs text-muted-foreground">{u.email || "—"}</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{u.planName}</Badge>
                      </TableCell>
                      <TableCell>
                        <Badge className={statusColors[u.subscriptionStatus || "none"]}>
                          {statusLabels[u.subscriptionStatus || "none"]}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        <span className="text-sm">
                          {u.consultasUsed || 0}
                          {u.consultasLimit > 0 ? ` / ${u.consultasLimit}` : ""}
                          {u.consultasLimit === -1 ? " (∞)" : ""}
                        </span>
                      </TableCell>
                      {activeTab === "todos" && (
                        <TableCell className="text-xs text-muted-foreground">
                          {"loginMethod" in u ? String(u.loginMethod || "email") : "email"}
                        </TableCell>
                      )}
                      <TableCell className="text-sm text-muted-foreground">
                        {u.createdAt ? new Date(u.createdAt).toLocaleDateString("pt-BR") : "—"}
                      </TableCell>
                      <TableCell className="text-center">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-red-500 hover:text-red-700 hover:bg-red-50"
                          onClick={() =>
                            setDeleteTarget({
                              id: u.id,
                              name: u.name || "Sem nome",
                              email: u.email || "Sem email",
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

      <Dialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserX className="h-5 w-5 text-red-500" />
              Excluir Usuário
            </DialogTitle>
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
            <Button variant="outline" onClick={() => setDeleteTarget(null)} disabled={deleteMutation.isPending}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={() => { if (deleteTarget) deleteMutation.mutate({ userId: deleteTarget.id }); }}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Excluindo...</>
              ) : (
                <><Trash2 className="mr-2 h-4 w-4" />Excluir Usuário</>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
