import { useState } from "react";
import { Plus, Pencil, Trash2, Search, Sparkles, Download, Power, Info } from "lucide-react";
import { ImportIADialog } from "./ImportIADialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useBulkSelection } from "@/hooks/useBulkSelection";
import { BulkActionBar } from "@/components/BulkActionBar";
import { HeaderCheckbox, RowCheckbox } from "@/components/SelectableCheckbox";
import { exportToCsv } from "@/lib/export-csv";
import { PecaFormModal } from "@/components/pecas/PecaFormModal";

interface Props {
  produtosBase: any[];
  marcas: any[];
  modelos: any[];
  categorias: any[];
}

export function ConfigProdutosTab({ produtosBase }: Props) {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [confirmStatus, setConfirmStatus] = useState<null | "ativar" | "inativar">(null);

  const filtered = produtosBase.filter(
    (p) => p.nome?.toLowerCase().includes(search.toLowerCase()) || p.sku?.toLowerCase().includes(search.toLowerCase())
  );
  const bulk = useBulkSelection(filtered);

  const openCreate = () => { setEditId(null); setModalOpen(true); };
  const openEdit = (p: any) => { setEditId(p.id); setModalOpen(true); };

  const handleDelete = async (id: string) => {
    await supabase.from("produtos_base").delete().eq("id", id);
    qc.invalidateQueries({ queryKey: ["produtos_base"] });
    toast.success("Peça removida");
  };

  const bulkDelete = async () => {
    const ids = Array.from(bulk.selectedIds);
    const { error } = await supabase.from("produtos_base").delete().in("id", ids);
    if (error) { toast.error("Erro ao excluir", { description: error.message }); return; }
    qc.invalidateQueries({ queryKey: ["produtos_base"] });
    toast.success(`${ids.length} ${ids.length === 1 ? "peça removida" : "peças removidas"}`);
    bulk.clear();
  };

  const bulkToggleStatus = async (ativo: boolean) => {
    const ids = Array.from(bulk.selectedIds);
    const { error } = await supabase.from("produtos_base").update({ ativo }).in("id", ids);
    if (error) { toast.error("Erro ao atualizar", { description: error.message }); return; }
    qc.invalidateQueries({ queryKey: ["produtos_base"] });
    toast.success(`${ids.length} ${ids.length === 1 ? "peça" : "peças"} ${ativo ? "ativada(s)" : "inativada(s)"}`);
    bulk.clear();
  };

  const handleExport = () => {
    const rows = bulk.count > 0 ? bulk.selectedItems : filtered;
    if (!rows.length) { toast.warning("Nenhuma peça para exportar"); return; }
    exportToCsv(`pecas-catalogo-${new Date().toISOString().slice(0, 10)}.csv`, rows, [
      { header: "Nome", value: r => r.nome ?? "" },
      { header: "SKU", value: r => r.sku ?? "" },
      { header: "Marca", value: r => (r as any).marcas?.nome ?? "" },
      { header: "Modelo", value: r => (r as any).modelos?.nome ?? "" },
      { header: "Categoria", value: r => (r as any).estoque_categorias?.nome ?? "" },
      { header: "Custo ref.", value: r => r.custo ?? 0 },
      { header: "Preço padrão", value: r => r.preco_padrao ?? 0 },
      { header: "Preço especial", value: r => r.preco_especial ?? "" },
      { header: "Status", value: r => r.ativo ? "Ativo" : "Inativo" },
    ]);
    toast.success(`${rows.length} ${rows.length === 1 ? "peça exportada" : "peças exportadas"}`);
  };

  const fmt = (v: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);
  const previewNames = bulk.selectedItems.slice(0, 5).map((p: any) => p.nome);
  const restCount = Math.max(0, bulk.count - previewNames.length);

  return (
    <div className="space-y-4">
      {/* Banner tip — desambigua catálogo vs. estoque */}
      <div className="rounded-lg border border-primary/20 bg-primary/5 px-3 py-2.5 flex items-start gap-2 text-xs">
        <Info className="h-4 w-4 text-primary shrink-0 mt-0.5" />
        <div>
          <p className="font-medium text-foreground">Cadastro de peças (catálogo)</p>
          <p className="text-muted-foreground">
            Aqui vive <strong>o que cada peça é</strong> (nome, SKU, custo de referência). A quantidade em estoque não aparece aqui — ela vem das compras.
          </p>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 justify-between">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome ou SKU..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => setImportOpen(true)}>
            <Sparkles className="h-4 w-4 mr-1" />Importar via IA
          </Button>
          <Button size="sm" variant="outline" onClick={handleExport}>
            <Download className="h-4 w-4 mr-1" />Exportar
          </Button>
          <Button size="sm" onClick={openCreate}>
            <Plus className="h-4 w-4 mr-1" />Nova peça
          </Button>
        </div>
      </div>

      <ImportIADialog open={importOpen} onOpenChange={setImportOpen} />
      <PecaFormModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        pecaId={editId}
      />

      <BulkActionBar
        count={bulk.count}
        onClear={bulk.clear}
        entityLabel="peças"
        actions={[
          { id: "export", label: "Exportar CSV", icon: <Download className="h-3.5 w-3.5" />, onClick: handleExport },
          { id: "ativar", label: "Ativar", icon: <Power className="h-3.5 w-3.5" />, onClick: () => setConfirmStatus("ativar") },
          { id: "inativar", label: "Inativar", icon: <Power className="h-3.5 w-3.5" />, onClick: () => setConfirmStatus("inativar") },
          { id: "delete", label: "Excluir", icon: <Trash2 className="h-3.5 w-3.5" />, variant: "destructive", onClick: () => setConfirmDelete(true) },
        ]}
      />

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="w-8 p-3">
                    <HeaderCheckbox allSelected={bulk.allSelected} someSelected={bulk.someSelected} onToggle={bulk.toggleAll} />
                  </th>
                  <th className="text-left p-3 font-medium">Peça</th>
                  <th className="text-left p-3 font-medium hidden md:table-cell">SKU</th>
                  <th className="text-left p-3 font-medium hidden md:table-cell">Categoria</th>
                  <th className="text-left p-3 font-medium hidden md:table-cell">Custo ref.</th>
                  <th className="text-left p-3 font-medium hidden md:table-cell">Preço</th>
                  <th className="text-left p-3 font-medium">Status</th>
                  <th className="p-3"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((p) => (
                  <tr
                    key={p.id}
                    className={`border-b last:border-0 hover:bg-muted/30 cursor-pointer ${bulk.isSelected(p.id) ? "bg-primary/5" : ""}`}
                    onClick={() => openEdit(p)}
                  >
                    <td className="p-3" onClick={(e) => e.stopPropagation()}>
                      <RowCheckbox checked={bulk.isSelected(p.id)} onToggle={(e) => bulk.toggle(p.id, e)} />
                    </td>
                    <td className="p-3 font-medium">
                      {p.nome}
                      <div className="text-xs text-muted-foreground">
                        {(p as any).marcas?.nome} {(p as any).modelos?.nome}
                      </div>
                    </td>
                    <td className="p-3 hidden md:table-cell text-muted-foreground">{p.sku || "—"}</td>
                    <td className="p-3 hidden md:table-cell text-muted-foreground">{(p as any).estoque_categorias?.nome || "—"}</td>
                    <td className="p-3 hidden md:table-cell">{fmt(p.custo || 0)}</td>
                    <td className="p-3 hidden md:table-cell">{fmt(p.preco_padrao || 0)}</td>
                    <td className="p-3">
                      <Badge variant={p.ativo ? "default" : "secondary"}>
                        {p.ativo ? "Ativo" : "Inativo"}
                      </Badge>
                    </td>
                    <td className="p-3 text-right" onClick={(e) => e.stopPropagation()}>
                      <Button variant="ghost" size="icon" onClick={() => openEdit(p)}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => handleDelete(p.id)}>
                        <Trash2 className="h-3.5 w-3.5 text-destructive" />
                      </Button>
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={8} className="p-10 text-center">
                      <div className="space-y-2">
                        <p className="text-muted-foreground text-sm">Nenhuma peça cadastrada no catálogo.</p>
                        <Button size="sm" onClick={openCreate}>
                          <Plus className="h-4 w-4 mr-1" /> Cadastrar primeira peça
                        </Button>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir {bulk.count} {bulk.count === 1 ? "peça" : "peças"}?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2">
                <p>Esta ação é permanente e não pode ser desfeita.</p>
                <ul className="list-disc pl-5 text-xs text-muted-foreground space-y-0.5">
                  {previewNames.map((n, i) => <li key={i}>{n}</li>)}
                  {restCount > 0 && <li>...e mais {restCount}</li>}
                </ul>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={bulkDelete}>
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={confirmStatus !== null} onOpenChange={(o) => !o && setConfirmStatus(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirmStatus === "ativar" ? "Ativar" : "Inativar"} {bulk.count} {bulk.count === 1 ? "peça" : "peças"}?
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
            <AlertDialogAction onClick={() => { bulkToggleStatus(confirmStatus === "ativar"); setConfirmStatus(null); }}>
              Confirmar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
