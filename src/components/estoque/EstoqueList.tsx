import { useState } from "react";
import { Search, Plus, Pencil, Trash2, Minus } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { NovoItemDialog } from "./NovoItemDialog";
import type { EstoqueItem } from "@/hooks/useEstoque";

const fmtCurrency = (v: number | null) => {
  if (v == null) return "—";
  return `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;
};

const tipoLabels: Record<string, string> = {
  aparelho: "Aparelho",
  peca: "Peça",
  acessorio: "Acessório",
};

const tipoColors: Record<string, string> = {
  aparelho: "bg-info/10 text-info",
  peca: "bg-warning/10 text-warning",
  acessorio: "bg-success/10 text-success",
};

interface Props {
  itens: EstoqueItem[];
  categorias: { id: string; nome: string }[];
  marcas: { id: string; nome: string }[];
  modelos: { id: string; nome: string; marca_id: string }[];
}

export function EstoqueList({ itens, categorias, marcas, modelos }: Props) {
  const [search, setSearch] = useState("");
  const [filterTipo, setFilterTipo] = useState("todos");
  const [filterCategoria, setFilterCategoria] = useState("todas");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<EstoqueItem | null>(null);
  const queryClient = useQueryClient();

  const getItemName = (item: EstoqueItem) => {
    if (item.nome_personalizado) return item.nome_personalizado;
    const parts = [item.marcas?.nome, item.modelos?.nome, item.cor, item.capacidade].filter(Boolean);
    return parts.length > 0 ? parts.join(" ") : "Item sem nome";
  };

  const filtered = itens.filter(i => {
    const q = search.toLowerCase();
    const name = getItemName(i).toLowerCase();
    const matchSearch = !search ||
      name.includes(q) ||
      (i.imei_serial?.toLowerCase().includes(q)) ||
      (i.sku?.toLowerCase().includes(q)) ||
      (i.fornecedor?.toLowerCase().includes(q));
    const matchTipo = filterTipo === "todos" || i.tipo_item === filterTipo;
    const matchCat = filterCategoria === "todas" || i.categoria_id === filterCategoria;
    return matchSearch && matchTipo && matchCat;
  });

  const softDeleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("estoque_itens").update({ deleted_at: new Date().toISOString() }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["estoque_itens"] });
      toast.success("Item removido do estoque!");
    },
  });

  const ajustarMutation = useMutation({
    mutationFn: async ({ id, delta }: { id: string; delta: number }) => {
      const item = itens.find(i => i.id === id);
      if (!item) return;
      const novaQtd = Math.max(0, item.quantidade + delta);
      const { error } = await supabase.from("estoque_itens").update({ quantidade: novaQtd }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["estoque_itens"] });
    },
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-2.5">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar nome, IMEI, SKU..." className="pl-9 h-9" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <Select value={filterTipo} onValueChange={setFilterTipo}>
          <SelectTrigger className="w-full sm:w-36 h-9"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos tipos</SelectItem>
            <SelectItem value="aparelho">Aparelhos</SelectItem>
            <SelectItem value="peca">Peças</SelectItem>
            <SelectItem value="acessorio">Acessórios</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filterCategoria} onValueChange={setFilterCategoria}>
          <SelectTrigger className="w-full sm:w-40 h-9"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todas">Todas categorias</SelectItem>
            {categorias.map(c => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}
          </SelectContent>
        </Select>
        <Button size="sm" className="gap-1.5 h-9" onClick={() => { setEditingItem(null); setDialogOpen(true); }}>
          <Plus className="h-3.5 w-3.5" /> Novo Item
        </Button>
      </div>

      <div className="section-card">
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>Item</th>
                <th className="hidden sm:table-cell">Tipo</th>
                <th className="hidden md:table-cell">Categoria</th>
                <th className="text-center">Qtd</th>
                <th className="hidden sm:table-cell">IMEI/Serial</th>
                <th className="hidden md:table-cell text-right">Custo</th>
                <th className="text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(item => {
                const name = getItemName(item);
                const isBaixo = item.quantidade_minima > 0 && item.quantidade <= item.quantidade_minima;
                return (
                  <tr key={item.id} className={isBaixo ? "bg-destructive/5" : ""}>
                    <td>
                      <p className="text-sm font-medium">{name}</p>
                      <p className="text-xs text-muted-foreground">{item.marcas?.nome} {item.modelos?.nome}</p>
                    </td>
                    <td className="hidden sm:table-cell">
                      <span className={cn("inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold", tipoColors[item.tipo_item])}>
                        {tipoLabels[item.tipo_item] ?? item.tipo_item}
                      </span>
                    </td>
                    <td className="hidden md:table-cell text-sm text-muted-foreground">{item.estoque_categorias?.nome ?? "—"}</td>
                    <td className="text-center">
                      <div className="inline-flex items-center gap-1">
                        <button
                          onClick={() => ajustarMutation.mutate({ id: item.id, delta: -1 })}
                          className="h-6 w-6 rounded-md border flex items-center justify-center text-muted-foreground hover:bg-muted transition-colors"
                        >
                          <Minus className="h-3 w-3" />
                        </button>
                        <span className={cn("text-sm font-medium min-w-8 text-center", isBaixo && "text-destructive")}>
                          {item.quantidade}
                        </span>
                        <button
                          onClick={() => ajustarMutation.mutate({ id: item.id, delta: 1 })}
                          className="h-6 w-6 rounded-md border flex items-center justify-center text-muted-foreground hover:bg-muted transition-colors"
                        >
                          <Plus className="h-3 w-3" />
                        </button>
                      </div>
                      {item.quantidade_minima > 0 && (
                        <p className="text-[10px] text-muted-foreground">mín: {item.quantidade_minima}</p>
                      )}
                    </td>
                    <td className="hidden sm:table-cell text-xs text-muted-foreground font-mono">{item.imei_serial ?? "—"}</td>
                    <td className="hidden md:table-cell text-sm text-right text-muted-foreground">{fmtCurrency(item.custo_unitario)}</td>
                    <td>
                      <div className="flex items-center justify-end gap-0.5">
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { setEditingItem(item); setDialogOpen(true); }}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => softDeleteMutation.mutate(item.id)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr><td colSpan={7} className="text-center text-muted-foreground py-10 text-sm">Nenhum item encontrado</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <NovoItemDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        editingItem={editingItem}
        categorias={categorias}
        marcas={marcas}
        modelos={modelos}
      />
    </div>
  );
}
