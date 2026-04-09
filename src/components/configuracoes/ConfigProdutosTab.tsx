import { useState } from "react";
import { Plus, Pencil, Trash2, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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

interface Props {
  produtosBase: any[];
  marcas: any[];
  modelos: any[];
  categorias: any[];
}

const emptyForm = { nome: "", categoria_id: "", marca_id: "", modelo_id: "", descricao: "", custo: 0, preco_padrao: 0, preco_especial: null as number | null, sku: "", ativo: true };

export function ConfigProdutosTab({ produtosBase, marcas, modelos, categorias }: Props) {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<any>(emptyForm);
  const [editId, setEditId] = useState<string | null>(null);

  const filtered = produtosBase.filter((p) => p.nome?.toLowerCase().includes(search.toLowerCase()) || p.sku?.toLowerCase().includes(search.toLowerCase()));
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
    toast.success(editId ? "Produto atualizado" : "Produto cadastrado");
    setOpen(false); setForm(emptyForm); setEditId(null);
  };

  const handleEdit = (p: any) => {
    setForm({ nome: p.nome, categoria_id: p.categoria_id || "", marca_id: p.marca_id || "", modelo_id: p.modelo_id || "", descricao: p.descricao || "", custo: p.custo || 0, preco_padrao: p.preco_padrao || 0, preco_especial: p.preco_especial, sku: p.sku || "", ativo: p.ativo });
    setEditId(p.id); setOpen(true);
  };

  const handleDelete = async (id: string) => {
    await supabase.from("produtos_base").delete().eq("id", id);
    qc.invalidateQueries({ queryKey: ["produtos_base"] });
    toast.success("Produto removido");
  };

  const fmt = (v: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-3 justify-between">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar por nome ou SKU..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) { setForm(emptyForm); setEditId(null); } }}>
          <DialogTrigger asChild><Button size="sm"><Plus className="h-4 w-4 mr-1" />Novo Produto</Button></DialogTrigger>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader><DialogTitle>{editId ? "Editar" : "Novo"} Produto</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div><Label>Nome *</Label><Input value={form.nome} onChange={(e) => set("nome", e.target.value)} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>SKU</Label><Input value={form.sku} onChange={(e) => set("sku", e.target.value)} /></div>
                <div>
                  <Label>Categoria</Label>
                  <Select value={form.categoria_id} onValueChange={(v) => set("categoria_id", v)}>
                    <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent>{categorias.map((c) => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Marca</Label>
                  <Select value={form.marca_id} onValueChange={(v) => set("marca_id", v)}>
                    <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent>{marcas.map((m) => <SelectItem key={m.id} value={m.id}>{m.nome}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Modelo</Label>
                  <Select value={form.modelo_id} onValueChange={(v) => set("modelo_id", v)}>
                    <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent>{modelos.filter((m) => !form.marca_id || m.marca_id === form.marca_id).map((m) => <SelectItem key={m.id} value={m.id}>{m.nome}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>
              <div><Label>Descrição</Label><Textarea value={form.descricao} onChange={(e) => set("descricao", e.target.value)} rows={2} /></div>
              <div className="grid grid-cols-3 gap-3">
                <div><Label>Custo (R$)</Label><Input type="number" value={form.custo} onChange={(e) => set("custo", e.target.value)} /></div>
                <div><Label>Preço padrão (R$)</Label><Input type="number" value={form.preco_padrao} onChange={(e) => set("preco_padrao", e.target.value)} /></div>
                <div><Label>Preço especial (R$)</Label><Input type="number" value={form.preco_especial ?? ""} onChange={(e) => set("preco_especial", e.target.value || null)} /></div>
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
              <thead><tr className="border-b bg-muted/50"><th className="text-left p-3 font-medium">Produto</th><th className="text-left p-3 font-medium hidden md:table-cell">SKU</th><th className="text-left p-3 font-medium hidden md:table-cell">Custo</th><th className="text-left p-3 font-medium hidden md:table-cell">Preço</th><th className="text-left p-3 font-medium">Status</th><th className="p-3"></th></tr></thead>
              <tbody>
                {filtered.map((p) => (
                  <tr key={p.id} className="border-b last:border-0 hover:bg-muted/30">
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
                {filtered.length === 0 && <tr><td colSpan={6} className="p-6 text-center text-muted-foreground">Nenhum produto cadastrado</td></tr>}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
