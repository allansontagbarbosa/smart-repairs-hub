import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEmpresa } from "@/contexts/EmpresaContext";
import { useToast } from "@/hooks/use-toast";
import { ReceiptText, Plus, Trash2, Loader2, Users, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { AtacadoEmptyState } from "@/components/atacado/AtacadoEmptyState";
import { EditarItensTabelaDialog } from "@/components/atacado/EditarItensTabelaDialog";

export default function AtacadoTabelasPreco() {
  const { empresaId } = useEmpresa();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [novoOpen, setNovoOpen] = useState(false);
  const [editarItensOpen, setEditarItensOpen] = useState<string | null>(null);

  const { data: tabelas = [], isLoading } = useQuery({
    queryKey: ["atacado-tabelas-preco-full", empresaId],
    queryFn: async () => {
      const { data } = await supabase
        .from("atacado_tabelas_preco" as any)
        .select(
          `*, clientes:atacado_clientes(count), itens:atacado_tabelas_preco_itens(count)`
        )
        .eq("empresa_id", empresaId!)
        .is("deleted_at", null)
        .order("created_at");
      return (data as any[]) ?? [];
    },
    enabled: !!empresaId,
  });

  const deleteTabela = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("atacado_tabelas_preco" as any)
        .update({ deleted_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["atacado-tabelas-preco-full"] });
      toast({ title: "✓ Tabela removida" });
    },
    onError: (e: any) =>
      toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Tabelas de Preço B2B</h1>
          <p className="text-sm text-muted-foreground">
            Tabela A, B, C… com markup e escalonamento por quantidade
          </p>
        </div>
        <Button size="sm" onClick={() => setNovoOpen(true)}>
          <Plus className="h-4 w-4" /> Nova tabela
        </Button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : tabelas.length === 0 ? (
        <AtacadoEmptyState
          icon={ReceiptText}
          title="Nenhuma tabela criada"
          description="Crie tabelas para precificar diferente por perfil de cliente (Premium, Atacado, VIP…)."
          ctaLabel="Criar primeira tabela"
          ctaOnClick={() => setNovoOpen(true)}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {tabelas.map((t: any) => {
            const qtdClientes = t.clientes?.[0]?.count ?? 0;
            const qtdItens = t.itens?.[0]?.count ?? 0;
            return (
              <div
                key={t.id}
                className="border rounded-lg p-4 bg-card hover:border-primary/40 transition-colors space-y-4"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-foreground">{t.nome}</h3>
                      {!t.ativa && <Badge variant="outline">Inativa</Badge>}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Markup padrão: {t.markup_padrao_pct}%
                    </p>
                  </div>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <Trash2 className="h-4 w-4 text-muted-foreground" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Remover tabela {t.nome}?</AlertDialogTitle>
                        <AlertDialogDescription>
                          {qtdClientes > 0
                            ? `Atenção: ${qtdClientes} cliente(s) usam essa tabela. Eles ficarão sem tabela atribuída.`
                            : "Esta ação é reversível pelo banco."}
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={() => deleteTabela.mutate(t.id)}
                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                          Remover
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>

                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="border rounded-md p-3">
                    <p className="text-xs text-muted-foreground">Clientes</p>
                    <p className="font-bold text-foreground flex items-center gap-1 mt-1">
                      <Users className="h-3.5 w-3.5 text-muted-foreground" /> {qtdClientes}
                    </p>
                  </div>
                  <div className="border rounded-md p-3">
                    <p className="text-xs text-muted-foreground">Itens cadastrados</p>
                    <p className="font-bold text-foreground mt-1">{qtdItens}</p>
                  </div>
                </div>

                {t.observacoes && (
                  <p className="text-xs text-muted-foreground italic border-l-2 border-muted pl-3">
                    {t.observacoes}
                  </p>
                )}

                <Button
                  variant="outline"
                  size="sm"
                  className="w-full"
                  onClick={() => setEditarItensOpen(t.id)}
                >
                  <Pencil className="h-4 w-4" /> Editar itens da tabela
                </Button>
              </div>
            );
          })}
        </div>
      )}

      <NovaTabelaDialog open={novoOpen} onOpenChange={setNovoOpen} />
      <EditarItensTabelaDialog
        open={!!editarItensOpen}
        onOpenChange={(v) => !v && setEditarItensOpen(null)}
        tabelaId={editarItensOpen}
      />
    </div>
  );
}

function NovaTabelaDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const { empresaId } = useEmpresa();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [salvando, setSalvando] = useState(false);
  const [form, setForm] = useState({
    nome: "",
    markup_padrao_pct: "15",
    ativa: true,
    observacoes: "",
  });

  const handleSalvar = async () => {
    if (!form.nome.trim()) {
      toast({ title: "Nome obrigatório", variant: "destructive" });
      return;
    }
    setSalvando(true);
    try {
      const { error } = await supabase.from("atacado_tabelas_preco" as any).insert({
        empresa_id: empresaId,
        nome: form.nome.trim(),
        markup_padrao_pct:
          parseFloat(form.markup_padrao_pct.replace(",", ".")) || 15,
        ativa: form.ativa,
        observacoes: form.observacoes || null,
      });
      if (error) throw error;
      toast({ title: "✓ Tabela criada" });
      qc.invalidateQueries({ queryKey: ["atacado-tabelas-preco-full"] });
      setForm({ nome: "", markup_padrao_pct: "15", ativa: true, observacoes: "" });
      onOpenChange(false);
    } catch (e: any) {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    } finally {
      setSalvando(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ReceiptText className="h-5 w-5 text-primary" /> Nova tabela
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label>Nome *</Label>
            <Input
              value={form.nome}
              onChange={(e) => setForm({ ...form, nome: e.target.value })}
              placeholder="Ex: Tabela A — Premium"
            />
          </div>
          <div className="space-y-2">
            <Label>Markup padrão (%)</Label>
            <Input
              inputMode="decimal"
              value={form.markup_padrao_pct}
              onChange={(e) =>
                setForm({ ...form, markup_padrao_pct: e.target.value })
              }
            />
            <p className="text-xs text-muted-foreground">
              % sobre o custo. Pode ser sobrescrito por item.
            </p>
          </div>
          <div className="flex items-start justify-between gap-3 p-3 border rounded-md">
            <div className="space-y-0.5">
              <p className="text-sm font-medium">Tabela ativa</p>
              <p className="text-xs text-muted-foreground">
                Clientes podem ser vinculados a esta tabela
              </p>
            </div>
            <Switch
              checked={form.ativa}
              onCheckedChange={(v) => setForm({ ...form, ativa: v })}
            />
          </div>
          <div className="space-y-2">
            <Label>Observações</Label>
            <Textarea
              rows={2}
              value={form.observacoes}
              onChange={(e) => setForm({ ...form, observacoes: e.target.value })}
              placeholder="Ex: VIPs, condição especial…"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={salvando}>
            Cancelar
          </Button>
          <Button onClick={handleSalvar} disabled={salvando}>
            {salvando ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" /> Salvando
              </>
            ) : (
              "✓ Criar"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
