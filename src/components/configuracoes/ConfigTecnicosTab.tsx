import { useState } from "react";
import { Plus, Pencil, Trash2, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

interface Props { funcionarios: any[] }

export function ConfigTecnicosTab({ funcionarios }: Props) {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<any>({ nome: "", telefone: "", email: "", funcao: "", cargo: "", tipo_comissao: "fixa", valor_comissao: 0, ativo: true });

  const filtered = funcionarios.filter((f) => f.nome?.toLowerCase().includes(search.toLowerCase()));
  const set = (k: string, v: any) => setForm((p: any) => ({ ...p, [k]: v }));

  const handleSave = async () => {
    if (!form.nome) { toast.error("Nome é obrigatório"); return; }
    const payload = { ...form, valor_comissao: Number(form.valor_comissao) || 0 };
    if (editId) {
      await supabase.from("funcionarios").update(payload).eq("id", editId);
    } else {
      await supabase.from("funcionarios").insert(payload);
    }
    qc.invalidateQueries({ queryKey: ["funcionarios"] });
    toast.success(editId ? "Técnico atualizado" : "Técnico cadastrado");
    setOpen(false); setEditId(null);
    setForm({ nome: "", telefone: "", email: "", funcao: "", cargo: "", tipo_comissao: "fixa", valor_comissao: 0, ativo: true });
  };

  const handleEdit = (f: any) => {
    setForm({ nome: f.nome, telefone: f.telefone || "", email: f.email || "", funcao: f.funcao || "", cargo: f.cargo || "", tipo_comissao: f.tipo_comissao, valor_comissao: f.valor_comissao, ativo: f.ativo });
    setEditId(f.id); setOpen(true);
  };

  const fmt = (v: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-3 justify-between">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar técnico..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) { setEditId(null); } }}>
          <DialogTrigger asChild><Button size="sm"><Plus className="h-4 w-4 mr-1" />Novo Técnico</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>{editId ? "Editar" : "Novo"} Técnico</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Nome *</Label><Input value={form.nome} onChange={(e) => set("nome", e.target.value)} /></div>
                <div><Label>Cargo</Label><Input value={form.cargo} onChange={(e) => set("cargo", e.target.value)} placeholder="Ex: Técnico Sênior" /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Telefone</Label><Input value={form.telefone} onChange={(e) => set("telefone", e.target.value)} /></div>
                <div><Label>Email</Label><Input value={form.email} onChange={(e) => set("email", e.target.value)} /></div>
              </div>
              <div><Label>Especialidade</Label><Input value={form.funcao} onChange={(e) => set("funcao", e.target.value)} placeholder="Ex: Telas, Placas" /></div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Tipo de comissão</Label>
                  <Select value={form.tipo_comissao} onValueChange={(v) => set("tipo_comissao", v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="fixa">Fixa (R$)</SelectItem>
                      <SelectItem value="percentual">Percentual (%)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div><Label>{form.tipo_comissao === "percentual" ? "Percentual (%)" : "Valor fixo (R$)"}</Label><Input type="number" value={form.valor_comissao} onChange={(e) => set("valor_comissao", e.target.value)} /></div>
              </div>
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
              <thead><tr className="border-b bg-muted/50"><th className="text-left p-3 font-medium">Nome</th><th className="text-left p-3 font-medium hidden md:table-cell">Especialidade</th><th className="text-left p-3 font-medium hidden md:table-cell">Comissão</th><th className="text-left p-3 font-medium">Status</th><th className="p-3"></th></tr></thead>
              <tbody>
                {filtered.map((f) => (
                  <tr key={f.id} className="border-b last:border-0 hover:bg-muted/30">
                    <td className="p-3 font-medium">{f.nome}<div className="text-xs text-muted-foreground">{f.cargo}</div></td>
                    <td className="p-3 hidden md:table-cell text-muted-foreground">{f.funcao || "—"}</td>
                    <td className="p-3 hidden md:table-cell">{f.tipo_comissao === "percentual" ? `${f.valor_comissao}%` : fmt(f.valor_comissao)}</td>
                    <td className="p-3"><Badge variant={f.ativo ? "default" : "secondary"}>{f.ativo ? "Ativo" : "Inativo"}</Badge></td>
                    <td className="p-3 text-right"><Button variant="ghost" size="icon" onClick={() => handleEdit(f)}><Pencil className="h-3.5 w-3.5" /></Button></td>
                  </tr>
                ))}
                {filtered.length === 0 && <tr><td colSpan={5} className="p-6 text-center text-muted-foreground">Nenhum técnico cadastrado</td></tr>}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
