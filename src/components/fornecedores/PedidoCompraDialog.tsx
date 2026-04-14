import { useState, useEffect } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  fornecedorId?: string | null;
  preSelectedItem?: { estoque_item_id: string; nome: string; custo: number } | null;
}

interface ItemLine {
  estoque_item_id: string;
  nome_item: string;
  quantidade: number;
  custo_unitario: number;
}

export function PedidoCompraDialog({ open, onOpenChange, fornecedorId, preSelectedItem }: Props) {
  const qc = useQueryClient();
  const [selectedFornecedor, setSelectedFornecedor] = useState("");
  const [dataPrevisao, setDataPrevisao] = useState("");
  const [observacoes, setObservacoes] = useState("");
  const [itens, setItens] = useState<ItemLine[]>([]);

  const { data: fornecedores = [] } = useQuery({
    queryKey: ["fornecedores_ativos"],
    queryFn: async () => {
      const { data } = await supabase.from("fornecedores").select("id, nome").eq("ativo", true).order("nome");
      return data || [];
    },
  });

  const { data: estoqueItens = [] } = useQuery({
    queryKey: ["estoque_itens_pedido"],
    queryFn: async () => {
      const { data } = await supabase
        .from("estoque_itens")
        .select("id, nome_personalizado, custo_unitario, sku")
        .is("deleted_at", null)
        .order("nome_personalizado");
      return data || [];
    },
  });

  useEffect(() => {
    if (open) {
      setSelectedFornecedor(fornecedorId || "");
      setDataPrevisao("");
      setObservacoes("");
      if (preSelectedItem) {
        setItens([{
          estoque_item_id: preSelectedItem.estoque_item_id,
          nome_item: preSelectedItem.nome,
          quantidade: 1,
          custo_unitario: preSelectedItem.custo,
        }]);
      } else {
        setItens([]);
      }
    }
  }, [open, fornecedorId, preSelectedItem]);

  const addItem = () => {
    setItens((prev) => [...prev, { estoque_item_id: "", nome_item: "", quantidade: 1, custo_unitario: 0 }]);
  };

  const removeItem = (idx: number) => {
    setItens((prev) => prev.filter((_, i) => i !== idx));
  };

  const updateItem = (idx: number, field: string, value: any) => {
    setItens((prev) => prev.map((item, i) => {
      if (i !== idx) return item;
      const updated = { ...item, [field]: value };
      if (field === "estoque_item_id") {
        const found = estoqueItens.find((e: any) => e.id === value);
        if (found) {
          updated.nome_item = found.nome_personalizado || "";
          updated.custo_unitario = found.custo_unitario || 0;
        }
      }
      return updated;
    }));
  };

  const valorTotal = itens.reduce((acc, i) => acc + i.quantidade * i.custo_unitario, 0);

  const handleSave = async () => {
    if (!selectedFornecedor) { toast.error("Selecione um fornecedor"); return; }
    if (itens.length === 0) { toast.error("Adicione pelo menos um item"); return; }
    if (itens.some((i) => !i.nome_item)) { toast.error("Todos os itens precisam de nome"); return; }

    const { data: pedido, error } = await supabase
      .from("pedidos_compra")
      .insert({
        fornecedor_id: selectedFornecedor,
        status: "rascunho",
        data_previsao: dataPrevisao || null,
        valor_total: valorTotal,
        observacoes: observacoes || null,
      })
      .select("id")
      .single();

    if (error || !pedido) { toast.error("Erro ao criar pedido"); return; }

    const itensPayload = itens.map((i) => ({
      pedido_id: pedido.id,
      estoque_item_id: i.estoque_item_id || null,
      nome_item: i.nome_item,
      quantidade: i.quantidade,
      custo_unitario: i.custo_unitario,
    }));

    await supabase.from("pedidos_compra_itens").insert(itensPayload);

    qc.invalidateQueries({ queryKey: ["pedidos_compra"] });
    toast.success("Pedido de compra criado como rascunho");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Novo Pedido de Compra</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {/* Step 1: Supplier */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <Label>Fornecedor *</Label>
              <Select value={selectedFornecedor} onValueChange={setSelectedFornecedor}>
                <SelectTrigger><SelectValue placeholder="Selecionar fornecedor" /></SelectTrigger>
                <SelectContent>
                  {fornecedores.map((f: any) => (
                    <SelectItem key={f.id} value={f.id}>{f.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Previsão de entrega</Label>
              <Input type="date" value={dataPrevisao} onChange={(e) => setDataPrevisao(e.target.value)} />
            </div>
          </div>

          {/* Step 2: Items */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <Label className="text-sm font-semibold">Itens do pedido</Label>
              <Button size="sm" variant="outline" onClick={addItem}>
                <Plus className="h-3.5 w-3.5 mr-1" /> Adicionar item
              </Button>
            </div>

            <div className="space-y-2">
              {itens.map((item, idx) => (
                <div key={idx} className="flex gap-2 items-end border rounded-lg p-2">
                  <div className="flex-1">
                    <Label className="text-xs">Item</Label>
                    <Select value={item.estoque_item_id} onValueChange={(v) => updateItem(idx, "estoque_item_id", v)}>
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue placeholder="Selecionar peça" />
                      </SelectTrigger>
                      <SelectContent>
                        {estoqueItens.map((e: any) => (
                          <SelectItem key={e.id} value={e.id}>
                            {e.nome_personalizado || e.sku || "Item"}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="w-20">
                    <Label className="text-xs">Qtd</Label>
                    <Input
                      type="number"
                      min={1}
                      className="h-8 text-xs"
                      value={item.quantidade}
                      onChange={(e) => updateItem(idx, "quantidade", parseInt(e.target.value) || 1)}
                    />
                  </div>
                  <div className="w-28">
                    <Label className="text-xs">Custo unit.</Label>
                    <Input
                      type="number"
                      step="0.01"
                      min={0}
                      className="h-8 text-xs"
                      value={item.custo_unitario}
                      onChange={(e) => updateItem(idx, "custo_unitario", parseFloat(e.target.value) || 0)}
                    />
                  </div>
                  <div className="w-24 text-right">
                    <p className="text-xs font-medium pt-5">
                      R$ {(item.quantidade * item.custo_unitario).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                    </p>
                  </div>
                  <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => removeItem(idx)}>
                    <Trash2 className="h-3.5 w-3.5 text-destructive" />
                  </Button>
                </div>
              ))}
              {itens.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">Nenhum item adicionado</p>
              )}
            </div>
          </div>

          {/* Total */}
          <div className="flex justify-between items-center border-t pt-3">
            <span className="text-sm font-medium">Total do pedido</span>
            <span className="text-lg font-bold">
              R$ {valorTotal.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
            </span>
          </div>

          <div>
            <Label>Observações</Label>
            <Textarea value={observacoes} onChange={(e) => setObservacoes(e.target.value)} rows={2} />
          </div>

          <Button onClick={handleSave} className="w-full">Criar Pedido (Rascunho)</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
