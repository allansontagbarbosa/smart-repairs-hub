import { useState } from "react";
import { Plus, Pencil, Trash2, Search, Sparkles, Download, Power } from "lucide-react";
import { ImportIADialog } from "./ImportIADialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { CreatableSelect } from "@/components/smart-inputs/CreatableSelect";
import { CurrencyInput } from "@/components/smart-inputs/CurrencyInput";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useBulkSelection } from "@/hooks/useBulkSelection";
import { BulkActionBar } from "@/components/BulkActionBar";
import { HeaderCheckbox, RowCheckbox } from "@/components/SelectableCheckbox";
import { exportToCsv } from "@/lib/export-csv";

interface Props {
  produtosBase: any[];
  marcas: any[];
  modelos: any[];
  categorias: any[];
}

const emptyForm = { nome: "", categoria_id: "", marca_id: "", modelo_id: "", descricao: "", custo: null as number | null, preco_padrao: null as number | null, preco_especial: null as number | null, sku: "", ativo: true };

export function ConfigProdutosTab({ produtosBase, marcas, modelos, categorias }: Props) {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<any>(emptyForm);
  const [editId, setEditId] = useState<string | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [confirmStatus, setConfirmStatus] = useState<null | "ativar" | "inativar">(null);

  const filtered = produtosBase.filter((p) => p.nome?.toLowerCase().includes(search.toLowerCase()) || p.sku?.toLowerCase().includes(search.toLowerCase()));
  const bulk = useBulkSelection(filtered);
  const set = (k: string, v: any) => setForm((p: any) => ({ ...p, [k]: v }));

  const handleSave = async () => {
    if (!form.nome) { toast.error("Nome é obrigatório"); return; }
    const payload = {
      nome: form.nome, descricao: form.descricao, sku: form.sku || null, ativo: form.ativo,
      categoria_id: form.categoria_id || null, marca_id: form.marca_id || null, modelo_id: form.modelo_id || null,
      custo: Number(form.custo) || 0, preco_padrao: Number(form.preco_padrao) || 0,
      preco_especial: form.preco_especial ? Number(form.preco_especial) : null,
    };
    if (editId) {
      await supabase.from("produtos_base").update(payload).eq("id", editId);
    } else {
      await supabase.from("produtos_base").insert(payload);
    }
    qc.invalidateQueries({ queryKey: ["produtos_base"] });
    toast.success(editId ? "Peça atualizada" : "Peça cadastrada");
    setOpen(false); setForm(emptyForm); setEditId(null);
  };

  const handleEdit = (p: any) => {
    setForm({ nome: p.nome, categoria_id: p.categoria_id || "", marca_id: p.marca_id || "", modelo_id: p.modelo_id || "", descricao: p.descricao || "", custo: p.custo || null, preco_padrao: p.preco_padrao || null, preco_especial: p.preco_especial, sku: p.sku || "", ativo: p.ativo });
    setEditId(p.id); setOpen(true);
  };

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
    exportToCsv(`produtos-${new Date().toISOString().slice(0, 10)}.csv`, rows, [
      { header: "Nome", value: r => r.nome ?? "" },
      { header: "SKU", value: r => r.sku ?? "" },
      { header: "Marca", value: r => (r as any).marcas?.nome ?? "" },
      { header: "Modelo", value: r => (r as any).modelos?.nome ?? "" },
      { header: "Custo", value: r => r.custo ?? 0 },
      { header: "Preço padrão", value: r => r.preco_padrao ?? 0 },
      { header: "Preço especial", value: r => r.preco_especial ?? "" },
      { header: "Status", value: r => r.ativo ? "Ativo" : "Inativo" },
    ]);
    toast.success(`${rows.length} ${rows.length === 1 ? "peça exportada" : "peças exportadas"}`);
  };

  const createCategoria = async (nome: string) => {
    const { data, error } = await supabase.from("estoque_categorias").insert({ nome }).select("id").single();
    if (error) { toast.error("Erro ao criar categoria"); return null; }
    qc.invalidateQueries({ queryKey: ["estoque_categorias"] });
    toast.success("Categoria criada!");
    return data.id;
  };
  const createMarca = async (nome: string) => {
    const { data, error } = await supabase.from("marcas").insert({ nome }).select("id").single();
    if (error) { toast.error("Erro ao criar marca"); return null; }
    qc.invalidateQueries({ queryKey: ["marcas"] });
    toast.success("Marca criada!");
    return data.id;
  };

  const fmt = (v: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);
  const previewNames = bulk.selectedItems.slice(0, 5).map((p: any) => p.nome);
  const restCount = Math.max(0, bulk.count - previewNames.length);

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-3 justify-between">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar por nome ou SKU..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => setImportOpen(true)}>
            <Sparkles className="h-4 w-4 mr-1" />Importar via IA
          </Button>
          <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) { setForm(emptyForm); setEditId(null); } }}>
            <DialogTrigger asChild><Button size="sm"><Plus className="h-4 w-4 mr-1" />Nova Peça</Button></DialogTrigger>
            <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
              <DialogHeader><DialogTitle>{editId ? "Editar" : "Nova"} Peça</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div><Label>Nome *</Label><Input value={form.nome} onChange={(e) => set("nome", e.target.value)} /></div>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>SKU</Label><Input value={form.sku} onChange={(e) => set("sku", e.target.value)} /></div>
                  <CreatableSelect label="Categoria" value={form.categoria_id} onValueChange={(v) => set("categoria_id", v)} options={categorias} onCreateNew={createCategoria} entityName="categoria" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <CreatableSelect label="Marca" value={form.marca_id} onValueChange={(v) => set("marca_id", v)} options={marcas} onCreateNew={createMarca} entityName="marca" />
                  <CreatableSelect label="Modelo" value={form.modelo_id} onValueChange={(v) => set("modelo_id", v)} options={modelos.filter((m: any) => !form.marca_id || m.marca_id === form.marca_id)} onCreateNew={async (nome) => {
                    if (!form.marca_id) { toast.error("Selecione uma marca primeiro"); return null; }
                    const { data, error } = await supabase.from("modelos").insert({ nome, marca_id: form.marca_id }).select("id").single();
                    if (error) { toast.error("Erro ao criar modelo"); return null; }
                    qc.invalidateQueries({ queryKey: ["modelos"] });
                    toast.success("Modelo criado!");
                    return data.id;
                  }} entityName="modelo" />
                </div>
                <div><Label>Descrição</Label><Textarea value={form.descricao} onChange={(e) => set("descricao", e.target.value)} rows={2} /></div>
                <div className="grid grid-cols-3 gap-3">
                  <div><Label>Custo</Label><CurrencyInput value={form.custo} onValueChange={(v) => set("custo", v)} /></div>
                  <div><Label>Preço padrão</Label><CurrencyInput value={form.preco_padrao} onValueChange={(v) => set("preco_padrao", v)} /></div>
                  <div><Label>Preço especial</Label><CurrencyInput value={form.preco_especial} onValueChange={(v) => set("preco_especial", v)} /></div>
                </div>
                <div className="flex items-center gap-2"><Switch checked={form.ativo} onCheckedChange={(v) => set("ativo", v)} /><Label>Ativo</Label></div>
                <Button onClick={handleSave} className="w-full">{editId ? "Salvar" : "Cadastrar"}</Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>
      <ImportIADialog open={importOpen} onOpenChange={setImportOpen} />

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
              <thead><tr className="border-b bg-muted/50">
                <th className="w-8 p-3"><HeaderCheckbox allSelected={bulk.allSelected} someSelected={bulk.someSelected} onToggle={bulk.toggleAll} /></th>
                <th className="text-left p-3 font-medium">Peça</th>
                <th className="text-left p-3 font-medium hidden md:table-cell">SKU</th>
                <th className="text-left p-3 font-medium hidden md:table-cell">Custo</th>
                <th className="text-left p-3 font-medium hidden md:table-cell">Preço</th>
                <th className="text-left p-3 font-medium">Status</th>
                <th className="p-3"></th>
              </tr></thead>
              <tbody>
                {filtered.map((p) => (
                  <tr key={p.id} className={`border-b last:border-0 hover:bg-muted/30 ${bulk.isSelected(p.id) ? "bg-primary/5" : ""}`}>
                    <td className="p-3"><RowCheckbox checked={bulk.isSelected(p.id)} onToggle={(e) => bulk.toggle(p.id, e)} /></td>
                    <td className="p-3 font-medium">{p.nome}<div className="text-xs text-muted-foreground">{(p as any).marcas?.nome} {(p as any).modelos?.nome}</div></td>
                    <td className="p-3 hidden md:table-cell text-muted-foreground">{p.sku || "—"}</td>
                    <td className="p-3 hidden md:table-cell">{fmt(p.custo || 0)}</td>
                    <td className="p-3 hidden md:table-cell">{fmt(p.preco_padrao || 0)}</td>
                    <td className="p-3"><Badge variant={p.ativo ? "default" : "secondary"}>{p.ativo ? "Ativo" : "Inativo"}</Badge></td>
                    <td className="p-3 text-right">
                      <Button variant="ghost" size="icon" onClick={() => handleEdit(p)}><Pencil className="h-3.5 w-3.5" /></Button>
                      <Button variant="ghost" size="icon" onClick={() => handleDelete(p.id)}><Trash2 className="h-3.5 w-3.5 text-destructive" /></Button>
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && <tr><td colSpan={7} className="p-6 text-center text-muted-foreground">Nenhuma peça cadastrada</td></tr>}
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
            <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={bulkDelete}>Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={confirmStatus !== null} onOpenChange={(o) => !o && setConfirmStatus(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{confirmStatus === "ativar" ? "Ativar" : "Inativar"} {bulk.count} {bulk.count === 1 ? "peça" : "peças"}?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <ul className="list-disc pl-5 text-xs text-muted-foreground space-y-0.5">
                {previewNames.map((n, i) => <li key={i}>{n}</li>)}
                {restCount > 0 && <li>...e mais {restCount}</li>}
              </ul>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => { bulkToggleStatus(confirmStatus === "ativar"); setConfirmStatus(null); }}>Confirmar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
