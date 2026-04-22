import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, User, Mail, Lock, Eye, EyeOff, CheckCircle, CreditCard } from "lucide-react";
import { toast } from "sonner";

export default function MinhaConta() {
  const { user } = useAuth();
  const utils = trpc.useUtils();

  const [name, setName] = useState(user?.name || "");
  const [email, setEmail] = useState(user?.email || "");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPasswords, setShowPasswords] = useState(false);
  const [profileSaved, setProfileSaved] = useState(false);

  const { data: subscription } = trpc.subscription.mySubscription.useQuery();

  const updateMutation = trpc.auth.updateProfile.useMutation({
    onSuccess: (data) => {
      toast.success(data.message);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setProfileSaved(true);
      setTimeout(() => setProfileSaved(false), 3000);
      utils.auth.me.invalidate();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();

    if (newPassword && newPassword !== confirmPassword) {
      toast.error("As senhas não conferem.");
      return;
    }
    if (newPassword && newPassword.length < 6) {
      toast.error("A nova senha deve ter pelo menos 6 caracteres.");
      return;
    }

    const payload: {
      name?: string;
      email?: string;
      newPassword?: string;
      currentPassword?: string;
    } = {};

    if (name && name !== user?.name) payload.name = name;
    if (email && email !== user?.email) payload.email = email;
    if (newPassword) {
      payload.newPassword = newPassword;
      payload.currentPassword = currentPassword;
    }

    if (Object.keys(payload).length === 0) {
      toast.info("Nenhuma alteração detectada.");
      return;
    }

    updateMutation.mutate(payload);
  };

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

  const isOAuthUser = user?.loginMethod === "manus" || !user?.loginMethod?.includes("email");

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight mb-1">Minha Conta</h1>
        <p className="text-muted-foreground">Gerencie suas informações pessoais e senha.</p>
      </div>

      {/* Plano atual */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <CreditCard className="h-4 w-4" />
            Meu Plano
          </CardTitle>
        </CardHeader>
        <CardContent>
          {subscription ? (
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div>
                <p className="font-semibold text-lg">{subscription.planName}</p>
                <p className="text-sm text-muted-foreground">
                  {subscription.consultasUsed} / {subscription.consultasLimit === -1 ? "∞" : subscription.consultasLimit} consultas usadas este mês
                </p>
              </div>
              <Badge className={statusColors[subscription.subscriptionStatus || "none"]}>
                {statusLabels[subscription.subscriptionStatus || "none"]}
              </Badge>
            </div>
          ) : (
            <p className="text-muted-foreground text-sm">Nenhum plano ativo. <a href="/planos" className="text-primary underline">Ver planos disponíveis</a></p>
          )}
        </CardContent>
      </Card>

      {/* Dados pessoais e senha */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <User className="h-4 w-4" />
            Informações Pessoais
          </CardTitle>
          <CardDescription>Atualize seu nome, email e senha de acesso.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSaveProfile} className="space-y-5">
            {/* Nome */}
            <div className="space-y-2">
              <Label htmlFor="name">Nome</Label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="name"
                  placeholder="Seu nome"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="pl-9"
                  disabled={updateMutation.isPending}
                />
              </div>
            </div>

            {/* Email */}
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="email"
                  type="email"
                  placeholder="seu@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="pl-9"
                  disabled={updateMutation.isPending}
                />
              </div>
            </div>

            {/* Separador de senha */}
            <div className="border-t pt-4">
              <div className="flex items-center gap-2 mb-4">
                <Lock className="h-4 w-4 text-muted-foreground" />
                <p className="text-sm font-medium">Alterar Senha</p>
                <span className="text-xs text-muted-foreground">(opcional)</span>
              </div>

              {isOAuthUser ? (
                <p className="text-sm text-muted-foreground bg-muted rounded-lg p-3">
                  Sua conta usa login via Manus OAuth. Para definir uma senha, use o fluxo de <a href="/recuperar-senha" className="text-primary underline">recuperação de senha</a>.
                </p>
              ) : (
                <div className="space-y-3">
                  <div className="space-y-2">
                    <Label htmlFor="currentPassword">Senha atual</Label>
                    <div className="relative">
                      <Input
                        id="currentPassword"
                        type={showPasswords ? "text" : "password"}
                        placeholder="Senha atual"
                        value={currentPassword}
                        onChange={(e) => setCurrentPassword(e.target.value)}
                        disabled={updateMutation.isPending}
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="newPassword">Nova senha</Label>
                    <div className="relative">
                      <Input
                        id="newPassword"
                        type={showPasswords ? "text" : "password"}
                        placeholder="Nova senha (mín. 6 caracteres)"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        disabled={updateMutation.isPending}
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="confirmPassword">Confirmar nova senha</Label>
                    <div className="relative">
                      <Input
                        id="confirmPassword"
                        type={showPasswords ? "text" : "password"}
                        placeholder="Repita a nova senha"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        disabled={updateMutation.isPending}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPasswords(!showPasswords)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                        tabIndex={-1}
                      >
                        {showPasswords ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <Button
              type="submit"
              className="w-full"
              disabled={updateMutation.isPending}
            >
              {updateMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Salvando...
                </>
              ) : profileSaved ? (
                <>
                  <CheckCircle className="mr-2 h-4 w-4" />
                  Salvo!
                </>
              ) : (
                "Salvar Alterações"
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
