import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Loader2, CreditCard, BarChart3, Calendar, CheckCircle2, AlertTriangle, XCircle } from "lucide-react";
import { toast } from "sonner";
import { useSearch, useLocation } from "wouter";
import { useEffect, useMemo } from "react";

const statusLabels: Record<string, { label: string; color: string; icon: any }> = {
  active: { label: "Ativa", color: "bg-green-100 text-green-800", icon: CheckCircle2 },
  past_due: { label: "Pagamento Pendente", color: "bg-yellow-100 text-yellow-800", icon: AlertTriangle },
  canceled: { label: "Cancelada", color: "bg-red-100 text-red-800", icon: XCircle },
  none: { label: "Sem Assinatura", color: "bg-gray-100 text-gray-800", icon: XCircle },
};

export default function Assinatura() {
  const search = useSearch();
  const [, setLocation] = useLocation();
  const params = useMemo(() => new URLSearchParams(search), [search]);
  const status = params.get("status");

  const { data: sub, isLoading } = trpc.subscription.mySubscription.useQuery();
  const utils = trpc.useUtils();

  const cancelSub = trpc.subscription.cancelSubscription.useMutation({
    onSuccess: () => {
      toast.success("Assinatura cancelada com sucesso.");
      utils.subscription.mySubscription.invalidate();
    },
    onError: (err) => {
      toast.error(err.message || "Erro ao cancelar assinatura.");
    },
  });

  useEffect(() => {
    if (status === "success") {
      toast.success("Pagamento realizado com sucesso! Sua assinatura foi ativada.");
      utils.subscription.mySubscription.invalidate();
    }
  }, [status]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const hasSubscription = sub && sub.subscriptionStatus !== "none" && sub.planId !== "none";
  const consultasPercent = sub && sub.consultasLimit > 0
    ? Math.min((sub.consultasUsed / sub.consultasLimit) * 100, 100)
    : 0;
  const isUnlimited = sub?.consultasLimit === -1;
  const statusInfo = statusLabels[sub?.subscriptionStatus || "none"] || statusLabels.none;
  const StatusIcon = statusInfo.icon;

  return (
    <div className="max-w-3xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight mb-1">Minha Assinatura</h1>
        <p className="text-muted-foreground">
          Gerencie seu plano e acompanhe o consumo de consultas.
        </p>
      </div>

      {!hasSubscription ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 gap-4">
            <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center">
              <CreditCard className="h-8 w-8 text-muted-foreground" />
            </div>
            <h2 className="text-xl font-semibold">Nenhuma assinatura ativa</h2>
            <p className="text-muted-foreground text-center max-w-md">
              Assine um plano para começar a realizar consultas de crédito com dados reais da Boa Vista SCPC.
            </p>
            <Button size="lg" onClick={() => setLocation("/planos")}>
              Ver Planos
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {/* Status Card */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-lg">Plano {sub?.planName}</CardTitle>
                  <CardDescription>Detalhes da sua assinatura</CardDescription>
                </div>
                <Badge className={`${statusInfo.color} gap-1.5`}>
                  <StatusIcon className="h-3.5 w-3.5" />
                  {statusInfo.label}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Consultas Usage */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <BarChart3 className="h-4 w-4 text-muted-foreground" />
                    Consultas este mês
                  </div>
                  <span className="text-sm text-muted-foreground">
                    {isUnlimited
                      ? `${sub?.consultasUsed || 0} (ilimitado)`
                      : `${sub?.consultasUsed || 0} / ${sub?.consultasLimit || 0}`
                    }
                  </span>
                </div>
                {!isUnlimited && (
                  <Progress
                    value={consultasPercent}
                    className="h-2"
                  />
                )}
                {!isUnlimited && consultasPercent >= 80 && (
                  <p className="text-xs text-amber-600 mt-1">
                    Você está próximo do limite. Considere fazer upgrade do plano.
                  </p>
                )}
              </div>

              {/* Reset Info */}
              {sub?.consultasResetAt && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Calendar className="h-4 w-4" />
                  <span>
                    Consultas renovam em:{" "}
                    {new Date(new Date(sub.consultasResetAt).getTime() + 30 * 24 * 60 * 60 * 1000).toLocaleDateString("pt-BR")}
                  </span>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Actions */}
          <div className="flex flex-col sm:flex-row gap-3">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => setLocation("/planos")}
            >
              Alterar Plano
            </Button>
            <Button
              variant="outline"
              className="flex-1 text-red-600 hover:text-red-700 hover:bg-red-50"
              disabled={cancelSub.isPending}
              onClick={() => {
                if (confirm("Tem certeza que deseja cancelar sua assinatura? Você perderá acesso às consultas.")) {
                  cancelSub.mutate();
                }
              }}
            >
              {cancelSub.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <XCircle className="h-4 w-4 mr-2" />
              )}
              Cancelar Assinatura
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
