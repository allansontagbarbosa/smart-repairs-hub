import { useState } from "react";
import { Plus, Pencil, Trash2, Search, DollarSign } from "lucide-react";
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
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

interface Props {
  listasPreco: any[];
}

const fmt = (v: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

export function ConfigListaPrecosTab({ listasPreco }: Props) {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<any>({ nome: "", cliente_id: "", observacoes: "", ativo: true });
  const [selectedLista, setSelectedLista] = useState<string | null>(null);

  // Item management
  const [openItem, setOpenItem] = useState(false);
  const [itemForm, setItemForm] = useState<any>({ nome_item: "", tipo: "produto", preco_padrao: 0, preco_especial: null, observacoes: "" });
  const [itemEditId, setItemEditId] = useState<string | null>(null);

  const { data: clientes = [] } = useQuery({
    queryKey: ["clientes_lista"],
    queryFn: async () => {
      const { data } = await supabase.from("clientes").select("id, nome").eq("status", "ativo").order("nome");
      return data || [];
    },
  });

  const { data: itensLista = [] } = useQuery({
    queryKey: ["listas_preco_itens", selectedLista],
    queryFn: async () => {
      if (!selectedLista) return [];
      const { data } = await supabase.from("listas_preco_itens").select("*").eq("lista_id", selectedLista).order("nome_item");
      return data || [];
    },
    enabled: !!selectedLista,
  });

  const filtered = listasPreco.filter((l) =>
    l.nome?.toLowerCase().includes(search.toLowerCase()) ||
    (l as any).clientes?.nome?.toLowerCase().includes(search.toLowerCase())
  );

  const set = (k: string, v: any) => setForm((p: any) => ({ ...p, [k]: v }));

  const handleSave = async () => {
    if (!form.nome) { toast.error("Nome é obrigatório"); return; }
    const payload = { nome: form.nome, cliente_id: form.cliente_id || null, observacoes: form.observacoes || null, ativo: form.ativo };
    if (editId) {
      await supabase.from("listas_preco").update(payload).eq("id", editId);
    } else {
      await supabase.from("listas_preco").insert(payload);
    }
    qc.invalidateQueries({ queryKey: ["listas_preco"] });
    toast.success("Lista salva");
    setOpen(false); setForm({ nome: "", cliente_id: "", observacoes: "", ativo: true }); setEditId(null);
  };

  const handleEdit = (l: any) => {
    setForm({ nome: l.nome, cliente_id: l.cliente_id || "", observacoes: l.observacoes || "", ativo: l.ativo });
    setEditId(l.id); setOpen(true);
  };

  const handleDelete = async (id: string) => {
    await supabase.from("listas_preco_itens").delete().eq("lista_id", id);
    await supabase.from("listas_preco").delete().eq("id", id);
    qc.invalidateQueries({ queryKey: ["listas_preco"] });
    toast.success("Lista removida");
    if (selectedLista === id) setSelectedLista(null);
  };

  const handleSaveItem = async () => {
    if (!itemForm.nome_item || !selectedLista) { toast.error("Nome é obrigatório"); return; }
    const payload = {
      ...itemForm,
      lista_id: selectedLista,
      preco_padrao: Number(itemForm.preco_padrao) || 0,
      preco_especial: itemForm.preco_especial ? Number(itemForm.preco_especial) : null,
    };
    if (itemEditId) {
      await supabase.from("listas_preco_itens").update(payload).eq("id", itemEditId);
    } else {
      await supabase.from("listas_preco_itens").insert(payload);
    }
    qc.invalidateQueries({ queryKey: ["listas_preco_itens", selectedLista] });
    toast.success("Item salvo");
    setOpenItem(false);
    setItemForm({ nome_item: "", tipo: "produto", preco_padrao: 0, preco_especial: null, observacoes: "" });
    setItemEditId(null);
  };

  const handleDeleteItem = async (id: string) => {
    await supabase.from("listas_preco_itens").delete().eq("id", id);
    qc.invalidateQueries({ queryKey: ["listas_preco_itens", selectedLista] });
    toast.success("Item removido");
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-3 justify-between">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar lista de preços..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) { setForm({ nome: "", cliente_id: "", observacoes: "", ativo: true }); setEditId(null); } }}>
          <DialogTrigger asChild><Button size="sm"><Plus className="h-4 w-4 mr-1" />Nova Lista</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>{editId ? "Editar" : "Nova"} Lista de Preços</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div><Label>Nome *</Label><Input value={form.nome} onChange={(e) => set("nome", e.target.value)} placeholder="Ex: Tabela Premium" /></div>
              <div>
                <Label>Cliente (opcional)</Label>
                <Select value={form.cliente_id || "none"} onValueChange={(v) => set("cliente_id", v === "none" ? "" : v)}>
                  <SelectTrigger><SelectValue placeholder="Todos os clientes" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Todos os clientes</SelectItem>
                    {clientes.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div><Label>Observações</Label><Textarea value={form.observacoes} onChange={(e) => set("observacoes", e.target.value)} rows={2} /></div>
              <div className="flex items-center gap-2"><Switch checked={form.ativo} onCheckedChange={(v) => set("ativo", v)} /><Label>Ativa</Label></div>
              <Button onClick={handleSave} className="w-full">{editId ? "Salvar" : "Cadastrar"}</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Lists */}
        <Card className="lg:col-span-1">
          <CardHeader className="pb-2"><CardTitle className="text-sm">Listas</CardTitle></CardHeader>
          <CardContent className="p-0">
            <div className="divide-y max-h-[400px] overflow-y-auto">
              {filtered.map((l) => (
                <button
                  key={l.id}
                  onClick={() => setSelectedLista(l.id)}
                  className={`w-full text-left px-4 py-3 flex items-center justify-between hover:bg-muted/50 transition-colors ${selectedLista === l.id ? "bg-primary/10" : ""}`}
                >
                  <div>
                    <div className="text-sm font-medium">{l.nome}</div>
                    <div className="text-xs text-muted-foreground">{(l as any).clientes?.nome || "Geral"}</div>
                  </div>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={(e) => { e.stopPropagation(); handleEdit(l); }}><Pencil className="h-3 w-3" /></Button>
                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={(e) => { e.stopPropagation(); handleDelete(l.id); }}><Trash2 className="h-3 w-3 text-destructive" /></Button>
                  </div>
                </button>
              ))}
              {filtered.length === 0 && <div className="p-4 text-center text-sm text-muted-foreground">Nenhuma lista criada</div>}
            </div>
          </CardContent>
        </Card>

        {/* Items */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <CardTitle className="text-sm flex items-center gap-2"><DollarSign className="h-4 w-4" />Itens da Lista</CardTitle>
            {selectedLista && (
              <Dialog open={openItem} onOpenChange={(v) => { setOpenItem(v); if (!v) { setItemEditId(null); setItemForm({ nome_item: "", tipo: "produto", preco_padrao: 0, preco_especial: null, observacoes: "" }); } }}>
                <DialogTrigger asChild><Button size="sm" variant="outline"><Plus className="h-3.5 w-3.5 mr-1" />Novo Item</Button></DialogTrigger>
                <DialogContent>
                  <DialogHeader><DialogTitle>{itemEditId ? "Editar" : "Novo"} Item</DialogTitle></DialogHeader>
                  <div className="space-y-3">
                    <div><Label>Nome *</Label><Input value={itemForm.nome_item} onChange={(e) => setItemForm((p: any) => ({ ...p, nome_item: e.target.value }))} /></div>
                    <div>
                      <Label>Tipo</Label>
                      <Select value={itemForm.tipo} onValueChange={(v) => setItemForm((p: any) => ({ ...p, tipo: v }))}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="produto">Produto</SelectItem>
                          <SelectItem value="servico">Serviço</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div><Label>Preço padrão (R$)</Label><Input type="number" value={itemForm.preco_padrao} onChange={(e) => setItemForm((p: any) => ({ ...p, preco_padrao: e.target.value }))} /></div>
                      <div><Label>Preço especial (R$)</Label><Input type="number" value={itemForm.preco_especial ?? ""} onChange={(e) => setItemForm((p: any) => ({ ...p, preco_especial: e.target.value || null }))} /></div>
                    </div>
                    <div><Label>Observações</Label><Input value={itemForm.observacoes} onChange={(e) => setItemForm((p: any) => ({ ...p, observacoes: e.target.value }))} /></div>
                    <Button onClick={handleSaveItem} className="w-full">{itemEditId ? "Salvar" : "Adicionar"}</Button>
                  </div>
                </DialogContent>
              </Dialog>
            )}
          </CardHeader>
          <CardContent className="p-0">
            {!selectedLista ? (
              <div className="p-8 text-center text-sm text-muted-foreground">Selecione uma lista para ver os itens</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead><tr className="border-b bg-muted/50"><th className="text-left p-3 font-medium">Item</th><th className="text-left p-3 font-medium">Tipo</th><th className="text-left p-3 font-medium">Preço</th><th className="text-left p-3 font-medium">Especial</th><th className="p-3"></th></tr></thead>
                  <tbody>
                    {itensLista.map((item: any) => (
                      <tr key={item.id} className="border-b last:border-0 hover:bg-muted/30">
                        <td className="p-3 font-medium">{item.nome_item}</td>
                        <td className="p-3"><Badge variant="outline" className="text-[10px]">{item.tipo}</Badge></td>
                        <td className="p-3">{fmt(item.preco_padrao || 0)}</td>
                        <td className="p-3">{item.preco_especial ? fmt(item.preco_especial) : "—"}</td>
                        <td className="p-3 text-right">
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { setItemForm({ nome_item: item.nome_item, tipo: item.tipo, preco_padrao: item.preco_padrao || 0, preco_especial: item.preco_especial, observacoes: item.observacoes || "" }); setItemEditId(item.id); setOpenItem(true); }}><Pencil className="h-3 w-3" /></Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleDeleteItem(item.id)}><Trash2 className="h-3 w-3 text-destructive" /></Button>
                        </td>
                      </tr>
                    ))}
                    {itensLista.length === 0 && <tr><td colSpan={5} className="p-6 text-center text-muted-foreground">Nenhum item nesta lista</td></tr>}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
