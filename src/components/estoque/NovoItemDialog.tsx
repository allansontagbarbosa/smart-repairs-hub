import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import type { EstoqueItem } from "@/hooks/useEstoque";

type Categoria = { id: string; nome: string };
type Marca = { id: string; nome: string };
type Modelo = { id: string; nome: string; marca_id: string };

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editingItem: EstoqueItem | null;
  categorias: Categoria[];
  marcas: Marca[];
  modelos: Modelo[];
}

type FormValues = {
  categoria_id: string;
  marca_id: string;
  modelo_id: string;
  nome_personalizado: string;
  cor: string;
  capacidade: string;
  imei_serial: string;
  sku: string;
  quantidade: string;
  quantidade_minima: string;
  custo_unitario: string;
  preco_venda: string;
  local_estoque: string;
  fornecedor: string;
  observacoes: string;
  descricao: string;
};

const emptyForm: FormValues = {
  categoria_id: "", marca_id: "", modelo_id: "",
  nome_personalizado: "", cor: "", capacidade: "", imei_serial: "", sku: "",
  quantidade: "1", quantidade_minima: "0", custo_unitario: "", preco_venda: "",
  local_estoque: "", fornecedor: "", observacoes: "", descricao: "",
};

export function NovoItemDialog({ open, onOpenChange, editingItem, categorias, marcas, modelos }: Props) {
  const queryClient = useQueryClient();
  const isEditing = !!editingItem;
  const [newCatName, setNewCatName] = useState("");
  const [newMarcaName, setNewMarcaName] = useState("");
  const [newModeloName, setNewModeloName] = useState("");
  const [showNewCat, setShowNewCat] = useState(false);
  const [showNewMarca, setShowNewMarca] = useState(false);
  const [showNewModelo, setShowNewModelo] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);

  const { register, handleSubmit, reset, setValue, watch } = useForm<FormValues>({ defaultValues: emptyForm });

  const selectedMarca = watch("marca_id");
  const filteredModelos = modelos.filter(m => m.marca_id === selectedMarca);

  useEffect(() => {
    if (open && editingItem) {
      reset({
        categoria_id: editingItem.categoria_id ?? "",
        marca_id: editingItem.marca_id ?? "",
        modelo_id: editingItem.modelo_id ?? "",
        nome_personalizado: editingItem.nome_personalizado ?? "",
        cor: editingItem.cor ?? "",
        capacidade: editingItem.capacidade ?? "",
        imei_serial: editingItem.imei_serial ?? "",
        sku: editingItem.sku ?? "",
        quantidade: String(editingItem.quantidade),
        quantidade_minima: String(editingItem.quantidade_minima),
        custo_unitario: editingItem.custo_unitario ? String(editingItem.custo_unitario) : "",
        preco_venda: editingItem.preco_venda ? String(editingItem.preco_venda) : "",
        local_estoque: editingItem.local_estoque ?? "",
        fornecedor: editingItem.fornecedor ?? "",
        observacoes: editingItem.observacoes ?? "",
        descricao: "",
      });
      if (editingItem.cor || editingItem.capacidade || editingItem.imei_serial || editingItem.preco_venda) {
        setShowAdvanced(true);
      }
    } else if (open) {
      reset(emptyForm);
      setShowAdvanced(false);
    }
  }, [open, editingItem, reset]);

  const addCategoria = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.from("estoque_categorias").insert({ nome: newCatName }).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["estoque_categorias"] });
      setValue("categoria_id", data.id);
      setNewCatName("");
      setShowNewCat(false);
      toast.success("Categoria criada!");
    },
  });

  const addMarca = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.from("marcas").insert({ nome: newMarcaName }).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["marcas"] });
      setValue("marca_id", data.id);
      setNewMarcaName("");
      setShowNewMarca(false);
      toast.success("Marca criada!");
    },
  });

  const addModelo = useMutation({
    mutationFn: async () => {
      if (!selectedMarca) throw new Error("Selecione uma marca primeiro");
      const { data, error } = await supabase.from("modelos").insert({ nome: newModeloName, marca_id: selectedMarca }).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["modelos"] });
      setValue("modelo_id", data.id);
      setNewModeloName("");
      setShowNewModelo(false);
      toast.success("Modelo criado!");
    },
  });

  const mutation = useMutation({
    mutationFn: async (values: FormValues) => {
      const payload = {
        tipo_item: "peca" as const,
        categoria_id: values.categoria_id || null,
        marca_id: values.marca_id || null,
        modelo_id: values.modelo_id || null,
        nome_personalizado: values.nome_personalizado || null,
        cor: values.cor || null,
        capacidade: values.capacidade || null,
        imei_serial: values.imei_serial || null,
        sku: values.sku?.trim() || null, // null = auto-generate via trigger
        quantidade: parseInt(values.quantidade) || 0,
        quantidade_minima: parseInt(values.quantidade_minima) || 0,
        custo_unitario: values.custo_unitario ? parseFloat(values.custo_unitario) : null,
        preco_venda: values.preco_venda ? parseFloat(values.preco_venda) : null,
        local_estoque: values.local_estoque || null,
        fornecedor: values.fornecedor || null,
        observacoes: values.observacoes || null,
      };

      if (isEditing) {
        const { data, error } = await supabase.from("estoque_itens").update(payload).eq("id", editingItem.id).select("sku").single();
        if (error) throw error;
        return data;
      } else {
        const { data, error } = await supabase.from("estoque_itens").insert(payload).select("sku").single();
        if (error) throw error;
        return data;
      }
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["estoque_itens"] });
      const skuMsg = data?.sku ? ` (SKU: ${data.sku})` : "";
      toast.success((isEditing ? "Peça atualizada!" : "Peça adicionada ao estoque!") + skuMsg);
      onOpenChange(false);
    },
    onError: (e: any) => {
      const msg = e.message || "";
      if (msg.includes("já está em uso") || msg.includes("duplicate") || msg.includes("unique")) {
        toast.error("Este SKU já está em uso. Use outro ou deixe vazio para gerar automaticamente.");
      } else {
        toast.error(msg);
      }
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Editar Peça" : "Nova Peça no Estoque"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(v => mutation.mutate(v))} className="space-y-3">
          {/* Nome da peça */}
          <div>
            <Label className="text-xs">Nome da peça *</Label>
            <Input {...register("nome_personalizado")} placeholder="Ex: Tela iPhone 14 Pro Max" className="h-9 mt-1" autoFocus />
          </div>

          {/* Categoria */}
          <div>
            <div className="flex items-center justify-between">
              <Label className="text-xs">Categoria</Label>
              <button type="button" className="text-[10px] text-primary font-medium hover:underline" onClick={() => setShowNewCat(!showNewCat)}>
                <Plus className="h-3 w-3 inline" /> Nova
              </button>
            </div>
            {showNewCat ? (
              <div className="flex gap-2 mt-1">
                <Input value={newCatName} onChange={e => setNewCatName(e.target.value)} placeholder="Nome da categoria" className="h-8 text-sm" />
                <Button type="button" size="sm" className="h-8" onClick={() => addCategoria.mutate()} disabled={!newCatName}>Criar</Button>
              </div>
            ) : (
              <Select value={watch("categoria_id")} onValueChange={v => setValue("categoria_id", v)}>
                <SelectTrigger className="h-9 mt-1"><SelectValue placeholder="Selecionar categoria" /></SelectTrigger>
                <SelectContent>
                  {categorias.map(c => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}
                </SelectContent>
              </Select>
            )}
          </div>

          {/* Marca compatível */}
          <div>
            <div className="flex items-center justify-between">
              <Label className="text-xs">Marca compatível</Label>
              <button type="button" className="text-[10px] text-primary font-medium hover:underline" onClick={() => setShowNewMarca(!showNewMarca)}>
                <Plus className="h-3 w-3 inline" /> Nova
              </button>
            </div>
            {showNewMarca ? (
              <div className="flex gap-2 mt-1">
                <Input value={newMarcaName} onChange={e => setNewMarcaName(e.target.value)} placeholder="Nome da marca" className="h-8 text-sm" />
                <Button type="button" size="sm" className="h-8" onClick={() => addMarca.mutate()} disabled={!newMarcaName}>Criar</Button>
              </div>
            ) : (
              <Select value={watch("marca_id")} onValueChange={v => { setValue("marca_id", v); setValue("modelo_id", ""); }}>
                <SelectTrigger className="h-9 mt-1"><SelectValue placeholder="Selecionar marca" /></SelectTrigger>
                <SelectContent>
                  {marcas.map(m => <SelectItem key={m.id} value={m.id}>{m.nome}</SelectItem>)}
                </SelectContent>
              </Select>
            )}
          </div>

          {/* Modelo compatível */}
          {selectedMarca && (
            <div>
              <div className="flex items-center justify-between">
                <Label className="text-xs">Modelo compatível</Label>
                <button type="button" className="text-[10px] text-primary font-medium hover:underline" onClick={() => setShowNewModelo(!showNewModelo)}>
                  <Plus className="h-3 w-3 inline" /> Novo
                </button>
              </div>
              {showNewModelo ? (
                <div className="flex gap-2 mt-1">
                  <Input value={newModeloName} onChange={e => setNewModeloName(e.target.value)} placeholder="Nome do modelo" className="h-8 text-sm" />
                  <Button type="button" size="sm" className="h-8" onClick={() => addModelo.mutate()} disabled={!newModeloName}>Criar</Button>
                </div>
              ) : (
                <Select value={watch("modelo_id")} onValueChange={v => setValue("modelo_id", v)}>
                  <SelectTrigger className="h-9 mt-1"><SelectValue placeholder="Selecionar modelo" /></SelectTrigger>
                  <SelectContent>
                    {filteredModelos.map(m => <SelectItem key={m.id} value={m.id}>{m.nome}</SelectItem>)}
                  </SelectContent>
                </Select>
              )}
            </div>
          )}

          {/* Quantidade + Mínimo */}
          <div className="grid grid-cols-2 gap-3">
            <div><Label className="text-xs">Quantidade *</Label><Input type="number" {...register("quantidade")} className="h-9 mt-1" /></div>
            <div><Label className="text-xs">Qtd. Mínima</Label><Input type="number" {...register("quantidade_minima")} className="h-9 mt-1" /></div>
          </div>

          {/* Custo + SKU */}
          <div className="grid grid-cols-2 gap-3">
            <div><Label className="text-xs">Custo unitário (R$)</Label><Input type="number" step="0.01" {...register("custo_unitario")} placeholder="Digite o valor" className="h-9 mt-1" /></div>
            <div><Label className="text-xs">SKU</Label><Input {...register("sku")} placeholder="Auto se vazio" className="h-9 mt-1" /></div>
          </div>

          {/* Local + Fornecedor */}
          <div className="grid grid-cols-2 gap-3">
            <div><Label className="text-xs">Local do estoque</Label><Input {...register("local_estoque")} placeholder="Prateleira A" className="h-9 mt-1" /></div>
            <div><Label className="text-xs">Fornecedor</Label><Input {...register("fornecedor")} placeholder="Nome do fornecedor" className="h-9 mt-1" /></div>
          </div>

          {/* Toggle advanced fields */}
          <button
            type="button"
            className="text-xs text-primary hover:underline"
            onClick={() => setShowAdvanced(!showAdvanced)}
          >
            {showAdvanced ? "▾ Menos campos" : "▸ Mais campos (cor, capacidade, serial, preço venda)"}
          </button>

          {showAdvanced && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div><Label className="text-xs">Cor</Label><Input {...register("cor")} placeholder="Preto" className="h-9 mt-1" /></div>
                <div><Label className="text-xs">Capacidade</Label><Input {...register("capacidade")} placeholder="128GB" className="h-9 mt-1" /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label className="text-xs">IMEI / Serial</Label><Input {...register("imei_serial")} placeholder="Opcional" className="h-9 mt-1" /></div>
                <div><Label className="text-xs">Preço venda (R$)</Label><Input type="number" step="0.01" {...register("preco_venda")} placeholder="Digite o valor" className="h-9 mt-1" /></div>
              </div>
            </>
          )}

          <div>
            <Label className="text-xs">Observações</Label>
            <Textarea {...register("observacoes")} rows={2} className="mt-1" placeholder="Informações adicionais sobre a peça" />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? "Salvando..." : isEditing ? "Salvar" : "Adicionar Peça"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
