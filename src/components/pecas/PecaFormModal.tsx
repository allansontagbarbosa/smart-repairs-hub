import { useEffect, useState } from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { ScannableInput } from "@/components/ui/scannable-input";
import { CreatableSelect } from "@/components/smart-inputs/CreatableSelect";
import { toast } from "sonner";
import { Loader2, Info } from "lucide-react";

/**
 * Modal único para CADASTRO de peça (catálogo).
 * Opera em estoque_itens, tabela canônica de peças.
 *
 * Peça é apenas custo interno da OS — não tem preço de venda.
 * O cliente paga pelo serviço, que já engloba a peça.
 */

export interface PecaSalva {
  id: string;
  nome: string;
  sku: string | null;
  ativo: boolean;
}

interface PecaFormModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** undefined = modo criar; definido = modo editar */
  pecaId?: string | null;
  onSaved?: (peca: PecaSalva) => void;
}

const emptyForm = {
  nome: "",
  categoria_id: "",
  marca_id: "",
  modelo_id: "",
  descricao: "",
  sku: "",
  ativo: true,
};

export function PecaFormModal({ open, onOpenChange, pecaId, onSaved }: PecaFormModalProps) {
  const qc = useQueryClient();
  const isEditing = !!pecaId;
  const [form, setForm] = useState<typeof emptyForm>(emptyForm);
  const set = <K extends keyof typeof emptyForm>(k: K, v: (typeof emptyForm)[K]) =>
    setForm(p => ({ ...p, [k]: v }));

  const { data: categorias = [] } = useQuery({
    queryKey: ["estoque_categorias"],
    queryFn: async () => (await supabase.from("estoque_categorias").select("id, nome").eq("ativo", true).order("nome")).data ?? [],
  });
  const { data: marcas = [] } = useQuery({
    queryKey: ["marcas"],
    queryFn: async () => (await supabase.from("marcas").select("id, nome").eq("ativo", true).order("nome")).data ?? [],
  });
  const { data: modelos = [] } = useQuery({
    queryKey: ["modelos"],
    queryFn: async () => (await supabase.from("modelos").select("id, nome, marca_id").eq("ativo", true).order("nome")).data ?? [],
  });

  // Carrega dados quando entra em modo edição
  useEffect(() => {
    if (!open) return;
    if (!pecaId) {
      setForm(emptyForm);
      return;
    }
    (async () => {
      const { data, error } = await supabase
        .from("estoque_itens")
        .select("*")
        .eq("id", pecaId)
        .single();
      if (error) {
        toast.error("Não foi possível carregar a peça");
        return;
      }
      setForm({
        nome: data.nome_personalizado ?? "",
        categoria_id: data.categoria_id ?? "",
        marca_id: data.marca_id ?? "",
        modelo_id: data.modelo_id ?? "",
        descricao: data.observacoes ?? "",
        sku: data.sku ?? "",
        ativo: data.ativo ?? true,
      });
    })();
  }, [open, pecaId]);

  const createCategoria = async (nome: string) => {
    const { data, error } = await supabase.from("estoque_categorias").insert({ nome }).select("id").single();
    if (error) { toast.error("Erro ao criar categoria"); return null; }
    qc.invalidateQueries({ queryKey: ["estoque_categorias"] });
    toast.success("Categoria criada");
    return data.id;
  };
  const createMarca = async (nome: string) => {
    const { data, error } = await supabase.from("marcas").insert({ nome }).select("id").single();
    if (error) { toast.error("Erro ao criar marca"); return null; }
    qc.invalidateQueries({ queryKey: ["marcas"] });
    toast.success("Marca criada");
    return data.id;
  };
  const createModelo = async (nome: string) => {
    if (!form.marca_id) { toast.error("Selecione uma marca primeiro"); return null; }
    const { data, error } = await supabase.from("modelos").insert({ nome, marca_id: form.marca_id }).select("id").single();
    if (error) { toast.error("Erro ao criar modelo"); return null; }
    qc.invalidateQueries({ queryKey: ["modelos"] });
    toast.success("Modelo criado");
    return data.id;
  };

  const mutation = useMutation({
    mutationFn: async () => {
      if (!form.nome.trim()) throw new Error("Informe o nome da peça");

      const payload = {
        nome_personalizado: form.nome.trim(),
        observacoes: form.descricao || null,
        sku: form.sku?.trim() || null,
        ativo: form.ativo,
        categoria_id: form.categoria_id || null,
        marca_id: form.marca_id || null,
        modelo_id: form.modelo_id || null,
        tipo_item: "peca" as const,
        // custo NÃO é editável manualmente — vem das compras (média ponderada).
        // Peça não tem preço de venda — é só custo interno da OS.
      };

      if (isEditing) {
        const { data, error } = await supabase
          .from("estoque_itens")
          .update(payload)
          .eq("id", pecaId!)
          .select("id, nome_personalizado, sku, ativo")
          .single();
        if (error) throw error;
        return { id: data.id, nome: data.nome_personalizado ?? "", sku: data.sku, ativo: data.ativo } as PecaSalva;
      } else {
        const { data, error } = await supabase
          .from("estoque_itens")
          .insert(payload)
          .select("id, nome_personalizado, sku, ativo")
          .single();
        if (error) throw error;
        return { id: data.id, nome: data.nome_personalizado ?? "", sku: data.sku, ativo: data.ativo } as PecaSalva;
      }
    },
    onSuccess: (peca) => {
      qc.invalidateQueries({ queryKey: ["produtos_base"] });
      qc.invalidateQueries({ queryKey: ["estoque_itens"] });
      toast.success(isEditing ? "Peça atualizada" : "Peça cadastrada no catálogo");
      onSaved?.(peca);
      onOpenChange(false);
    },
    onError: (e: Error) => {
      const msg = String(e?.message ?? "");
      if (msg.includes("duplicate") || msg.includes("unique")) {
        toast.error("SKU já está em uso. Use outro ou deixe vazio.");
      } else {
        toast.error(msg || "Erro ao salvar peça");
      }
    },
  });

  const filteredModelos = (modelos as Array<{ id: string; nome: string; marca_id: string | null }>).filter(
    (m) => !form.marca_id || m.marca_id === form.marca_id
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Editar peça" : "Nova peça no catálogo"}</DialogTitle>
          <DialogDescription className="text-xs flex items-start gap-1.5 text-muted-foreground pt-1">
            <Info className="h-3.5 w-3.5 mt-0.5 shrink-0" />
            <span>Cadastra a peça no catálogo (o que ela é). A quantidade em estoque entra via compras ou ajustes.</span>
          </DialogDescription>
        </DialogHeader>

        <form
          onSubmit={(e) => { e.preventDefault(); mutation.mutate(); }}
          className="space-y-3"
        >
          <div>
            <Label className="text-xs">Nome da peça *</Label>
            <Input
              value={form.nome}
              onChange={(e) => set("nome", e.target.value)}
              placeholder="Ex: Tela iPhone 14 Pro Max"
              className="h-9 mt-1"
              autoFocus
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">SKU</Label>
              <ScannableInput
                value={form.sku}
                onChange={(e) => set("sku", e.target.value)}
                placeholder="Auto"
                scannerTitle="Escanear SKU"
                className="h-9 mt-1"
              />
            </div>
            <CreatableSelect
              label="Categoria"
              value={form.categoria_id}
              onValueChange={(v) => set("categoria_id", v)}
              options={categorias}
              onCreateNew={createCategoria}
              entityName="categoria"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <CreatableSelect
              label="Marca compatível"
              value={form.marca_id}
              onValueChange={(v) => { set("marca_id", v); set("modelo_id", ""); }}
              options={marcas}
              onCreateNew={createMarca}
              entityName="marca"
            />
            <CreatableSelect
              label="Modelo compatível"
              value={form.modelo_id}
              onValueChange={(v) => set("modelo_id", v)}
              options={filteredModelos}
              onCreateNew={createModelo}
              entityName="modelo"
            />
          </div>

          <div>
            <Label className="text-xs">Descrição</Label>
            <Textarea
              value={form.descricao}
              onChange={(e) => set("descricao", e.target.value)}
              rows={2}
              placeholder="Detalhes opcionais"
              className="mt-1"
            />
          </div>

          <p className="text-[11px] text-muted-foreground flex items-start gap-1.5">
            <Info className="h-3 w-3 mt-0.5 shrink-0" />
            <span>
              O custo desta peça é calculado automaticamente pelas compras registradas
              (média ponderada). Peças entram como custo interno da OS — o cliente paga o
              valor do serviço, que já inclui a peça.
            </span>
          </p>

          <div className="flex items-center gap-2 pt-1">
            <Switch checked={form.ativo} onCheckedChange={(v) => set("ativo", v)} />
            <Label className="text-xs">Peça ativa no catálogo</Label>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />}
              {isEditing ? "Salvar alterações" : "Cadastrar peça"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
