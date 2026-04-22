import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Loader2,
  Plus,
  Pencil,
  Trash2,
  RefreshCw,
  Package,
  ArrowLeft,
  X,
  Check,
  Star,
  Eye,
  EyeOff,
  ExternalLink,
} from "lucide-react";
import { toast } from "sonner";
import { useState, useCallback } from "react";
import { useLocation } from "wouter";

interface PlanFormData {
  slug: string;
  name: string;
  description: string;
  monthlyPrice: number;
  consultasLimit: number;
  features: string[];
  popular: boolean;
  sortOrder: number;
  active: boolean;
}

const emptyForm: PlanFormData = {
  slug: "",
  name: "",
  description: "",
  monthlyPrice: 0,
  consultasLimit: 0,
  features: [""],
  popular: false,
  sortOrder: 0,
  active: true,
};

export default function AdminPlanos() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<PlanFormData>({ ...emptyForm });
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [deleteName, setDeleteName] = useState("");

  const utils = trpc.useUtils();

  const { data: plans, isLoading } = trpc.admin.listPlans.useQuery(undefined, {
    enabled: user?.role === "admin",
  });

  const createMutation = trpc.admin.createPlan.useMutation({
    onSuccess: () => {
      toast.success("Plano criado com sucesso!");
      utils.admin.listPlans.invalidate();
      utils.subscription.plans.invalidate();
      closeForm();
    },
    onError: (err) => toast.error(err.message),
  });

  const updateMutation = trpc.admin.updatePlan.useMutation({
    onSuccess: () => {
      toast.success("Plano atualizado com sucesso!");
      utils.admin.listPlans.invalidate();
      utils.subscription.plans.invalidate();
      closeForm();
    },
    onError: (err) => toast.error(err.message),
  });

  const deleteMutation = trpc.admin.deletePlan.useMutation({
    onSuccess: () => {
      toast.success("Plano excluído com sucesso!");
      utils.admin.listPlans.invalidate();
      utils.subscription.plans.invalidate();
      setDeleteId(null);
    },
    onError: (err) => toast.error(err.message),
  });

  const syncMutation = trpc.admin.syncPlanToStripe.useMutation({
    onSuccess: (data) => {
      toast.success("Plano sincronizado com o Stripe!");
      utils.admin.listPlans.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  const closeForm = useCallback(() => {
    setShowForm(false);
    setEditingId(null);
    setForm({ ...emptyForm });
  }, []);

  const openCreateForm = useCallback(() => {
    setForm({ ...emptyForm });
    setEditingId(null);
    setShowForm(true);
  }, []);

  const openEditForm = useCallback((plan: any) => {
    setForm({
      slug: plan.id,
      name: plan.name,
      description: plan.description || "",
      monthlyPrice: plan.monthlyPrice,
      consultasLimit: plan.consultasLimit,
      features: plan.features.length > 0 ? [...plan.features] : [""],
      popular: plan.popular || false,
      sortOrder: plan.sortOrder || 0,
      active: plan.active,
    });
    setEditingId(plan.dbId);
    setShowForm(true);
  }, []);

  const handleSubmit = useCallback(() => {
    const cleanFeatures = form.features.filter((f) => f.trim() !== "");
    if (cleanFeatures.length === 0) {
      toast.error("Adicione pelo menos uma funcionalidade ao plano.");
      return;
    }

    if (editingId) {
      updateMutation.mutate({
        id: editingId,
        slug: form.slug,
        name: form.name,
        description: form.description,
        monthlyPrice: form.monthlyPrice,
        consultasLimit: form.consultasLimit,
        features: cleanFeatures,
        popular: form.popular,
        sortOrder: form.sortOrder,
        active: form.active,
      });
    } else {
      createMutation.mutate({
        slug: form.slug,
        name: form.name,
        description: form.description,
        monthlyPrice: form.monthlyPrice,
        consultasLimit: form.consultasLimit,
        features: cleanFeatures,
        popular: form.popular,
        sortOrder: form.sortOrder,
      });
    }
  }, [form, editingId, createMutation, updateMutation]);

  const addFeature = useCallback(() => {
    setForm((prev) => ({ ...prev, features: [...prev.features, ""] }));
  }, []);

  const removeFeature = useCallback((index: number) => {
    setForm((prev) => ({
      ...prev,
      features: prev.features.filter((_, i) => i !== index),
    }));
  }, []);

  const updateFeature = useCallback((index: number, value: string) => {
    setForm((prev) => ({
      ...prev,
      features: prev.features.map((f, i) => (i === index ? value : f)),
    }));
  }, []);

  if (user?.role !== "admin") {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <h2 className="text-xl font-semibold mb-2">Acesso Restrito</h2>
          <p className="text-muted-foreground">
            Esta página é exclusiva para administradores.
          </p>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setLocation("/admin")}
            className="shrink-0"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight mb-1">
              Gerenciar Planos
            </h1>
            <p className="text-muted-foreground">
              Crie, edite e gerencie os planos de assinatura da plataforma.
            </p>
          </div>
        </div>
        <Button onClick={openCreateForm} className="gap-2">
          <Plus className="h-4 w-4" />
          Novo Plano
        </Button>
      </div>

      {/* Plans Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Package className="h-5 w-5 text-primary" />
            Planos de Assinatura
          </CardTitle>
        </CardHeader>
        <CardContent>
          {!plans || plans.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Package className="h-12 w-12 mx-auto mb-4 opacity-30" />
              <p>Nenhum plano cadastrado.</p>
              <Button
                variant="outline"
                className="mt-4"
                onClick={openCreateForm}
              >
                Criar primeiro plano
              </Button>
            </div>
          ) : (
            <div className="rounded-md border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">Ordem</TableHead>
                    <TableHead>Plano</TableHead>
                    <TableHead>Slug</TableHead>
                    <TableHead className="text-right">Preço</TableHead>
                    <TableHead className="text-center">Consultas</TableHead>
                    <TableHead className="text-center">Status</TableHead>
                    <TableHead className="text-center">Stripe</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {plans.map((plan) => (
                    <TableRow
                      key={plan.dbId}
                      className={!plan.active ? "opacity-50" : ""}
                    >
                      <TableCell className="font-mono text-sm text-muted-foreground">
                        {plan.sortOrder}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{plan.name}</span>
                          {plan.popular && (
                            <Badge
                              variant="secondary"
                              className="gap-1 text-xs"
                            >
                              <Star className="h-3 w-3" />
                              Popular
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <code className="text-xs bg-muted px-1.5 py-0.5 rounded">
                          {plan.id}
                        </code>
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {plan.priceFormatted}
                        <span className="text-xs text-muted-foreground">
                          /mês
                        </span>
                      </TableCell>
                      <TableCell className="text-center">
                        {plan.consultasLimit === -1 ? (
                          <Badge variant="secondary">Ilimitado</Badge>
                        ) : (
                          <span>{plan.consultasLimit}</span>
                        )}
                      </TableCell>
                      <TableCell className="text-center">
                        {plan.active ? (
                          <Badge className="bg-green-100 text-green-800 gap-1">
                            <Eye className="h-3 w-3" />
                            Ativo
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="gap-1">
                            <EyeOff className="h-3 w-3" />
                            Inativo
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-center">
                        {plan.stripePriceId ? (
                          <Badge className="bg-indigo-100 text-indigo-800 gap-1">
                            <Check className="h-3 w-3" />
                            Sincronizado
                          </Badge>
                        ) : (
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-7 text-xs gap-1"
                            disabled={syncMutation.isPending}
                            onClick={() =>
                              syncMutation.mutate({ id: plan.dbId })
                            }
                          >
                            {syncMutation.isPending ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                              <RefreshCw className="h-3 w-3" />
                            )}
                            Sincronizar
                          </Button>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => openEditForm(plan)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive hover:text-destructive"
                            onClick={() => {
                              setDeleteId(plan.dbId);
                              setDeleteName(plan.name);
                            }}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Info Card */}
      <Card className="border-blue-200 bg-blue-50/50">
        <CardContent className="pt-6">
          <div className="flex gap-3">
            <ExternalLink className="h-5 w-5 text-blue-600 shrink-0 mt-0.5" />
            <div className="text-sm text-blue-900">
              <p className="font-medium mb-1">Dicas de gerenciamento</p>
              <ul className="space-y-1 text-blue-800">
                <li>
                  O <strong>slug</strong> é o identificador interno do plano
                  (ex: basico, profissional). Use apenas letras minúsculas,
                  números e hífens.
                </li>
                <li>
                  O <strong>preço</strong> deve ser informado em centavos (ex:
                  9900 = R$ 99,00).
                </li>
                <li>
                  Use <strong>-1</strong> no limite de consultas para planos
                  ilimitados.
                </li>
                <li>
                  Planos <strong>inativos</strong> não aparecem na página de
                  preços, mas assinantes existentes mantêm acesso.
                </li>
                <li>
                  Ao alterar o preço, o plano será automaticamente
                  re-sincronizado com o Stripe no próximo checkout.
                </li>
                <li>
                  Apenas <strong>um plano</strong> pode ser marcado como
                  "Popular" por vez.
                </li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Create/Edit Dialog */}
      <Dialog open={showForm} onOpenChange={(open) => !open && closeForm()}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingId ? "Editar Plano" : "Novo Plano"}
            </DialogTitle>
            <DialogDescription>
              {editingId
                ? "Altere os dados do plano abaixo."
                : "Preencha os dados para criar um novo plano de assinatura."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name">Nome do Plano</Label>
                <Input
                  id="name"
                  placeholder="Ex: Profissional"
                  value={form.name}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, name: e.target.value }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="slug">Slug (identificador)</Label>
                <Input
                  id="slug"
                  placeholder="Ex: profissional"
                  value={form.slug}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      slug: e.target.value
                        .toLowerCase()
                        .replace(/[^a-z0-9_-]/g, ""),
                    }))
                  }
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Descrição</Label>
              <Textarea
                id="description"
                placeholder="Descrição curta do plano..."
                value={form.description}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    description: e.target.value,
                  }))
                }
                rows={2}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="monthlyPrice">
                  Preço Mensal (centavos)
                </Label>
                <div className="relative">
                  <Input
                    id="monthlyPrice"
                    type="number"
                    min={0}
                    placeholder="9900"
                    value={form.monthlyPrice || ""}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        monthlyPrice: parseInt(e.target.value) || 0,
                      }))
                    }
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                    = R${" "}
                    {(form.monthlyPrice / 100)
                      .toFixed(2)
                      .replace(".", ",")}
                  </span>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="consultasLimit">
                  Limite de Consultas
                </Label>
                <Input
                  id="consultasLimit"
                  type="number"
                  min={-1}
                  placeholder="30 (-1 = ilimitado)"
                  value={form.consultasLimit}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      consultasLimit: parseInt(e.target.value) || 0,
                    }))
                  }
                />
                {form.consultasLimit === -1 && (
                  <p className="text-xs text-muted-foreground">
                    Consultas ilimitadas
                  </p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="sortOrder">Ordem de Exibição</Label>
                <Input
                  id="sortOrder"
                  type="number"
                  min={0}
                  value={form.sortOrder}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      sortOrder: parseInt(e.target.value) || 0,
                    }))
                  }
                />
              </div>
              <div className="space-y-4 pt-6">
                <div className="flex items-center gap-3">
                  <Switch
                    id="popular"
                    checked={form.popular}
                    onCheckedChange={(checked) =>
                      setForm((prev) => ({ ...prev, popular: checked }))
                    }
                  />
                  <Label htmlFor="popular" className="cursor-pointer">
                    Destacar como Popular
                  </Label>
                </div>
                {editingId && (
                  <div className="flex items-center gap-3">
                    <Switch
                      id="active"
                      checked={form.active}
                      onCheckedChange={(checked) =>
                        setForm((prev) => ({ ...prev, active: checked }))
                      }
                    />
                    <Label htmlFor="active" className="cursor-pointer">
                      Plano Ativo
                    </Label>
                  </div>
                )}
              </div>
            </div>

            {/* Features */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Funcionalidades</Label>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs gap-1"
                  onClick={addFeature}
                >
                  <Plus className="h-3 w-3" />
                  Adicionar
                </Button>
              </div>
              <div className="space-y-2">
                {form.features.map((feature, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <Input
                      placeholder={`Funcionalidade ${index + 1}`}
                      value={feature}
                      onChange={(e) => updateFeature(index, e.target.value)}
                    />
                    {form.features.length > 1 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-9 w-9 shrink-0 text-muted-foreground hover:text-destructive"
                        onClick={() => removeFeature(index)}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={closeForm}>
              Cancelar
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={
                createMutation.isPending ||
                updateMutation.isPending ||
                !form.name ||
                !form.slug
              }
            >
              {(createMutation.isPending || updateMutation.isPending) && (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              )}
              {editingId ? "Salvar Alterações" : "Criar Plano"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog
        open={deleteId !== null}
        onOpenChange={(open) => !open && setDeleteId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Plano</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir o plano{" "}
              <strong>{deleteName}</strong>? Esta ação não pode ser desfeita.
              Assinantes existentes deste plano perderão o acesso.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (deleteId) deleteMutation.mutate({ id: deleteId });
              }}
            >
              {deleteMutation.isPending && (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              )}
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
