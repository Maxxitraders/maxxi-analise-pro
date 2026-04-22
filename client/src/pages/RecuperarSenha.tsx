import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { ShieldCheck, Loader2, ArrowLeft, Mail } from "lucide-react";
import { toast } from "sonner";
import { Link } from "wouter";

export default function RecuperarSenha() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);

  const resetMutation = trpc.auth.requestPasswordReset.useMutation({
    onSuccess: (data) => {
      setSent(true);
      toast.success(data.message);
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) {
      toast.error("Informe seu email.");
      return;
    }
    resetMutation.mutate({ email, origin: window.location.origin });
  };

  if (sent) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="w-full max-w-md px-4">
          <Card className="shadow-lg border-border/50">
            <CardContent className="pt-8 pb-6 flex flex-col items-center gap-4">
              <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
                <Mail className="h-8 w-8 text-primary" />
              </div>
              <div className="text-center space-y-2">
                <h2 className="text-xl font-semibold">Verifique seu email</h2>
                <p className="text-sm text-muted-foreground max-w-sm">
                  Se o email <strong>{email}</strong> estiver cadastrado, você receberá instruções para redefinir sua senha.
                </p>
              </div>
              <Link href="/login">
                <Button variant="outline" className="mt-4">
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Voltar ao login
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center min-h-screen bg-background">
      <div className="w-full max-w-md px-4">
        <div className="flex flex-col items-center gap-3 mb-8">
          <div className="h-14 w-14 rounded-xl bg-primary flex items-center justify-center shadow-lg">
            <ShieldCheck className="h-8 w-8 text-primary-foreground" />
          </div>
          <div className="text-center">
            <h1 className="text-2xl font-bold tracking-tight">Maxxi Analise Pro</h1>
            <p className="text-sm text-muted-foreground mt-1">Recuperação de Senha</p>
          </div>
        </div>

        <Card className="shadow-lg border-border/50">
          <CardHeader className="space-y-1 pb-4">
            <CardTitle className="text-xl text-center">Recuperar Senha</CardTitle>
            <CardDescription className="text-center">
              Informe seu email para receber instruções de redefinição
            </CardDescription>
          </CardHeader>
          <form onSubmit={handleSubmit}>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="seu@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                  disabled={resetMutation.isPending}
                />
              </div>
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
                    Enviando...
                  </>
                ) : (
                  "Enviar instruções"
                )}
              </Button>
              <Link href="/login" className="text-sm text-muted-foreground hover:text-foreground text-center">
                <ArrowLeft className="inline mr-1 h-3.5 w-3.5" />
                Voltar ao login
              </Link>
            </CardFooter>
          </form>
        </Card>
      </div>
    </div>
  );
}
