import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { ShieldCheck, Eye, EyeOff, Loader2, Check, CheckCircle } from "lucide-react";
import { toast } from "sonner";
import { Link, useSearch } from "wouter";

export default function RedefinirSenha() {
  const searchString = useSearch();
  const token = useMemo(() => {
    const params = new URLSearchParams(searchString);
    return params.get("token") || "";
  }, [searchString]);

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [success, setSuccess] = useState(false);

  const resetMutation = trpc.auth.resetPassword.useMutation({
    onSuccess: (data) => {
      setSuccess(true);
      toast.success(data.message);
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPassword || !confirmPassword) {
      toast.error("Preencha todos os campos.");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("As senhas não conferem.");
      return;
    }
    if (newPassword.length < 6) {
      toast.error("A senha deve ter pelo menos 6 caracteres.");
      return;
    }
    resetMutation.mutate({ token, newPassword });
  };

  if (!token) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="w-full max-w-md px-4">
          <Card className="shadow-lg border-border/50">
            <CardContent className="pt-8 pb-6 flex flex-col items-center gap-4">
              <div className="text-center space-y-2">
                <h2 className="text-xl font-semibold text-destructive">Link inválido</h2>
                <p className="text-sm text-muted-foreground">
                  Este link de redefinição de senha é inválido ou expirou.
                </p>
              </div>
              <Link href="/recuperar-senha">
                <Button variant="outline" className="mt-4">
                  Solicitar novo link
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="w-full max-w-md px-4">
          <Card className="shadow-lg border-border/50">
            <CardContent className="pt-8 pb-6 flex flex-col items-center gap-4">
              <div className="h-16 w-16 rounded-full bg-green-100 flex items-center justify-center">
                <CheckCircle className="h-8 w-8 text-green-600" />
              </div>
              <div className="text-center space-y-2">
                <h2 className="text-xl font-semibold">Senha redefinida!</h2>
                <p className="text-sm text-muted-foreground">
                  Sua senha foi alterada com sucesso. Faça login com sua nova senha.
                </p>
              </div>
              <Link href="/login">
                <Button className="mt-4">Ir para o login</Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  const passwordRequirements = [
    { met: newPassword.length >= 6, label: "Mínimo 6 caracteres" },
    { met: newPassword === confirmPassword && confirmPassword.length > 0, label: "Senhas conferem" },
  ];

  return (
    <div className="flex items-center justify-center min-h-screen bg-background">
      <div className="w-full max-w-md px-4">
        <div className="flex flex-col items-center gap-3 mb-8">
          <div className="h-14 w-14 rounded-xl bg-primary flex items-center justify-center shadow-lg">
            <ShieldCheck className="h-8 w-8 text-primary-foreground" />
          </div>
          <div className="text-center">
            <h1 className="text-2xl font-bold tracking-tight">Maxxi Analise Pro</h1>
            <p className="text-sm text-muted-foreground mt-1">Redefinição de Senha</p>
          </div>
        </div>

        <Card className="shadow-lg border-border/50">
          <CardHeader className="space-y-1 pb-4">
            <CardTitle className="text-xl text-center">Nova Senha</CardTitle>
            <CardDescription className="text-center">
              Defina sua nova senha abaixo
            </CardDescription>
          </CardHeader>
          <form onSubmit={handleSubmit}>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="newPassword">Nova senha</Label>
                <div className="relative">
                  <Input
                    id="newPassword"
                    type={showPassword ? "text" : "password"}
                    placeholder="Sua nova senha"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    autoComplete="new-password"
                    disabled={resetMutation.isPending}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    tabIndex={-1}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Confirmar nova senha</Label>
                <Input
                  id="confirmPassword"
                  type={showPassword ? "text" : "password"}
                  placeholder="Repita a nova senha"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  autoComplete="new-password"
                  disabled={resetMutation.isPending}
                />
              </div>
              {newPassword.length > 0 && (
                <div className="space-y-1.5">
                  {passwordRequirements.map((req, i) => (
                    <div key={i} className="flex items-center gap-2 text-xs">
                      <Check className={`h-3.5 w-3.5 ${req.met ? "text-green-500" : "text-muted-foreground/40"}`} />
                      <span className={req.met ? "text-green-600" : "text-muted-foreground"}>
                        {req.label}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
            <CardFooter className="flex flex-col gap-4">
              <Button
                type="submit"
                className="w-full"
                size="lg"
                disabled={resetMutation.isPending}
              >
                {resetMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Redefinindo...
                  </>
                ) : (
                  "Redefinir senha"
                )}
              </Button>
            </CardFooter>
          </form>
        </Card>
      </div>
    </div>
  );
}
