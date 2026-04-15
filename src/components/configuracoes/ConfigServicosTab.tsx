import { useState } from "react";
import { Plus, Pencil, Trash2, Search, Sparkles } from "lucide-react";
import { ImportIADialog } from "./ImportIADialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CurrencyInput } from "@/components/smart-inputs/CurrencyInput";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

interface Props { tiposServico: any[] }

const emptyForm = { nome: "", descricao: "", valor_padrao: null as number | null, comissao_padrao: null as number | null, ativo: true, tipo_comissao: "fixa" };

export function ConfigServicosTab({ tiposServico }: Props) {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<any>(emptyForm);
  const [editId, setEditId] = useState<string | null>(null);
  const [importOpen, setImportOpen] = useState(false);

  const filtered = tiposServico.filter((s) => s.nome?.toLowerCase().includes(search.toLowerCase()));
  const set = (k: string, v: any) => setForm((p: any) => ({ ...p, [k]: v }));

  const handleSave = async () => {
    if (!form.nome) { toast.error("Nome é obrigatório"); return; }
    const payload = {
      nome: form.nome,
      descricao: form.descricao || null,
      valor_padrao: Number(form.valor_padrao) || 0,
      comissao_padrao: Number(form.comissao_padrao) || 0,
      ativo: form.ativo,
    };
    if (editId) {
      await supabase.from("tipos_servico").update(payload).eq("id", editId);
    } else {
      await supabase.from("tipos_servico").insert(payload);
    }
    qc.invalidateQueries({ queryKey: ["tipos_servico"] });
    toast.success(editId ? "Serviço atualizado" : "Serviço cadastrado");
    setOpen(false); setForm(emptyForm); setEditId(null);
  };

  const handleEdit = (s: any) => {
    setForm({
      nome: s.nome,
      descricao: s.descricao || "",
      valor_padrao: s.valor_padrao || null,
      comissao_padrao: s.comissao_padrao || null,
      ativo: s.ativo,
      tipo_comissao: "fixa",
    });
    setEditId(s.id); setOpen(true);
  };

  const handleDelete = async (id: string) => {
    await supabase.from("tipos_servico").delete().eq("id", id);
    qc.invalidateQueries({ queryKey: ["tipos_servico"] });
    toast.success("Serviço removido");
  };

  const fmt = (v: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-3 justify-between">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar serviço..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => setImportOpen(true)}>
            <Sparkles className="h-4 w-4 mr-1" />Importar via IA
          </Button>
          <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) { setForm(emptyForm); setEditId(null); } }}>
          <DialogTrigger asChild><Button size="sm"><Plus className="h-4 w-4 mr-1" />Novo Serviço</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>{editId ? "Editar" : "Novo"} Serviço</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div><Label>Nome *</Label><Input value={form.nome} onChange={(e) => set("nome", e.target.value)} /></div>
              <div><Label>Descrição</Label><Textarea value={form.descricao} onChange={(e) => set("descricao", e.target.value)} rows={2} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Valor padrão (R$)</Label><CurrencyInput value={form.valor_padrao} onValueChange={(v) => set("valor_padrao", v)} /></div>
                <div>
                  <Label>Tipo de comissão</Label>
                  <Select value={form.tipo_comissao} onValueChange={(v) => set("tipo_comissao", v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="fixa">Fixo (R$)</SelectItem>
                      <SelectItem value="percentual">Percentual (%)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <Label>Comissão padrão ({form.tipo_comissao === "percentual" ? "%" : "R$"})</Label>
                {form.tipo_comissao === "percentual" ? (
                  <Input type="number" step="0.5" min="0" max="100" value={form.comissao_padrao ?? ""} onChange={(e) => set("comissao_padrao", e.target.value)} />
                ) : (
                  <CurrencyInput value={form.comissao_padrao} onValueChange={(v) => set("comissao_padrao", v)} />
                )}
              </div>
              <div className="flex items-center gap-2"><Switch checked={form.ativo} onCheckedChange={(v) => set("ativo", v)} /><Label>Ativo</Label></div>
              <Button onClick={handleSave} className="w-full">{editId ? "Salvar" : "Cadastrar"}</Button>
            </div>
          </DialogContent>
        </Dialog>
        </div>
      </div>
      <ImportIADialog open={importOpen} onOpenChange={setImportOpen} />

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b bg-muted/50"><th className="text-left p-3 font-medium">Serviço</th><th className="text-left p-3 font-medium hidden md:table-cell">Valor</th><th className="text-left p-3 font-medium hidden md:table-cell">Comissão</th><th className="text-left p-3 font-medium">Status</th><th className="p-3"></th></tr></thead>
              <tbody>
                {filtered.map((s) => (
                  <tr key={s.id} className="border-b last:border-0 hover:bg-muted/30">
                    <td className="p-3 font-medium">{s.nome}<div className="text-xs text-muted-foreground">{s.descricao}</div></td>
                    <td className="p-3 hidden md:table-cell">{fmt(s.valor_padrao || 0)}</td>
                    <td className="p-3 hidden md:table-cell">{fmt(s.comissao_padrao || 0)}</td>
                    <td className="p-3"><Badge variant={s.ativo ? "default" : "secondary"}>{s.ativo ? "Ativo" : "Inativo"}</Badge></td>
                    <td className="p-3 text-right">
                      <Button variant="ghost" size="icon" onClick={() => handleEdit(s)}><Pencil className="h-3.5 w-3.5" /></Button>
                      <Button variant="ghost" size="icon" onClick={() => handleDelete(s.id)}><Trash2 className="h-3.5 w-3.5 text-destructive" /></Button>
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && <tr><td colSpan={5} className="p-6 text-center text-muted-foreground">Nenhum serviço cadastrado</td></tr>}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
