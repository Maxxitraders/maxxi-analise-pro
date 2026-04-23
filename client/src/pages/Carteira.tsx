import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { toast } from "sonner";
import {
  Wallet,
  Plus,
  TrendingUp,
  TrendingDown,
  CreditCard,
  DollarSign,
  Loader2,
  AlertCircle,
  CheckCircle2,
  ArrowUpRight,
  ArrowDownLeft,
  RotateCcw,
} from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

// Valores predefinidos de recarga
const VALORES_RAPIDOS = [20, 50, 100, 200];

export default function Carteira() {
  const [valor, setValor] = useState(50);
  const [metodoPagamento, setMetodoPagamento] = useState<"PIX" | "CREDIT_CARD" | "BOLETO">("PIX");
  const [customValor, setCustomValor] = useState("");

  // Queries
  const { data: saldoData, isLoading: loadingSaldo } = trpc.wallet.getSaldo.useQuery();
  const { data: transacoes, isLoading: loadingTransacoes } = trpc.wallet.getTransacoes.useQuery({ 
    limit: 20, 
    offset: 0 
  });

  // Mutation
  const adicionarSaldo = trpc.wallet.adicionarSaldo.useMutation({
    onSuccess: (data) => {
      toast.success("Redirecionando para pagamento...");
      // Abrir URL de pagamento em nova aba
      window.open(data.paymentUrl, "_blank");
    },
    onError: (error) => {
      toast.error(error.message || "Erro ao criar cobrança");
    },
  });

  const saldo = saldoData?.saldo || 0;

  const handleRecarga = async () => {
    const valorFinal = customValor ? parseFloat(customValor) : valor;

    if (valorFinal < 5) {
      toast.error("Valor mínimo de recarga: R$ 5,00");
      return;
    }

    if (valorFinal > 1000) {
      toast.error("Valor máximo de recarga: R$ 1.000,00");
      return;
    }

    await adicionarSaldo.mutateAsync({
      valor: valorFinal,
      metodoPagamento,
    });
  };

  const getIconoTransacao = (tipo: string) => {
    if (tipo === "recarga") return <ArrowUpRight className="h-4 w-4 text-green-600" />;
    if (tipo === "consulta") return <ArrowDownLeft className="h-4 w-4 text-red-600" />;
    return <RotateCcw className="h-4 w-4 text-blue-600" />;
  };

  return (
    <div className="container mx-auto p-6 max-w-5xl space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <Wallet className="h-8 w-8" />
          Minha Carteira
        </h1>
        <p className="text-muted-foreground mt-1">
          Gerencie seu saldo e histórico de transações
        </p>
      </div>

      {/* Card de Saldo */}
      <Card className="bg-gradient-to-br from-blue-500 to-blue-600 text-white border-0">
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-blue-100 text-sm font-medium mb-2">Saldo Disponível</p>
              {loadingSaldo ? (
                <div className="flex items-center gap-2">
                  <Loader2 className="h-6 w-6 animate-spin" />
                  <span className="text-2xl font-semibold">Carregando...</span>
                </div>
              ) : (
                <p className="text-5xl font-bold">R$ {saldo.toFixed(2)}</p>
              )}
              <p className="text-blue-100 text-xs mt-2">
                🟢 Boa Vista: R$ 6,50 | 🟣 Serasa Premium: R$ 15,00
              </p>
            </div>
            <DollarSign className="h-16 w-16 opacity-20" />
          </div>
        </CardContent>
      </Card>

      {/* Aviso de Crédito Não-Reembolsável */}
      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          <strong>Importante:</strong> Os créditos adicionados são <strong>não-reembolsáveis</strong>. 
          Se houver falha na consulta, o valor será automaticamente estornado para seu saldo.
        </AlertDescription>
      </Alert>

      {/* Card de Recarga */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Plus className="h-5 w-5" />
            Adicionar Saldo
          </CardTitle>
          <CardDescription>
            Recarregue sua carteira para realizar consultas
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Valores Rápidos */}
          <div className="space-y-2">
            <Label>Valores Rápidos</Label>
            <div className="grid grid-cols-4 gap-3">
              {VALORES_RAPIDOS.map((v) => (
                <Button
                  key={v}
                  type="button"
                  variant={valor === v && !customValor ? "default" : "outline"}
                  onClick={() => {
                    setValor(v);
                    setCustomValor("");
                  }}
                  className="h-16 text-lg font-semibold"
                >
                  R$ {v}
                </Button>
              ))}
            </div>
          </div>

          {/* Valor Personalizado */}
          <div className="space-y-2">
            <Label htmlFor="custom-valor">Ou Digite Outro Valor</Label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                R$
              </span>
              <Input
                id="custom-valor"
                type="number"
                min="5"
                max="1000"
                step="0.01"
                value={customValor}
                onChange={(e) => {
                  setCustomValor(e.target.value);
                  setValor(0);
                }}
                placeholder="0,00"
                className="pl-10 text-lg"
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Mínimo: R$ 5,00 • Máximo: R$ 1.000,00
            </p>
          </div>

          <Separator />

          {/* Método de Pagamento */}
          <div className="space-y-3">
            <Label>Método de Pagamento</Label>
            <RadioGroup value={metodoPagamento} onValueChange={(v) => setMetodoPagamento(v as any)}>
              <div className="flex items-center space-x-2 border rounded-lg p-3 hover:bg-accent cursor-pointer">
                <RadioGroupItem value="PIX" id="pix" />
                <Label htmlFor="pix" className="flex-1 cursor-pointer">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                        <CreditCard className="h-4 w-4 text-primary" />
                      </div>
                      <span className="font-medium">PIX</span>
                    </div>
                    <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                      Aprovação instantânea
                    </Badge>
                  </div>
                </Label>
              </div>

              <div className="flex items-center space-x-2 border rounded-lg p-3 hover:bg-accent cursor-pointer">
                <RadioGroupItem value="CREDIT_CARD" id="card" />
                <Label htmlFor="card" className="flex-1 cursor-pointer">
                  <div className="flex items-center gap-2">
                    <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                      <CreditCard className="h-4 w-4 text-primary" />
                    </div>
                    <span className="font-medium">Cartão de Crédito</span>
                  </div>
                </Label>
              </div>

              <div className="flex items-center space-x-2 border rounded-lg p-3 hover:bg-accent cursor-pointer">
                <RadioGroupItem value="BOLETO" id="boleto" />
                <Label htmlFor="boleto" className="flex-1 cursor-pointer">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                        <CreditCard className="h-4 w-4 text-primary" />
                      </div>
                      <span className="font-medium">Boleto</span>
                    </div>
                    <Badge variant="outline" className="text-amber-600 border-amber-200">
                      Até 3 dias úteis
                    </Badge>
                  </div>
                </Label>
              </div>
            </RadioGroup>
          </div>

          {/* Botão de Recarga */}
          <Button
            onClick={handleRecarga}
            disabled={adicionarSaldo.isPending || (!customValor && !valor)}
            size="lg"
            className="w-full"
          >
            {adicionarSaldo.isPending ? (
              <>
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                Processando...
              </>
            ) : (
              <>
                <Plus className="mr-2 h-5 w-5" />
                Adicionar R$ {(customValor ? parseFloat(customValor) || 0 : valor).toFixed(2)}
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Histórico de Transações */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Histórico de Transações
          </CardTitle>
          <CardDescription>
            Últimas {transacoes?.length || 0} transações
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loadingTransacoes ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : transacoes && transacoes.length > 0 ? (
            <div className="space-y-3">
              {transacoes.map((t) => (
                <div
                  key={t.id}
                  className="flex items-center justify-between p-4 border rounded-lg hover:bg-accent/50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className={`h-10 w-10 rounded-full flex items-center justify-center ${
                      t.tipo === "recarga" ? "bg-green-100" : 
                      t.tipo === "consulta" ? "bg-red-100" : "bg-blue-100"
                    }`}>
                      {getIconoTransacao(t.tipo)}
                    </div>
                    <div>
                      <p className="font-medium">{t.descricao}</p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(t.createdAt).toLocaleString("pt-BR", {
                          day: "2-digit",
                          month: "2-digit",
                          year: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className={`text-lg font-bold ${
                      parseFloat(t.valor) > 0 ? "text-green-600" : "text-red-600"
                    }`}>
                      {parseFloat(t.valor) > 0 ? "+" : ""}R$ {Math.abs(parseFloat(t.valor)).toFixed(2)}
                    </p>
                    {t.bureauTipo && (
                      <Badge variant="outline" className="text-xs mt-1">
                        {t.bureauTipo === "serasa_premium" ? "Serasa Premium" : "Boa Vista"}
                      </Badge>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              <Wallet className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>Nenhuma transação encontrada</p>
              <p className="text-sm mt-1">Adicione saldo para começar</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
