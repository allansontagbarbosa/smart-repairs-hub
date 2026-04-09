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
  tipo_item: string;
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
};

export function NovoItemDialog({ open, onOpenChange, editingItem, categorias, marcas, modelos }: Props) {
  const queryClient = useQueryClient();
  const isEditing = !!editingItem;
  const [newCatName, setNewCatName] = useState("");
  const [newMarcaName, setNewMarcaName] = useState("");
  const [showNewCat, setShowNewCat] = useState(false);
  const [showNewMarca, setShowNewMarca] = useState(false);

  const { register, handleSubmit, reset, setValue, watch } = useForm<FormValues>({
    defaultValues: {
      tipo_item: "peca", categoria_id: "", marca_id: "", modelo_id: "",
      nome_personalizado: "", cor: "", capacidade: "", imei_serial: "", sku: "",
      quantidade: "1", quantidade_minima: "0", custo_unitario: "", preco_venda: "",
      local_estoque: "", fornecedor: "", observacoes: "",
    },
  });

  const selectedMarca = watch("marca_id");
  const filteredModelos = modelos.filter(m => m.marca_id === selectedMarca);

  useEffect(() => {
    if (open && editingItem) {
      reset({
        tipo_item: editingItem.tipo_item,
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
        custo_unitario: String(editingItem.custo_unitario ?? ""),
        preco_venda: String(editingItem.preco_venda ?? ""),
        local_estoque: editingItem.local_estoque ?? "",
        fornecedor: editingItem.fornecedor ?? "",
        observacoes: editingItem.observacoes ?? "",
      });
    } else if (open) {
      reset({
        tipo_item: "peca", categoria_id: "", marca_id: "", modelo_id: "",
        nome_personalizado: "", cor: "", capacidade: "", imei_serial: "", sku: "",
        quantidade: "1", quantidade_minima: "0", custo_unitario: "", preco_venda: "",
        local_estoque: "", fornecedor: "", observacoes: "",
      });
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

  const mutation = useMutation({
    mutationFn: async (values: FormValues) => {
      const payload = {
        tipo_item: values.tipo_item,
        categoria_id: values.categoria_id || null,
        marca_id: values.marca_id || null,
        modelo_id: values.modelo_id || null,
        nome_personalizado: values.nome_personalizado || null,
        cor: values.cor || null,
        capacidade: values.capacidade || null,
        imei_serial: values.imei_serial || null,
        sku: values.sku || null,
        quantidade: parseInt(values.quantidade) || 0,
        quantidade_minima: parseInt(values.quantidade_minima) || 0,
        custo_unitario: values.custo_unitario ? parseFloat(values.custo_unitario) : null,
        preco_venda: values.preco_venda ? parseFloat(values.preco_venda) : null,
        local_estoque: values.local_estoque || null,
        fornecedor: values.fornecedor || null,
        observacoes: values.observacoes || null,
      };

      if (isEditing) {
        const { error } = await supabase.from("estoque_itens").update(payload).eq("id", editingItem.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("estoque_itens").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["estoque_itens"] });
      toast.success(isEditing ? "Item atualizado!" : "Item adicionado!");
      onOpenChange(false);
    },
    onError: (e: any) => {
      if (e.message?.includes("estoque_itens_imei_serial_unique")) {
        toast.error("IMEI/Serial já cadastrado no sistema!");
      } else {
        toast.error(e.message);
      }
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Editar Item" : "Novo Item no Estoque"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(v => mutation.mutate(v))} className="space-y-3">
          {/* Tipo */}
          <div>
            <Label className="text-xs">Tipo do item *</Label>
            <Select value={watch("tipo_item")} onValueChange={v => setValue("tipo_item", v)}>
              <SelectTrigger className="h-9 mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="aparelho">Aparelho</SelectItem>
                <SelectItem value="peca">Peça</SelectItem>
                <SelectItem value="acessorio">Acessório</SelectItem>
              </SelectContent>
            </Select>
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
                <SelectTrigger className="h-9 mt-1"><SelectValue placeholder="Selecionar" /></SelectTrigger>
                <SelectContent>
                  {categorias.map(c => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}
                </SelectContent>
              </Select>
            )}
          </div>

          {/* Marca */}
          <div>
            <div className="flex items-center justify-between">
              <Label className="text-xs">Marca</Label>
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
                <SelectTrigger className="h-9 mt-1"><SelectValue placeholder="Selecionar" /></SelectTrigger>
                <SelectContent>
                  {marcas.map(m => <SelectItem key={m.id} value={m.id}>{m.nome}</SelectItem>)}
                </SelectContent>
              </Select>
            )}
          </div>

          {/* Modelo */}
          {selectedMarca && (
            <div>
              <Label className="text-xs">Modelo</Label>
              <Select value={watch("modelo_id")} onValueChange={v => setValue("modelo_id", v)}>
                <SelectTrigger className="h-9 mt-1"><SelectValue placeholder="Selecionar modelo" /></SelectTrigger>
                <SelectContent>
                  {filteredModelos.map(m => <SelectItem key={m.id} value={m.id}>{m.nome}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Nome + Cor + Capacidade */}
          <div>
            <Label className="text-xs">Nome personalizado</Label>
            <Input {...register("nome_personalizado")} placeholder="Ex: Tela iPhone 14 Pro Max" className="h-9 mt-1" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label className="text-xs">Cor</Label><Input {...register("cor")} placeholder="Preto" className="h-9 mt-1" /></div>
            <div><Label className="text-xs">Capacidade</Label><Input {...register("capacidade")} placeholder="128GB" className="h-9 mt-1" /></div>
          </div>

          {/* IMEI + SKU */}
          <div className="grid grid-cols-2 gap-3">
            <div><Label className="text-xs">IMEI / Serial</Label><Input {...register("imei_serial")} placeholder="Opcional" className="h-9 mt-1" /></div>
            <div><Label className="text-xs">SKU</Label><Input {...register("sku")} placeholder="Opcional" className="h-9 mt-1" /></div>
          </div>

          {/* Quantidade */}
          <div className="grid grid-cols-2 gap-3">
            <div><Label className="text-xs">Quantidade *</Label><Input type="number" {...register("quantidade")} className="h-9 mt-1" /></div>
            <div><Label className="text-xs">Qtd. Mínima</Label><Input type="number" {...register("quantidade_minima")} className="h-9 mt-1" /></div>
          </div>

          {/* Preços */}
          <div className="grid grid-cols-2 gap-3">
            <div><Label className="text-xs">Custo unitário (R$)</Label><Input type="number" step="0.01" {...register("custo_unitario")} placeholder="0,00" className="h-9 mt-1" /></div>
            <div><Label className="text-xs">Preço venda (R$)</Label><Input type="number" step="0.01" {...register("preco_venda")} placeholder="0,00" className="h-9 mt-1" /></div>
          </div>

          {/* Local + Fornecedor */}
          <div className="grid grid-cols-2 gap-3">
            <div><Label className="text-xs">Local do estoque</Label><Input {...register("local_estoque")} placeholder="Prateleira A" className="h-9 mt-1" /></div>
            <div><Label className="text-xs">Fornecedor</Label><Input {...register("fornecedor")} placeholder="Nome" className="h-9 mt-1" /></div>
          </div>

          <div>
            <Label className="text-xs">Observações</Label>
            <Textarea {...register("observacoes")} rows={2} className="mt-1" />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? "Salvando..." : isEditing ? "Salvar" : "Adicionar"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
