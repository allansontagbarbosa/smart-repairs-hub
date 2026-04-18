import { useState } from "react";
import { Pencil, Trash2, Plus, Download, Power } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useBulkSelection } from "@/hooks/useBulkSelection";
import { BulkActionBar } from "@/components/BulkActionBar";
import { HeaderCheckbox, RowCheckbox } from "@/components/SelectableCheckbox";
import { exportToCsv } from "@/lib/export-csv";

interface Props { statusOrdem: any[] }

export function ConfigStatusTab({ statusOrdem }: Props) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<any>({ nome: "", cor: "#6b7280", ordem_exibicao: 0, ativo: true });
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [confirmStatus, setConfirmStatus] = useState<null | "ativar" | "inativar">(null);

  const bulk = useBulkSelection(statusOrdem);

  const reset = () => { setForm({ nome: "", cor: "#6b7280", ordem_exibicao: 0, ativo: true }); setEditId(null); };

  const handleSave = async () => {
    if (!form.nome) { toast.error("Nome é obrigatório"); return; }
    const payload = { ...form, ordem_exibicao: Number(form.ordem_exibicao) || 0 };
    if (editId) { await supabase.from("status_ordem_servico").update(payload).eq("id", editId); }
    else { await supabase.from("status_ordem_servico").insert(payload); }
    qc.invalidateQueries({ queryKey: ["status_ordem_servico"] });
    toast.success("Salvo"); setOpen(false); reset();
  };

  const handleEdit = (s: any) => {
    setForm({ nome: s.nome, cor: s.cor || "#6b7280", ordem_exibicao: s.ordem_exibicao, ativo: s.ativo });
    setEditId(s.id); setOpen(true);
  };

  const handleDelete = async (id: string) => {
    await supabase.from("status_ordem_servico").delete().eq("id", id);
    qc.invalidateQueries({ queryKey: ["status_ordem_servico"] });
    toast.success("Removido");
  };

  const bulkDelete = async () => {
    const ids = Array.from(bulk.selectedIds);
    const { error } = await supabase.from("status_ordem_servico").delete().in("id", ids);
    if (error) { toast.error("Erro ao excluir", { description: error.message }); return; }
    qc.invalidateQueries({ queryKey: ["status_ordem_servico"] });
    toast.success(`${ids.length} status removido(s)`);
    bulk.clear();
  };

  const bulkToggleStatus = async (ativo: boolean) => {
    const ids = Array.from(bulk.selectedIds);
    const { error } = await supabase.from("status_ordem_servico").update({ ativo }).in("id", ids);
    if (error) { toast.error("Erro ao atualizar", { description: error.message }); return; }
    qc.invalidateQueries({ queryKey: ["status_ordem_servico"] });
    toast.success(`${ids.length} status ${ativo ? "ativado(s)" : "inativado(s)"}`);
    bulk.clear();
  };

  const handleExport = () => {
    const rows = bulk.count > 0 ? bulk.selectedItems : statusOrdem;
    if (!rows.length) { toast.warning("Nenhum status para exportar"); return; }
    exportToCsv(`status-${new Date().toISOString().slice(0, 10)}.csv`, rows, [
      { header: "Nome", value: r => r.nome ?? "" },
      { header: "Cor", value: r => r.cor ?? "" },
      { header: "Ordem", value: r => r.ordem_exibicao ?? 0 },
      { header: "Ativo", value: r => r.ativo ? "Sim" : "Não" },
    ]);
    toast.success(`${rows.length} status exportado(s)`);
  };

  const previewNames = bulk.selectedItems.slice(0, 5).map((s: any) => s.nome);
  const restCount = Math.max(0, bulk.count - previewNames.length);

  return (
    <div className="space-y-4">
      <BulkActionBar
        count={bulk.count}
        onClear={bulk.clear}
        entityLabel="status"
        actions={[
          { id: "export", label: "Exportar CSV", icon: <Download className="h-3.5 w-3.5" />, onClick: handleExport },
          { id: "ativar", label: "Ativar", icon: <Power className="h-3.5 w-3.5" />, onClick: () => setConfirmStatus("ativar") },
          { id: "inativar", label: "Inativar", icon: <Power className="h-3.5 w-3.5" />, onClick: () => setConfirmStatus("inativar") },
          { id: "delete", label: "Excluir", icon: <Trash2 className="h-3.5 w-3.5" />, variant: "destructive", onClick: () => setConfirmDelete(true) },
        ]}
      />

      <Card>
        <CardHeader className="pb-3 flex flex-row items-center justify-between">
          <CardTitle className="text-sm font-medium">Status da Ordem de Serviço</CardTitle>
          <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) reset(); }}>
            <DialogTrigger asChild><Button size="sm" variant="outline"><Plus className="h-3.5 w-3.5 mr-1" />Novo Status</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>{editId ? "Editar" : "Novo"} Status</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div><Label>Nome *</Label><Input value={form.nome} onChange={(e) => setForm((p: any) => ({ ...p, nome: e.target.value }))} /></div>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>Cor</Label><Input type="color" value={form.cor} onChange={(e) => setForm((p: any) => ({ ...p, cor: e.target.value }))} className="h-10" /></div>
                  <div><Label>Ordem de exibição</Label><Input type="number" value={form.ordem_exibicao} onChange={(e) => setForm((p: any) => ({ ...p, ordem_exibicao: e.target.value }))} /></div>
                </div>
                <div className="flex items-center gap-2"><Switch checked={form.ativo} onCheckedChange={(v) => setForm((p: any) => ({ ...p, ativo: v }))} /><Label>Ativo</Label></div>
                <Button onClick={handleSave} className="w-full">{editId ? "Salvar" : "Cadastrar"}</Button>
              </div>
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent className="p-0">
          {statusOrdem.length > 0 && (
            <div className="px-4 py-2 border-b bg-muted/30 flex items-center gap-3">
              <HeaderCheckbox allSelected={bulk.allSelected} someSelected={bulk.someSelected} onToggle={bulk.toggleAll} />
              <span className="text-xs text-muted-foreground">Selecionar todos</span>
            </div>
          )}
          <div className="divide-y">
            {statusOrdem.map((s) => (
              <div key={s.id} className={`flex items-center justify-between px-4 py-3 ${bulk.isSelected(s.id) ? "bg-primary/5" : ""}`}>
                <div className="flex items-center gap-3">
                  <RowCheckbox checked={bulk.isSelected(s.id)} onToggle={(e) => bulk.toggle(s.id, e)} />
                  <div className="h-4 w-4 rounded-full border" style={{ backgroundColor: s.cor || "#6b7280" }} />
                  <span className="text-sm font-medium">{s.nome}</span>
                  <span className="text-xs text-muted-foreground">#{s.ordem_exibicao}</span>
                  {!s.ativo && <Badge variant="secondary" className="text-[10px]">Inativo</Badge>}
                </div>
                <div className="flex gap-1">
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleEdit(s)}><Pencil className="h-3 w-3" /></Button>
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleDelete(s.id)}><Trash2 className="h-3 w-3 text-destructive" /></Button>
                </div>
              </div>
            ))}
            {statusOrdem.length === 0 && <div className="p-4 text-center text-sm text-muted-foreground">Nenhum status cadastrado</div>}
          </div>
        </CardContent>
      </Card>

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir {bulk.count} status?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2">
                <p>OS que usam estes status podem ficar sem cor/rótulo válido.</p>
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
            <AlertDialogTitle>{confirmStatus === "ativar" ? "Ativar" : "Inativar"} {bulk.count} status?</AlertDialogTitle>
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
