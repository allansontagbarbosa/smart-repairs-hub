import { useState, useCallback } from "react";
import { Plus, Pencil, Trash2, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { CnpjLookup, type CnpjData } from "@/components/smart-inputs/CnpjLookup";
import { CepLookup, type CepData } from "@/components/smart-inputs/CepLookup";
import { MaskedInput } from "@/components/smart-inputs/MaskedInput";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

interface Props { fornecedores: any[] }

const emptyForm = { nome: "", responsavel: "", telefone: "", whatsapp: "", email: "", cnpj_cpf: "", endereco: "", numero: "", complemento: "", bairro: "", cep: "", cidade: "", estado: "", categoria: "", prazo_medio: "", observacoes: "", ativo: true };

export function ConfigFornecedoresTab({ fornecedores }: Props) {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<any>(emptyForm);
  const [editId, setEditId] = useState<string | null>(null);

  const filtered = fornecedores.filter((f) =>
    f.nome?.toLowerCase().includes(search.toLowerCase()) || f.categoria?.toLowerCase().includes(search.toLowerCase())
  );
  const set = (k: string, v: any) => setForm((p: any) => ({ ...p, [k]: v }));

  const handleCnpjData = useCallback((data: CnpjData) => {
    setForm((p: any) => ({
      ...p,
      nome: data.nome || p.nome,
      endereco: data.logradouro || p.endereco,
      cidade: data.municipio || "",
      estado: data.uf || "",
      email: data.email || p.email,
      telefone: data.telefone || p.telefone,
    }));
  }, []);

  const handleCepData = useCallback((data: CepData) => {
    setForm((p: any) => ({
      ...p,
      endereco: data.logradouro || p.endereco,
      bairro: data.bairro || "",
      cidade: data.localidade || "",
      estado: data.uf || "",
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

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b bg-muted/50"><th className="text-left p-3 font-medium">Nome</th><th className="text-left p-3 font-medium hidden md:table-cell">Categoria</th><th className="text-left p-3 font-medium hidden md:table-cell">Telefone</th><th className="text-left p-3 font-medium">Status</th><th className="p-3"></th></tr></thead>
              <tbody>
                {filtered.map((f) => (
                  <tr key={f.id} className="border-b last:border-0 hover:bg-muted/30">
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
                {filtered.length === 0 && <tr><td colSpan={5} className="p-6 text-center text-muted-foreground">Nenhum fornecedor cadastrado</td></tr>}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
