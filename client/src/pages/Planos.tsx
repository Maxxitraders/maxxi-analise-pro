import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Check, Loader2, Sparkles, Shield, Zap, Crown, Rocket, Star, Diamond, QrCode, FileText, CreditCard, Copy, ExternalLink, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/_core/hooks/useAuth";
import { useLocation, useSearch } from "wouter";
import { useState, useEffect, useMemo } from "react";

// Ícones dinâmicos
const planIconsBySlug: Record<string, any> = {
  basico: Shield,
  profissional: Zap,
  enterprise: Crown,
  starter: Shield,
  premium: Diamond,
  ultimate: Rocket,
};
const defaultIcons = [Shield, Zap, Crown, Star, Diamond, Rocket];
function getPlanIcon(slug: string, index: number) {
  return planIconsBySlug[slug] || defaultIcons[index % defaultIcons.length] || Shield;
}

type PaymentMethod = "PIX" | "BOLETO" | "CREDIT_CARD";

// ── Formatadores ──
function formatCpfCnpj(value: string): string {
  const cleaned = value.replace(/\D/g, "");
  if (cleaned.length <= 11) {
    // CPF: 000.000.000-00
    return cleaned
      .replace(/(\d{3})(\d)/, "$1.$2")
      .replace(/(\d{3})(\d)/, "$1.$2")
      .replace(/(\d{3})(\d{1,2})$/, "$1-$2");
  }
  // CNPJ: 00.000.000/0000-00
  return cleaned
    .slice(0, 14)
    .replace(/(\d{2})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1/$2")
    .replace(/(\d{4})(\d{1,2})$/, "$1-$2");
}

function formatPhone(value: string): string {
  const cleaned = value.replace(/\D/g, "").slice(0, 11);
  if (cleaned.length <= 10) {
    return cleaned.replace(/(\d{2})(\d)/, "($1) $2").replace(/(\d{4})(\d{1,4})$/, "$1-$2");
  }
  return cleaned.replace(/(\d{2})(\d)/, "($1) $2").replace(/(\d{5})(\d{1,4})$/, "$1-$2");
}

function isValidCpfCnpj(value: string): boolean {
  const cleaned = value.replace(/\D/g, "");
  return cleaned.length === 11 || cleaned.length === 14;
}

interface PaymentResult {
  paymentId: string;
  invoiceUrl: string;
  bankSlipUrl?: string | null;
  status: string;
  billingType: string;
  value: number;
  pixData?: {
    encodedImage: string;
    payload: string;
    expirationDate: string;
  } | null;
}

export default function Planos() {
  const { user } = useAuth();
  const search = useSearch();
  const [, setLocation] = useLocation();
  const params = useMemo(() => new URLSearchParams(search), [search]);
  const status = params.get("status");

  const { data: plans, isLoading: loadingPlans } = trpc.subscription.plans.useQuery();
  const { data: mySub } = trpc.subscription.mySubscription.useQuery(undefined, {
    enabled: !!user,
  });

  const [selectedPlan, setSelectedPlan] = useState<string | null>(null);
  const [paymentResult, setPaymentResult] = useState<PaymentResult | null>(null);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showResultModal, setShowResultModal] = useState(false);
  const [pixCopied, setPixCopied] = useState(false);
  const [cpfCnpj, setCpfCnpj] = useState("");
  const [phone, setPhone] = useState("");

  // Carregar dados salvos do usuário
  const { data: currentUser } = trpc.auth.me.useQuery(undefined, { enabled: !!user });
  useEffect(() => {
    if (currentUser) {
      if ((currentUser as any).cpfCnpj) setCpfCnpj(formatCpfCnpj((currentUser as any).cpfCnpj));
      if ((currentUser as any).phone) setPhone(formatPhone((currentUser as any).phone));
    }
  }, [currentUser]);

  const createAsaasCheckout = trpc.subscription.createAsaasCheckout.useMutation({
    onSuccess: (data) => {
      setPaymentResult(data);
      setShowPaymentModal(false);
      
      if (data.billingType === "PIX" && data.pixData) {
        // Mostrar QR Code PIX no modal
        setShowResultModal(true);
      } else {
        // Redirecionar para a página de pagamento da Asaas
        toast.info("Redirecionando para a página de pagamento...");
        window.open(data.invoiceUrl, "_blank");
      }
    },
    onError: (err) => {
      toast.error(err.message || "Erro ao criar cobrança.");
    },
  });

  useEffect(() => {
    if (status === "success") {
      toast.success("Pagamento confirmado! Sua assinatura foi ativada.");
    }
  }, [status]);

  const handleSelectPlan = (planSlug: string) => {
    if (!user) {
      toast.error("Faça login ou crie uma conta para assinar um plano.", {
        action: {
          label: "Criar Conta",
          onClick: () => setLocation("/cadastro"),
        },
        duration: 6000,
      });
      return;
    }
    setSelectedPlan(planSlug);
    setShowPaymentModal(true);
  };

  const handlePayment = (method: PaymentMethod) => {
    if (!selectedPlan) return;
    if (!isValidCpfCnpj(cpfCnpj)) {
      toast.error("Informe um CPF (11 dígitos) ou CNPJ (14 dígitos) válido.");
      return;
    }
    createAsaasCheckout.mutate({
      planSlug: selectedPlan,
      billingType: method,
      cpfCnpj: cpfCnpj.replace(/\D/g, ""),
      phone: phone ? phone.replace(/\D/g, "") : undefined,
    });
  };

  const copyPixCode = () => {
    if (paymentResult?.pixData?.payload) {
      navigator.clipboard.writeText(paymentResult.pixData.payload);
      setPixCopied(true);
      toast.success("Código PIX copiado!");
      setTimeout(() => setPixCopied(false), 3000);
    }
  };

  if (loadingPlans) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const selectedPlanData = plans?.find(p => p.id === selectedPlan);

  return (
    <div className="max-w-5xl mx-auto">
      <div className="text-center mb-10">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-sm font-medium mb-4">
          <Sparkles className="h-4 w-4" />
          Escolha seu plano
        </div>
        <h1 className="text-3xl font-bold tracking-tight mb-3">
          Planos e Preços
        </h1>
        <p className="text-muted-foreground max-w-lg mx-auto">
          Selecione o plano ideal para o volume de consultas da sua empresa.
          Todos os planos incluem acesso a dados reais da Boa Vista SCPC.
        </p>
      </div>

      <div className={`grid grid-cols-1 gap-6 ${plans && plans.length <= 3 ? 'md:grid-cols-3' : plans && plans.length === 4 ? 'md:grid-cols-2 lg:grid-cols-4' : 'md:grid-cols-2 lg:grid-cols-3'}`}>
        {plans?.map((plan, index) => {
          const Icon = getPlanIcon(plan.id, index);
          const isCurrentPlan = mySub?.planId === plan.id && mySub?.subscriptionStatus === "active";
          const hasCreditsLeft = mySub ? (mySub.consultasLimit === -1 || mySub.consultasUsed < mySub.consultasLimit) : true;
          const canRenew = isCurrentPlan && !hasCreditsLeft;
          const isPopular = plan.popular;

          return (
            <Card
              key={plan.id}
              className={`relative flex flex-col transition-all hover:shadow-lg ${
                isPopular ? "border-primary shadow-md ring-1 ring-primary/20" : ""
              } ${isCurrentPlan ? "border-green-500 bg-green-50/50 dark:bg-green-950/20" : ""}`}
            >
              {isPopular && !isCurrentPlan && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <Badge className="bg-primary text-primary-foreground shadow-sm px-3">
                    Mais Popular
                  </Badge>
                </div>
              )}
              {isCurrentPlan && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <Badge className="bg-green-600 text-white shadow-sm px-3">
                    Plano Atual
                  </Badge>
                </div>
              )}

              <CardHeader className="text-center pb-2 pt-8">
                <div className={`mx-auto h-12 w-12 rounded-xl flex items-center justify-center mb-3 ${
                  isPopular ? "bg-primary text-primary-foreground" : "bg-muted"
                }`}>
                  <Icon className="h-6 w-6" />
                </div>
                <CardTitle className="text-xl">{plan.name}</CardTitle>
                <CardDescription className="text-sm min-h-[40px]">
                  {plan.description}
                </CardDescription>
              </CardHeader>

              <CardContent className="flex-1">
                <div className="text-center mb-6">
                  <span className="text-4xl font-bold tracking-tight">
                    {plan.priceFormatted}
                  </span>
                  <span className="text-muted-foreground text-sm">/mês</span>
                </div>

                <ul className="space-y-3">
                  {plan.features.map((feature: string, i: number) => (
                    <li key={i} className="flex items-start gap-2 text-sm">
                      <Check className={`h-4 w-4 mt-0.5 shrink-0 ${isPopular ? "text-primary" : "text-green-600"}`} />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>

              <CardFooter className="pt-4">
                <Button
                  className="w-full"
                  variant={isPopular || canRenew ? "default" : "outline"}
                  size="lg"
                  disabled={(isCurrentPlan && !canRenew) || createAsaasCheckout.isPending}
                  onClick={() => handleSelectPlan(plan.id)}
                >
                  {createAsaasCheckout.isPending && selectedPlan === plan.id ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : null}
                  {canRenew
                    ? "Renovar Plano"
                    : isCurrentPlan
                    ? "Plano Atual"
                    : "Assinar Agora"}
                </Button>
              </CardFooter>
            </Card>
          );
        })}
      </div>

      <div className="text-center mt-8 text-sm text-muted-foreground">
        <p>Todos os planos podem ser cancelados a qualquer momento.</p>
        <p className="mt-1">Aceitamos PIX, boleto bancário e cartão de crédito.</p>
      </div>

      {/* Modal: Escolha de Forma de Pagamento */}
      <Dialog open={showPaymentModal} onOpenChange={setShowPaymentModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Forma de Pagamento</DialogTitle>
            <DialogDescription>
              {selectedPlanData && (
                <>Plano <strong>{selectedPlanData.name}</strong> — {selectedPlanData.priceFormatted}/mês</>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 mt-4">
            {/* Campos obrigatórios para cobrança */}
            <div className="space-y-3 rounded-lg border bg-muted/30 p-3">
              <p className="text-xs font-medium text-muted-foreground">Dados para cobrança</p>
              <div className="space-y-1.5">
                <Label htmlFor="cpfCnpj" className="text-xs">CPF ou CNPJ <span className="text-red-500">*</span></Label>
                <Input
                  id="cpfCnpj"
                  placeholder="000.000.000-00"
                  value={cpfCnpj}
                  onChange={(e) => setCpfCnpj(formatCpfCnpj(e.target.value))}
                  maxLength={18}
                  inputMode="numeric"
                  disabled={createAsaasCheckout.isPending}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="phone" className="text-xs">Telefone (opcional)</Label>
                <Input
                  id="phone"
                  placeholder="(00) 00000-0000"
                  value={phone}
                  onChange={(e) => setPhone(formatPhone(e.target.value))}
                  maxLength={15}
                  inputMode="tel"
                  disabled={createAsaasCheckout.isPending}
                />
              </div>
            </div>

            <Button
              variant="outline"
              className="w-full h-16 justify-start gap-4 text-left"
              disabled={createAsaasCheckout.isPending}
              onClick={() => handlePayment("PIX")}
            >
              <div className="h-10 w-10 rounded-lg bg-green-100 dark:bg-green-900/30 flex items-center justify-center shrink-0">
                <QrCode className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="font-medium">PIX</p>
                <p className="text-xs text-muted-foreground">Pagamento instantâneo via QR Code</p>
              </div>
              {createAsaasCheckout.isPending && selectedPlan && (
                <Loader2 className="h-4 w-4 animate-spin ml-auto" />
              )}
            </Button>

            <Button
              variant="outline"
              className="w-full h-16 justify-start gap-4 text-left"
              disabled={createAsaasCheckout.isPending}
              onClick={() => handlePayment("BOLETO")}
            >
              <div className="h-10 w-10 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center shrink-0">
                <FileText className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="font-medium">Boleto Bancário</p>
                <p className="text-xs text-muted-foreground">Vencimento em 1 dia útil</p>
              </div>
            </Button>

            <Button
              variant="outline"
              className="w-full h-16 justify-start gap-4 text-left"
              disabled={createAsaasCheckout.isPending}
              onClick={() => handlePayment("CREDIT_CARD")}
            >
              <div className="h-10 w-10 rounded-lg bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center shrink-0">
                <CreditCard className="h-5 w-5 text-purple-600" />
              </div>
              <div>
                <p className="font-medium">Cartão de Crédito</p>
                <p className="text-xs text-muted-foreground">Aprovação imediata</p>
              </div>
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal: Resultado PIX */}
      <Dialog open={showResultModal} onOpenChange={setShowResultModal}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <QrCode className="h-5 w-5 text-green-600" />
              Pagamento via PIX
            </DialogTitle>
            <DialogDescription>
              Escaneie o QR Code ou copie o código para pagar
            </DialogDescription>
          </DialogHeader>

          {paymentResult?.pixData && (
            <div className="space-y-4 mt-2">
              {/* QR Code */}
              <div className="flex justify-center">
                <div className="p-4 bg-white rounded-xl border-2 border-green-200">
                  <img
                    src={`data:image/png;base64,${paymentResult.pixData.encodedImage}`}
                    alt="QR Code PIX"
                    className="w-48 h-48"
                  />
                </div>
              </div>

              {/* Valor */}
              <div className="text-center">
                <p className="text-2xl font-bold text-green-600">
                  R$ {paymentResult.value.toFixed(2).replace(".", ",")}
                </p>
                <p className="text-sm text-muted-foreground mt-1">
                  {selectedPlanData && `Plano ${selectedPlanData.name}`}
                </p>
              </div>

              {/* Código Copia e Cola */}
              <div className="space-y-2">
                <p className="text-sm font-medium">Código PIX (copia e cola):</p>
                <div className="flex gap-2">
                  <div className="flex-1 bg-muted rounded-md p-3 text-xs font-mono break-all max-h-20 overflow-y-auto">
                    {paymentResult.pixData.payload}
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="shrink-0"
                    onClick={copyPixCode}
                  >
                    {pixCopied ? (
                      <CheckCircle2 className="h-4 w-4 text-green-600" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>

              {/* Link alternativo */}
              <Button
                variant="outline"
                className="w-full"
                onClick={() => window.open(paymentResult.invoiceUrl, "_blank")}
              >
                <ExternalLink className="h-4 w-4 mr-2" />
                Abrir página de pagamento
              </Button>

              <p className="text-xs text-center text-muted-foreground">
                Após o pagamento, sua assinatura será ativada automaticamente em alguns segundos.
              </p>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
