import { useState } from "react";
import { Search, Pencil, EyeOff, MapPin, Download, Power } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { ScannableInput } from "@/components/ui/scannable-input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { NovoItemDialog } from "./NovoItemDialog";
import { useBulkSelection } from "@/hooks/useBulkSelection";
import { BulkActionBar } from "@/components/BulkActionBar";
import { HeaderCheckbox, RowCheckbox } from "@/components/SelectableCheckbox";
import { exportToCsv } from "@/lib/export-csv";
import type { EstoqueItem } from "@/hooks/useEstoque";

const fmtCurrency = (v: number | null) => {
  if (v == null) return "—";
  return `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;
};


interface Props {
  itens: EstoqueItem[];
  categorias: { id: string; nome: string }[];
  marcas: { id: string; nome: string }[];
  modelos: { id: string; nome: string; marca_id: string }[];
}

export function EstoqueList({ itens, categorias, marcas, modelos }: Props) {
  const [search, setSearch] = useState("");
  const [filterCategoria, setFilterCategoria] = useState("todas");
  const [mostrarInativas, setMostrarInativas] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<EstoqueItem | null>(null);
  const [confirmToggleStatus, setConfirmToggleStatus] = useState<null | "ativar" | "inativar">(null);
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
      (i.sku?.toLowerCase().includes(q)) ||
      ((i as any).codigo_barras?.toLowerCase().includes(q)) ||
      (i.imei_serial?.toLowerCase().includes(q)) ||
      (i.fornecedor?.toLowerCase().includes(q)) ||
      (i.estoque_categorias?.nome?.toLowerCase().includes(q));
    const matchCat = filterCategoria === "todas" || i.categoria_id === filterCategoria;
    const matchAtivo = mostrarInativas || i.ativo !== false;
    return matchSearch && matchCat && matchAtivo;
  });

  const bulk = useBulkSelection(filtered);

  const toggleAtivoMutation = useMutation({
    mutationFn: async ({ ids, ativo }: { ids: string[]; ativo: boolean }) => {
      const { error } = await supabase.from("estoque_itens" as any).update({ ativo }).in("id", ids);
      if (error) throw error;
      return { count: ids.length, ativo };
    },
    onSuccess: ({ count, ativo }) => {
      queryClient.invalidateQueries({ queryKey: ["estoque_itens"] });
      toast.success(`${count} ${count === 1 ? "peça" : "peças"} ${ativo ? "reativada(s)" : "desativada(s)"}`);
      bulk.clear();
    },
    onError: (err: any) => toast.error("Erro ao alterar peça", { description: err?.message }),
  });

  const bulkToggleStatusMutation = useMutation({
    mutationFn: async ({ ids, status }: { ids: string[]; status: "ativo" | "inativo" }) => {
      const { error } = await supabase.from("estoque_itens").update({ status }).in("id", ids);
      if (error) throw error;
      return ids.length;
    },
    onSuccess: (count, vars) => {
      queryClient.invalidateQueries({ queryKey: ["estoque_itens"] });
      toast.success(`${count} ${count === 1 ? "peça" : "peças"} ${vars.status === "ativo" ? "ativada(s)" : "inativada(s)"}`);
      bulk.clear();
    },
    onError: (err: any) => toast.error("Erro ao alterar status", { description: err?.message }),
  });

  const handleExportCsv = () => {
    const rows = bulk.selectedItems.length > 0 ? bulk.selectedItems : filtered;
    if (rows.length === 0) {
      toast.warning("Nenhuma peça para exportar");
      return;
    }
    exportToCsv(`pecas-${new Date().toISOString().slice(0, 10)}.csv`, rows, [
      { header: "SKU", value: r => r.sku ?? "" },
      { header: "Nome", value: r => getItemName(r) },
      { header: "Categoria", value: r => r.estoque_categorias?.nome ?? "" },
      { header: "Marca", value: r => r.marcas?.nome ?? "" },
      { header: "Modelo", value: r => r.modelos?.nome ?? "" },
      { header: "Cor", value: r => r.cor ?? "" },
      { header: "Capacidade", value: r => r.capacidade ?? "" },
      { header: "Quantidade", value: r => r.quantidade },
      { header: "Mínimo", value: r => r.quantidade_minima },
      { header: "Custo médio", value: r => r.custo_medio ?? "" },
      { header: "Local", value: r => r.local_estoque ?? "" },
      { header: "Fornecedor", value: r => r.fornecedor ?? "" },
      { header: "Status", value: r => (r as any).status ?? "ativo" },
    ]);
    toast.success(`${rows.length} ${rows.length === 1 ? "peça exportada" : "peças exportadas"}`);
  };

  const previewNames = bulk.selectedItems.slice(0, 5).map(getItemName);
  const restCount = Math.max(0, bulk.count - previewNames.length);

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-2.5">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground z-10" />
          <ScannableInput
            placeholder="Buscar peça, SKU, código de barras..."
            className="pl-9 h-9"
            value={search}
            onChange={e => setSearch(e.target.value)}
            scannerTitle="Escanear código da peça"
          />
        </div>
        <Select value={filterCategoria} onValueChange={setFilterCategoria}>
          <SelectTrigger className="w-full sm:w-40 h-9"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todas">Todas categorias</SelectItem>
            {categorias.map(c => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}
          </SelectContent>
        </Select>
        <Button
          type="button"
          variant={mostrarInativas ? "secondary" : "outline"}
          size="sm"
          className="h-9"
          onClick={() => setMostrarInativas(v => !v)}
        >
          {mostrarInativas ? "Ocultar inativas" : "Mostrar inativas"}
        </Button>
      </div>

      <BulkActionBar
        count={bulk.count}
        onClear={bulk.clear}
        entityLabel="peças"
        actions={[
          {
            id: "export",
            label: "Exportar CSV",
            icon: <Download className="h-3.5 w-3.5" />,
            onClick: handleExportCsv,
          },
          {
            id: "ativar",
            label: "Ativar",
            icon: <Power className="h-3.5 w-3.5" />,
            onClick: () => setConfirmToggleStatus("ativar"),
          },
          {
            id: "inativar",
            label: "Inativar",
            icon: <Power className="h-3.5 w-3.5" />,
            onClick: () => setConfirmToggleStatus("inativar"),
          },
          {
            id: "desativar",
            label: "Desativar",
            icon: <EyeOff className="h-3.5 w-3.5" />,
            onClick: () => toggleAtivoMutation.mutate({ ids: Array.from(bulk.selectedIds), ativo: false }),
          },
        ]}
      />

      <div className="section-card">
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th className="w-8">
                  <HeaderCheckbox
                    allSelected={bulk.allSelected}
                    someSelected={bulk.someSelected}
                    onToggle={bulk.toggleAll}
                  />
                </th>
                <th>Peça</th>
                <th className="hidden md:table-cell">Categoria</th>
                <th className="hidden xl:table-cell">Marca / Modelo</th>
                <th className="text-center">Qtd</th>
                <th className="hidden sm:table-cell text-center">Mín</th>
                <th className="hidden md:table-cell text-right">Custo médio</th>
                <th className="hidden md:table-cell text-right">Venda</th>
                <th className="hidden lg:table-cell text-center">Margem</th>
                <th className="hidden xl:table-cell">Local</th>
                <th className="text-center">Status</th>
                <th className="text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(item => {
                const name = getItemName(item);
                const isBaixo = item.quantidade_minima > 0 && item.quantidade <= item.quantidade_minima;
                const isSelected = bulk.isSelected(item.id);
                return (
                  <tr
                    key={item.id}
                    className={cn(
                      isBaixo && "bg-destructive/5 border-l-2 border-l-destructive",
                      isSelected && "bg-primary/5",
                    )}
                  >
                    <td>
                      <RowCheckbox
                        checked={isSelected}
                        onToggle={(e) => bulk.toggle(item.id, e)}
                      />
                    </td>
                    <td>
                      <div className="flex items-center gap-2">
                        <div>
                          <p className="text-sm font-medium">{name}</p>
                          {item.sku && <p className="text-[10px] text-muted-foreground font-mono">SKU: {item.sku}</p>}
                        </div>
                        {isBaixo && (
                          <span className="inline-flex items-center rounded-full bg-destructive/10 text-destructive text-[10px] font-semibold px-2 py-0.5 whitespace-nowrap">
                            {item.quantidade === 0 ? "Esgotado" : "Estoque baixo"}
                          </span>
                        )}
                        {item.ativo === false && (
                          <span className="inline-flex items-center rounded-full bg-muted text-muted-foreground text-[10px] font-semibold px-2 py-0.5 whitespace-nowrap">
                            Inativa
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="hidden md:table-cell text-sm text-muted-foreground">{item.estoque_categorias?.nome ?? "—"}</td>
                    <td className="hidden xl:table-cell text-sm text-muted-foreground">
                      {[item.marcas?.nome, item.modelos?.nome].filter(Boolean).join(" / ") || "—"}
                    </td>
                    <td className="text-center">
                      <span className={cn("text-sm font-medium min-w-8 text-center inline-block", isBaixo && "text-destructive font-bold")}>
                        {item.quantidade}
                      </span>
                    </td>
                    <td className="hidden sm:table-cell text-center text-sm text-muted-foreground">{item.quantidade_minima || "—"}</td>
                    <td className="hidden md:table-cell text-sm text-right">
                      {item.custo_medio && item.custo_medio > 0 ? (
                        <span className="font-mono text-xs">{fmtCurrency(item.custo_medio)}</span>
                      ) : (
                        <span className="text-xs text-muted-foreground">Sem entrada registrada</span>
                      )}
                    </td>
                    <td className="hidden md:table-cell text-sm text-right">
                      {item.preco_venda == null ? (
                        <span className="text-muted-foreground">—</span>
                      ) : (
                        <span className="font-mono text-xs">{fmtCurrency(item.preco_venda)}</span>
                      )}
                    </td>
                    <td className="hidden lg:table-cell text-center">
                      <MargemBadge custo={item.custo_medio} venda={item.preco_venda} />
                    </td>
                    <td className="hidden xl:table-cell text-sm text-muted-foreground">
                      {item.local_estoque ? (
                        <span className="inline-flex items-center gap-1"><MapPin className="h-3 w-3" />{item.local_estoque}</span>
                      ) : "—"}
                    </td>
                    <td className="text-center">
                      <span className={cn(
                        "inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium",
                        item.ativo === false ? "text-muted-foreground bg-muted" : "text-success bg-success/10 border-success/30"
                      )}>
                        {item.ativo === false ? "Inativa" : "Ativa"}
                      </span>
                    </td>
                    <td>
                      <div className="flex items-center justify-end gap-0.5">
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { setEditingItem(item); setDialogOpen(true); }}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          title={item.ativo === false ? "Reativar peça" : "Desativar peça"}
                          onClick={() => toggleAtivoMutation.mutate({ ids: [item.id], ativo: item.ativo === false })}
                        >
                          {item.ativo === false ? <Power className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr><td colSpan={12} className="text-center text-muted-foreground py-10 text-sm">Nenhuma peça encontrada</td></tr>
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

      {/* Confirmação - Ativar/Inativar em lote */}
      <AlertDialog open={confirmToggleStatus !== null} onOpenChange={(o) => !o && setConfirmToggleStatus(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirmToggleStatus === "ativar" ? "Ativar" : "Inativar"} {bulk.count} {bulk.count === 1 ? "peça" : "peças"}?
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <ul className="list-disc pl-5 text-xs text-muted-foreground space-y-0.5">
                {previewNames.map((n, i) => <li key={i}>{n}</li>)}
                {restCount > 0 && <li>...e mais {restCount}</li>}
              </ul>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                bulkToggleStatusMutation.mutate({
                  ids: Array.from(bulk.selectedIds),
                  status: confirmToggleStatus === "ativar" ? "ativo" : "inativo",
                });
                setConfirmToggleStatus(null);
              }}
            >
              Confirmar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
