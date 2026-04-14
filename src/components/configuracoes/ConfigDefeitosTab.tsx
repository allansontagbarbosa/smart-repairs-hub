import { useState } from "react";
import { Plus, Pencil, Trash2, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CurrencyInput } from "@/components/smart-inputs/CurrencyInput";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

const categorias = ["tela", "bateria", "conector", "câmera", "áudio", "botões", "rede", "software", "físico", "biometria", "geral"];

const emptyForm = { nome: "", categoria: "geral", valor_mao_obra: 0, ativo: true };

export function ConfigDefeitosTab() {
  const qc = useQueryClient();
  const { data: defeitos = [] } = useQuery({
    queryKey: ["tipos_defeito"],
    queryFn: async () => {
      const { data } = await supabase.from("tipos_defeito").select("*").order("categoria").order("nome");
      return data ?? [];
    },
  });

  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<any>(emptyForm);
  const [editId, setEditId] = useState<string | null>(null);

  const filtered = defeitos.filter((d: any) =>
    d.nome?.toLowerCase().includes(search.toLowerCase()) ||
    d.categoria?.toLowerCase().includes(search.toLowerCase())
  );

  const set = (k: string, v: any) => setForm((p: any) => ({ ...p, [k]: v }));

  const handleSave = async () => {
    if (!form.nome) { toast.error("Nome é obrigatório"); return; }
    const payload = { ...form, valor_mao_obra: Number(form.valor_mao_obra) || 0 };
    if (editId) {
      await supabase.from("tipos_defeito").update(payload).eq("id", editId);
    } else {
      await supabase.from("tipos_defeito").insert(payload);
    }
    qc.invalidateQueries({ queryKey: ["tipos_defeito"] });
    toast.success(editId ? "Defeito atualizado" : "Defeito cadastrado");
    setOpen(false); setForm(emptyForm); setEditId(null);
  };

  const handleEdit = (d: any) => {
    setForm({ nome: d.nome, categoria: d.categoria || "geral", valor_mao_obra: d.valor_mao_obra || 0, ativo: d.ativo });
    setEditId(d.id); setOpen(true);
  };

  const handleDelete = async (id: string) => {
    await supabase.from("tipos_defeito").delete().eq("id", id);
    qc.invalidateQueries({ queryKey: ["tipos_defeito"] });
    toast.success("Defeito removido");
  };

  const fmt = (v: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-3 justify-between">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar defeito..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) { setForm(emptyForm); setEditId(null); } }}>
          <DialogTrigger asChild><Button size="sm"><Plus className="h-4 w-4 mr-1" />Novo Defeito</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>{editId ? "Editar" : "Novo"} Defeito</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div><Label>Nome *</Label><Input value={form.nome} onChange={(e) => set("nome", e.target.value)} /></div>
              <div>
                <Label>Categoria</Label>
                <Select value={form.categoria} onValueChange={(v) => set("categoria", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {categorias.map((c) => (
                      <SelectItem key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div><Label>Valor de mão de obra (R$)</Label><CurrencyInput value={form.valor_mao_obra} onValueChange={(v) => set("valor_mao_obra", v)} /></div>
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
              <thead><tr className="border-b bg-muted/50"><th className="text-left p-3 font-medium">Defeito</th><th className="text-left p-3 font-medium">Categoria</th><th className="text-left p-3 font-medium hidden md:table-cell">Mão de Obra</th><th className="text-left p-3 font-medium">Status</th><th className="p-3"></th></tr></thead>
              <tbody>
                {filtered.map((d: any) => (
                  <tr key={d.id} className="border-b last:border-0 hover:bg-muted/30">
                    <td className="p-3 font-medium">{d.nome}</td>
                    <td className="p-3"><Badge variant="outline" className="text-[10px]">{d.categoria}</Badge></td>
                    <td className="p-3 hidden md:table-cell">{fmt(d.valor_mao_obra || 0)}</td>
                    <td className="p-3"><Badge variant={d.ativo ? "default" : "secondary"}>{d.ativo ? "Ativo" : "Inativo"}</Badge></td>
                    <td className="p-3 text-right">
                      <Button variant="ghost" size="icon" onClick={() => handleEdit(d)}><Pencil className="h-3.5 w-3.5" /></Button>
                      <Button variant="ghost" size="icon" onClick={() => handleDelete(d.id)}><Trash2 className="h-3.5 w-3.5 text-destructive" /></Button>
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && <tr><td colSpan={5} className="p-6 text-center text-muted-foreground">Nenhum defeito cadastrado</td></tr>}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
