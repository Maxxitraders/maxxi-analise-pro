import { useState } from "react";
import { useParams, useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Loader2,
  ArrowLeft,
  Gift,
  TrendingUp,
  TrendingDown,
  FileText,
  Activity,
} from "lucide-react";

const tipoConfig: Record<string, { label: string; className: string; sign: string }> = {
  recarga: { label: "Recarga", className: "bg-green-100 text-green-800", sign: "+" },
  consulta: { label: "Débito", className: "bg-red-100 text-red-800", sign: "−" },
  estorno: { label: "Estorno", className: "bg-yellow-100 text-yellow-800", sign: "+" },
};

const statusConfig: Record<string, string> = {
  APROVADO: "bg-green-100 text-green-800",
  REPROVADO: "bg-red-100 text-red-800",
  ANALISE_MANUAL: "bg-yellow-100 text-yellow-800",
};

const subscriptionLabels: Record<string, string> = {
  active: "Assinante ativo",
  past_due: "Pagamento pendente",
  canceled: "Cancelado",
  none: "Sem plano",
};

function formatDate(date: Date | string): string {
  return new Date(date).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function maskDocument(doc: string): string {
  if (doc.length <= 6) return doc;
  return doc.substring(0, 3) + "***" + doc.slice(-3);
}

export default function AdminUserDetails() {
  const { userId } = useParams<{ userId: string }>();
  const [, setLocation] = useLocation();
  const [showAddCredits, setShowAddCredits] = useState(false);
  const [valor, setValor] = useState("");
  const [descricao, setDescricao] = useState("");
  const utils = trpc.useUtils();

  const parsedId = parseInt(userId ?? "0");

  const { data, isLoading } = trpc.admin.getUserDetails.useQuery(
    { userId: parsedId },
    { enabled: parsedId > 0 }
  );

  const addCreditsMutation = trpc.admin.addCredits.useMutation({
    onSuccess: (result) => {
      toast.success(`Créditos adicionados! Novo saldo: R$ ${result.novoSaldo.toFixed(2)}`);
      setShowAddCredits(false);
      setValor("");
      setDescricao("");
      utils.admin.getUserDetails.invalidate({ userId: parsedId });
      utils.admin.allUsers.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const handleAddCredits = () => {
    const valorNum = parseFloat(valor);
    if (isNaN(valorNum) || valorNum <= 0) {
      toast.error("Informe um valor válido maior que zero.");
      return;
    }
    if (!descricao.trim()) {
      toast.error("A descrição é obrigatória.");
      return;
    }
    addCreditsMutation.mutate({
      userId: parsedId,
      valor: valorNum,
      descricao: descricao.trim(),
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <p className="text-muted-foreground">Usuário não encontrado.</p>
        <Button variant="outline" onClick={() => setLocation("/admin")}>
          <ArrowLeft className="mr-2 h-4 w-4" /> Voltar ao Admin
        </Button>
      </div>
    );
  }

  const { user, transactions, creditAnalyses, stats } = data;
  const saldo = parseFloat(user.saldo ?? "0");

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => setLocation("/admin")}>
          <ArrowLeft className="mr-2 h-4 w-4" /> Voltar
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Detalhes do Usuário</h1>
          <p className="text-sm text-muted-foreground">Histórico completo e gestão de saldo</p>
        </div>
      </div>

      {/* User Profile */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
            <div className="space-y-2">
              <h2 className="text-xl font-semibold">{user.name || "—"}</h2>
              <p className="text-muted-foreground">{user.email || "—"}</p>
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline">
                  {subscriptionLabels[user.subscriptionStatus ?? "none"] ?? user.subscriptionStatus ?? "Sem plano"}
                </Badge>
                {user.role === "admin" && (
                  <Badge className="bg-purple-100 text-purple-800">Admin</Badge>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                Cadastrado em {formatDate(user.createdAt)}
              </p>
            </div>
            <div className="flex flex-col items-start sm:items-end gap-3">
              <div className="sm:text-right">
                <p className="text-sm text-muted-foreground mb-1">Saldo atual</p>
                <p className={`text-3xl font-bold ${saldo > 0 ? "text-green-600" : "text-muted-foreground"}`}>
                  R$ {saldo.toFixed(2)}
                </p>
              </div>
              <Button
                onClick={() => setShowAddCredits(true)}
                className="bg-green-600 hover:bg-green-700 text-white"
              >
                <Gift className="mr-2 h-4 w-4" />
                Adicionar Créditos
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Recarregado</CardTitle>
            <TrendingUp className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-green-600">
              R$ {stats.totalReceived.toFixed(2)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Gasto</CardTitle>
            <TrendingDown className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-red-600">
              R$ {stats.totalSpent.toFixed(2)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Consultas</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{stats.totalAnalyses}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Transações</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{stats.totalTransactions}</p>
          </CardContent>
        </Card>
      </div>

      {/* Transactions */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-baseline gap-2">
            Histórico de Transações
            <span className="text-sm font-normal text-muted-foreground">(últimas 50)</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {transactions.length === 0 ? (
            <p className="text-center py-8 text-muted-foreground">Nenhuma transação registrada.</p>
          ) : (
            <div className="rounded-md border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead className="text-right">Valor</TableHead>
                    <TableHead>Descrição</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {transactions.map((t) => {
                    const cfg = tipoConfig[t.tipo] ?? { label: t.tipo, className: "bg-gray-100 text-gray-800", sign: "" };
                    const valorNum = parseFloat(String(t.valor));
                    return (
                      <TableRow key={t.id}>
                        <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                          {formatDate(t.createdAt)}
                        </TableCell>
                        <TableCell>
                          <Badge className={cfg.className}>{cfg.label}</Badge>
                        </TableCell>
                        <TableCell className={`text-right font-semibold ${t.tipo === "consulta" ? "text-red-600" : "text-green-600"}`}>
                          {cfg.sign}R$ {valorNum.toFixed(2)}
                        </TableCell>
                        <TableCell className="text-sm max-w-xs truncate text-muted-foreground">
                          {t.descricao}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Credit Analyses */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-baseline gap-2">
            Consultas de Crédito
            <span className="text-sm font-normal text-muted-foreground">(últimas 50)</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {creditAnalyses.length === 0 ? (
            <p className="text-center py-8 text-muted-foreground">Nenhuma consulta realizada.</p>
          ) : (
            <div className="rounded-md border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Documento</TableHead>
                    <TableHead>Nome / Empresa</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {creditAnalyses.map((c) => (
                    <TableRow key={c.id}>
                      <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                        {formatDate(c.createdAt)}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {(c.documentType ?? "cpf").toUpperCase()}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-mono text-sm">
                        {maskDocument(c.cnpj)}
                      </TableCell>
                      <TableCell className="text-sm max-w-xs truncate">
                        {c.companyName || "—"}
                      </TableCell>
                      <TableCell>
                        <Badge className={statusConfig[c.status] ?? "bg-gray-100 text-gray-800"}>
                          {c.status}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add Credits Dialog */}
      <Dialog open={showAddCredits} onOpenChange={(open) => { if (!open) setShowAddCredits(false); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Gift className="h-5 w-5 text-green-600" />
              Adicionar Créditos
            </DialogTitle>
            <DialogDescription>
              Os créditos são adicionados imediatamente. O usuário receberá um email de confirmação.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="rounded-lg border p-3 bg-muted/50">
              <p className="font-medium">{user.name || "—"}</p>
              <p className="text-sm text-muted-foreground">{user.email || "—"}</p>
              <p className="text-sm text-muted-foreground mt-1">
                Saldo atual: <strong>R$ {saldo.toFixed(2)}</strong>
              </p>
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium">
                Valor (R$) <span className="text-destructive">*</span>
              </label>
              <Input
                type="number"
                step="0.01"
                min="0.01"
                placeholder="10.00"
                value={valor}
                onChange={(e) => setValor(e.target.value)}
                disabled={addCreditsMutation.isPending}
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium">
                Motivo / Descrição <span className="text-destructive">*</span>
              </label>
              <textarea
                className="w-full min-h-[80px] rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 resize-none"
                placeholder="Ex: Bônus de boas-vindas"
                value={descricao}
                onChange={(e) => setDescricao(e.target.value)}
                disabled={addCreditsMutation.isPending}
              />
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setShowAddCredits(false)}
              disabled={addCreditsMutation.isPending}
            >
              Cancelar
            </Button>
            <Button
              onClick={handleAddCredits}
              disabled={addCreditsMutation.isPending}
              className="bg-green-600 hover:bg-green-700 text-white"
            >
              {addCreditsMutation.isPending ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Adicionando...</>
              ) : (
                <><Gift className="mr-2 h-4 w-4" />Confirmar</>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
