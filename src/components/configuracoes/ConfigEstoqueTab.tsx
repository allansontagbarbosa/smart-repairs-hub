import { useState } from "react";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

interface Props {
  estoqueCategorias: any[];
  marcas: any[];
  modelos: any[];
}

function SimpleCrud({ title, items, queryKey, table, fields }: { title: string; items: any[]; queryKey: string; table: string; fields: { key: string; label: string; type?: string }[] }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<any>({});

  const reset = () => { setForm({}); setEditId(null); };
  const handleSave = async () => {
    if (!form.nome) { toast.error("Nome é obrigatório"); return; }
    if (editId) { await supabase.from(table as any).update(form).eq("id", editId); }
    else { await supabase.from(table as any).insert(form); }
    qc.invalidateQueries({ queryKey: [queryKey] });
    toast.success("Salvo"); setOpen(false); reset();
  };
  const handleEdit = (item: any) => {
    const f: any = {};
    fields.forEach((fi) => { f[fi.key] = item[fi.key] ?? ""; });
    f.ativo = item.ativo;
    setForm(f); setEditId(item.id); setOpen(true);
  };
  const handleDelete = async (id: string) => {
    const { error } = await supabase.from(table as any).delete().eq("id", id);
    if (error) {
      if (error.code === "23503") {
        toast.error("Não é possível excluir: este registro está em uso em outras partes do sistema.");
      } else {
        toast.error("Erro ao excluir: " + error.message);
      }
      return;
    }
    qc.invalidateQueries({ queryKey: [queryKey] });
    toast.success("Removido");
  };

  return (
    <Card>
      <CardHeader className="pb-3 flex flex-row items-center justify-between">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) reset(); }}>
          <DialogTrigger asChild><Button size="sm" variant="outline"><Plus className="h-3.5 w-3.5 mr-1" />Novo</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>{editId ? "Editar" : "Novo(a)"} {title}</DialogTitle></DialogHeader>
            <div className="space-y-3">
              {fields.map((f) => (
                <div key={f.key}><Label>{f.label}</Label><Input value={form[f.key] || ""} onChange={(e) => setForm((p: any) => ({ ...p, [f.key]: e.target.value }))} /></div>
              ))}
              <div className="flex items-center gap-2"><Switch checked={form.ativo !== false} onCheckedChange={(v) => setForm((p: any) => ({ ...p, ativo: v }))} /><Label>Ativo</Label></div>
              <Button onClick={handleSave} className="w-full">{editId ? "Salvar" : "Cadastrar"}</Button>
            </div>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent className="p-0">
        <div className="divide-y">
          {items.map((item) => (
            <div key={item.id} className="flex items-center justify-between px-4 py-2.5">
              <div className="flex items-center gap-2">
                <span className="text-sm">{item.nome}</span>
                {!item.ativo && <Badge variant="secondary" className="text-[10px]">Inativo</Badge>}
              </div>
              <div className="flex gap-1">
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleEdit(item)}><Pencil className="h-3 w-3" /></Button>
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleDelete(item.id)}><Trash2 className="h-3 w-3 text-destructive" /></Button>
              </div>
            </div>
          ))}
          {items.length === 0 && <div className="p-4 text-center text-sm text-muted-foreground">Nenhum item</div>}
        </div>
      </CardContent>
    </Card>
  );
}

function ModelosCrud({ modelos, marcas }: { modelos: any[]; marcas: any[] }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<any>({ nome: "", marca_id: "", ativo: true });

  const reset = () => { setForm({ nome: "", marca_id: "", ativo: true }); setEditId(null); };
  const handleSave = async () => {
    if (!form.nome || !form.marca_id) { toast.error("Nome e marca são obrigatórios"); return; }
    if (editId) { await supabase.from("modelos").update(form).eq("id", editId); }
    else { await supabase.from("modelos").insert(form); }
    qc.invalidateQueries({ queryKey: ["modelos"] });
    toast.success("Salvo"); setOpen(false); reset();
  };
  const handleEdit = (m: any) => { setForm({ nome: m.nome, marca_id: m.marca_id, ativo: m.ativo }); setEditId(m.id); setOpen(true); };
  const handleDelete = async (id: string) => {
    // Limpa referências antes de deletar
    await supabase.from("produtos_base" as any).update({ modelo_id: null }).eq("modelo_id", id);

    const { error } = await supabase.from("modelos").delete().eq("id", id);
    if (error) {
      if (error.code === "23503") {
        toast.error("Não é possível excluir: este registro está em uso em outras partes do sistema.");
      } else {
        toast.error("Erro ao excluir: " + error.message);
      }
      return;
    }
    qc.invalidateQueries({ queryKey: ["modelos"] });
    toast.success("Modelo removido");
  };

  return (
    <Card>
      <CardHeader className="pb-3 flex flex-row items-center justify-between">
        <CardTitle className="text-sm font-medium">Modelos</CardTitle>
        <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) reset(); }}>
          <DialogTrigger asChild><Button size="sm" variant="outline"><Plus className="h-3.5 w-3.5 mr-1" />Novo</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>{editId ? "Editar" : "Novo"} Modelo</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div><Label>Nome *</Label><Input value={form.nome} onChange={(e) => setForm((p: any) => ({ ...p, nome: e.target.value }))} /></div>
              <div>
                <Label>Marca *</Label>
                <Select value={form.marca_id} onValueChange={(v) => setForm((p: any) => ({ ...p, marca_id: v }))}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>{marcas.map((m) => <SelectItem key={m.id} value={m.id}>{m.nome}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-2"><Switch checked={form.ativo} onCheckedChange={(v) => setForm((p: any) => ({ ...p, ativo: v }))} /><Label>Ativo</Label></div>
              <Button onClick={handleSave} className="w-full">{editId ? "Salvar" : "Cadastrar"}</Button>
            </div>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent className="p-0">
        <div className="divide-y">
          {modelos.map((m) => (
            <div key={m.id} className="flex items-center justify-between px-4 py-2.5">
              <div>
                <span className="text-sm">{m.nome}</span>
                <span className="text-xs text-muted-foreground ml-2">{(m as any).marcas?.nome}</span>
                {!m.ativo && <Badge variant="secondary" className="text-[10px] ml-2">Inativo</Badge>}
              </div>
              <div className="flex gap-1">
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleEdit(m)}><Pencil className="h-3 w-3" /></Button>
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleDelete(m.id)}><Trash2 className="h-3 w-3 text-destructive" /></Button>
              </div>
            </div>
          ))}
          {modelos.length === 0 && <div className="p-4 text-center text-sm text-muted-foreground">Nenhum modelo</div>}
        </div>
      </CardContent>
    </Card>
  );
}

export function ConfigEstoqueTab({ estoqueCategorias, marcas, modelos }: Props) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      <SimpleCrud title="Categorias de Estoque" items={estoqueCategorias} queryKey="estoque_categorias" table="estoque_categorias" fields={[{ key: "nome", label: "Nome" }, { key: "descricao", label: "Descrição" }]} />
      <SimpleCrud title="Marcas" items={marcas} queryKey="marcas" table="marcas" fields={[{ key: "nome", label: "Nome" }]} />
      <ModelosCrud modelos={modelos} marcas={marcas} />
    </div>
  );
}
