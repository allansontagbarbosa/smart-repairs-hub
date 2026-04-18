import { useState, useCallback } from "react";
import { Plus, Pencil, Trash2, Search, Download, Power } from "lucide-react";
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
import { CnpjLookup, type CnpjData } from "@/components/smart-inputs/CnpjLookup";
import { CepLookup, type CepData } from "@/components/smart-inputs/CepLookup";
import { MaskedInput } from "@/components/smart-inputs/MaskedInput";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useBulkSelection } from "@/hooks/useBulkSelection";
import { BulkActionBar } from "@/components/BulkActionBar";
import { HeaderCheckbox, RowCheckbox } from "@/components/SelectableCheckbox";
import { exportToCsv } from "@/lib/export-csv";

interface Props { fornecedores: any[] }

const emptyForm = { nome: "", responsavel: "", telefone: "", whatsapp: "", email: "", cnpj_cpf: "", endereco: "", numero: "", complemento: "", bairro: "", cep: "", cidade: "", estado: "", categoria: "", prazo_medio: "", observacoes: "", ativo: true };

export function ConfigFornecedoresTab({ fornecedores }: Props) {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<any>(emptyForm);
  const [editId, setEditId] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [confirmStatus, setConfirmStatus] = useState<null | "ativar" | "inativar">(null);

  const filtered = fornecedores.filter((f) =>
    f.nome?.toLowerCase().includes(search.toLowerCase()) || f.categoria?.toLowerCase().includes(search.toLowerCase())
  );
  const bulk = useBulkSelection(filtered);
  const set = (k: string, v: any) => setForm((p: any) => ({ ...p, [k]: v }));

  const handleCnpjData = useCallback((data: CnpjData) => {
    setForm((p: any) => ({
      ...p, nome: data.nome || p.nome, endereco: data.logradouro || p.endereco,
      cidade: data.municipio || "", estado: data.uf || "",
      email: data.email || p.email, telefone: data.telefone || p.telefone,
    }));
  }, []);

  const handleCepData = useCallback((data: CepData) => {
    setForm((p: any) => ({
      ...p, endereco: data.logradouro || p.endereco, bairro: data.bairro || "",
      cidade: data.localidade || "", estado: data.uf || "",
    }));
  }, []);

  const handleSave = async () => {
    if (!form.nome) { toast.error("Nome é obrigatório"); return; }
    const { cep, cidade, estado, numero, complemento, bairro, ...rest } = form;
    const parts = [form.endereco, form.numero && `Nº ${form.numero}`, form.complemento, form.bairro, form.cidade, form.estado].filter(Boolean);
    const savePayload = { ...rest, endereco: parts.join(", ") };
    if (editId) {
      await supabase.from("fornecedores").update(savePayload).eq("id", editId);
    } else {
      await supabase.from("fornecedores").insert(savePayload);
    }
    qc.invalidateQueries({ queryKey: ["fornecedores"] });
    toast.success(editId ? "Fornecedor atualizado" : "Fornecedor cadastrado");
    setOpen(false); setForm(emptyForm); setEditId(null);
  };

  const handleEdit = (f: any) => {
    setForm({ nome: f.nome, responsavel: f.responsavel || "", telefone: f.telefone || "", whatsapp: f.whatsapp || "", email: f.email || "", cnpj_cpf: f.cnpj_cpf || "", endereco: f.endereco || "", numero: "", complemento: "", bairro: "", cep: "", cidade: "", estado: "", categoria: f.categoria || "", prazo_medio: f.prazo_medio || "", observacoes: f.observacoes || "", ativo: f.ativo });
    setEditId(f.id); setOpen(true);
  };

  const handleDelete = async (id: string) => {
    await supabase.from("fornecedores").delete().eq("id", id);
    qc.invalidateQueries({ queryKey: ["fornecedores"] });
    toast.success("Fornecedor removido");
  };

  const bulkDelete = async () => {
    const ids = Array.from(bulk.selectedIds);
    const { error } = await supabase.from("fornecedores").delete().in("id", ids);
    if (error) { toast.error("Erro ao excluir", { description: error.message }); return; }
    qc.invalidateQueries({ queryKey: ["fornecedores"] });
    toast.success(`${ids.length} ${ids.length === 1 ? "fornecedor removido" : "fornecedores removidos"}`);
    bulk.clear();
  };

  const bulkToggleStatus = async (ativo: boolean) => {
    const ids = Array.from(bulk.selectedIds);
    const { error } = await supabase.from("fornecedores").update({ ativo }).in("id", ids);
    if (error) { toast.error("Erro ao atualizar", { description: error.message }); return; }
    qc.invalidateQueries({ queryKey: ["fornecedores"] });
    toast.success(`${ids.length} ${ids.length === 1 ? "fornecedor" : "fornecedores"} ${ativo ? "ativado(s)" : "inativado(s)"}`);
    bulk.clear();
  };

  const handleExport = () => {
    const rows = bulk.count > 0 ? bulk.selectedItems : filtered;
    if (!rows.length) { toast.warning("Nenhum fornecedor para exportar"); return; }
    exportToCsv(`fornecedores-${new Date().toISOString().slice(0, 10)}.csv`, rows, [
      { header: "Nome", value: r => r.nome ?? "" },
      { header: "CNPJ/CPF", value: r => r.cnpj_cpf ?? "" },
      { header: "Responsável", value: r => r.responsavel ?? "" },
      { header: "Telefone", value: r => r.telefone ?? "" },
      { header: "WhatsApp", value: r => r.whatsapp ?? "" },
      { header: "Email", value: r => r.email ?? "" },
      { header: "Categoria", value: r => r.categoria ?? "" },
      { header: "Endereço", value: r => r.endereco ?? "" },
      { header: "Prazo médio", value: r => r.prazo_medio ?? "" },
      { header: "Status", value: r => r.ativo ? "Ativo" : "Inativo" },
    ]);
    toast.success(`${rows.length} ${rows.length === 1 ? "fornecedor exportado" : "fornecedores exportados"}`);
  };

  const previewNames = bulk.selectedItems.slice(0, 5).map((f: any) => f.nome);
  const restCount = Math.max(0, bulk.count - previewNames.length);

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-3 justify-between">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar fornecedor..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) { setForm(emptyForm); setEditId(null); } }}>
          <DialogTrigger asChild><Button size="sm"><Plus className="h-4 w-4 mr-1" />Novo Fornecedor</Button></DialogTrigger>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader><DialogTitle>{editId ? "Editar" : "Novo"} Fornecedor</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <CnpjLookup value={form.cnpj_cpf} onValueChange={(v) => set("cnpj_cpf", v)} onDataFound={handleCnpjData} />
                <div><Label>Nome *</Label><Input value={form.nome} onChange={(e) => set("nome", e.target.value)} /></div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div><Label>Responsável</Label><Input value={form.responsavel} onChange={(e) => set("responsavel", e.target.value)} /></div>
                <div><Label>Telefone</Label><MaskedInput mask="phone" value={form.telefone} onValueChange={(_, m) => set("telefone", m)} placeholder="(00) 00000-0000" /></div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div><Label>WhatsApp</Label><MaskedInput mask="phone" value={form.whatsapp} onValueChange={(_, m) => set("whatsapp", m)} placeholder="(00) 00000-0000" /></div>
                <div><Label>Email</Label><Input value={form.email} onChange={(e) => set("email", e.target.value)} /></div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                <CepLookup cep={form.cep} onCepChange={(v) => set("cep", v)} onAddressFound={handleCepData} />
                <div className="md:col-span-2"><Label>Rua / Logradouro</Label><Input value={form.endereco} onChange={(e) => set("endereco", e.target.value)} /></div>
                <div><Label>Número</Label><Input value={form.numero} onChange={(e) => set("numero", e.target.value)} placeholder="Nº" /></div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                <div><Label>Complemento</Label><Input value={form.complemento} onChange={(e) => set("complemento", e.target.value)} placeholder="Apto, Bloco, Sala..." /></div>
                <div><Label>Bairro</Label><Input value={form.bairro} onChange={(e) => set("bairro", e.target.value)} /></div>
                <div><Label>Cidade</Label><Input value={form.cidade} onChange={(e) => set("cidade", e.target.value)} /></div>
                <div><Label>Estado</Label><Input value={form.estado} onChange={(e) => set("estado", e.target.value)} /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Categoria</Label><Input value={form.categoria} onChange={(e) => set("categoria", e.target.value)} placeholder="Ex: Peças, Acessórios" /></div>
                <div><Label>Prazo médio</Label><Input value={form.prazo_medio} onChange={(e) => set("prazo_medio", e.target.value)} placeholder="Ex: 3-5 dias" /></div>
              </div>
              <div><Label>Observações</Label><Textarea value={form.observacoes} onChange={(e) => set("observacoes", e.target.value)} rows={2} /></div>
              <div className="flex items-center gap-2"><Switch checked={form.ativo} onCheckedChange={(v) => set("ativo", v)} /><Label>Ativo</Label></div>
              <Button onClick={handleSave} className="w-full">{editId ? "Salvar" : "Cadastrar"}</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <BulkActionBar
        count={bulk.count}
        onClear={bulk.clear}
        entityLabel="fornecedores"
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
                <th className="text-left p-3 font-medium">Nome</th>
                <th className="text-left p-3 font-medium hidden md:table-cell">Categoria</th>
                <th className="text-left p-3 font-medium hidden md:table-cell">Telefone</th>
                <th className="text-left p-3 font-medium">Status</th>
                <th className="p-3"></th>
              </tr></thead>
              <tbody>
                {filtered.map((f) => (
                  <tr key={f.id} className={`border-b last:border-0 hover:bg-muted/30 ${bulk.isSelected(f.id) ? "bg-primary/5" : ""}`}>
                    <td className="p-3"><RowCheckbox checked={bulk.isSelected(f.id)} onToggle={(e) => bulk.toggle(f.id, e)} /></td>
                    <td className="p-3 font-medium">{f.nome}<div className="text-xs text-muted-foreground md:hidden">{f.categoria}</div></td>
                    <td className="p-3 hidden md:table-cell text-muted-foreground">{f.categoria || "—"}</td>
                    <td className="p-3 hidden md:table-cell text-muted-foreground">{f.telefone || "—"}</td>
                    <td className="p-3"><Badge variant={f.ativo ? "default" : "secondary"}>{f.ativo ? "Ativo" : "Inativo"}</Badge></td>
                    <td className="p-3 text-right">
                      <Button variant="ghost" size="icon" onClick={() => handleEdit(f)}><Pencil className="h-3.5 w-3.5" /></Button>
                      <Button variant="ghost" size="icon" onClick={() => handleDelete(f.id)}><Trash2 className="h-3.5 w-3.5 text-destructive" /></Button>
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && <tr><td colSpan={6} className="p-6 text-center text-muted-foreground">Nenhum fornecedor cadastrado</td></tr>}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir {bulk.count} {bulk.count === 1 ? "fornecedor" : "fornecedores"}?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2">
                <p>Esta ação é permanente. Pedidos de compra vinculados podem ser afetados.</p>
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
            <AlertDialogTitle>{confirmStatus === "ativar" ? "Ativar" : "Inativar"} {bulk.count} {bulk.count === 1 ? "fornecedor" : "fornecedores"}?</AlertDialogTitle>
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
