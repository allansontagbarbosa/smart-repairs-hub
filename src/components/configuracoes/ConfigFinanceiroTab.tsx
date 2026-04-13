import { useState, useEffect } from "react";
import { Plus, Pencil, Trash2, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

interface Props {
  categoriasFinanceiras: any[];
  centrosCusto: any[];
  formasPagamento: any[];
}

function CrudSection({ title, items, queryKey, table, fields }: { title: string; items: any[]; queryKey: string; table: string; fields: { key: string; label: string }[] }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<any>({});

  const reset = () => { setForm({}); setEditId(null); };

  const handleSave = async () => {
    const payload = { ...form };
    if (!payload.nome) { toast.error("Nome é obrigatório"); return; }
    if (editId) {
      await supabase.from(table as any).update(payload).eq("id", editId);
    } else {
      await supabase.from(table as any).insert(payload);
    }
    qc.invalidateQueries({ queryKey: [queryKey] });
    toast.success("Salvo com sucesso");
    setOpen(false); reset();
  };

  const handleEdit = (item: any) => {
    const f: any = {};
    fields.forEach((fi) => { f[fi.key] = item[fi.key] ?? ""; });
    f.ativo = item.ativo;
    setForm(f);
    setEditId(item.id);
    setOpen(true);
  };

  const handleDelete = async (id: string) => {
    await supabase.from(table as any).delete().eq("id", id);
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
            <DialogHeader><DialogTitle>{editId ? "Editar" : "Novo"} {title}</DialogTitle></DialogHeader>
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
                <span className="text-sm">{item.nome || item.nome_perfil}</span>
                {!item.ativo && <Badge variant="secondary" className="text-[10px]">Inativo</Badge>}
              </div>
              <div className="flex gap-1">
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleEdit(item)}><Pencil className="h-3 w-3" /></Button>
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleDelete(item.id)}><Trash2 className="h-3 w-3 text-destructive" /></Button>
              </div>
            </div>
          ))}
          {items.length === 0 && <div className="p-4 text-center text-sm text-muted-foreground">Nenhum item cadastrado</div>}
        </div>
      </CardContent>
    </Card>
  );
}

function MetaGastosCard() {
  const qc = useQueryClient();
  const { data: config } = useQuery({
    queryKey: ["empresa_config_meta"],
    queryFn: async () => {
      const { data } = await supabase.from("empresa_config").select("id, meta_gastos_mes").limit(1).maybeSingle();
      return data;
    },
  });

  const [valor, setValor] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (config?.meta_gastos_mes != null) {
      setValor(String(config.meta_gastos_mes));
    }
  }, [config]);

  const handleSave = async () => {
    if (!config?.id) return;
    setSaving(true);
    await supabase.from("empresa_config").update({ meta_gastos_mes: Number(valor) || 0 } as any).eq("id", config.id);
    qc.invalidateQueries({ queryKey: ["empresa_config_meta"] });
    qc.invalidateQueries({ queryKey: ["dashboard-empresa-config"] });
    toast.success("Meta de gastos atualizada");
    setSaving(false);
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium">Meta de Gastos Mensal</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div>
          <Label>Valor da meta (R$)</Label>
          <Input
            type="number"
            step="0.01"
            placeholder="Ex: 5000.00"
            value={valor}
            onChange={(e) => setValor(e.target.value)}
          />
          <p className="text-[10px] text-muted-foreground mt-1">Orçamento máximo de gastos por mês. Aparece no Dashboard como barra de progresso.</p>
        </div>
        <Button onClick={handleSave} disabled={saving} size="sm" className="gap-1.5">
          <Save className="h-3.5 w-3.5" /> Salvar
        </Button>
      </CardContent>
    </Card>
  );
}

export function ConfigFinanceiroTab({ categoriasFinanceiras, centrosCusto, formasPagamento }: Props) {
  return (
    <div className="space-y-4">
      <MetaGastosCard />
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <CrudSection title="Categorias Financeiras" items={categoriasFinanceiras} queryKey="categorias_financeiras" table="categorias_financeiras" fields={[{ key: "nome", label: "Nome" }, { key: "tipo", label: "Tipo (fixo/variavel)" }]} />
        <CrudSection title="Centros de Custo" items={centrosCusto} queryKey="centros_custo" table="centros_custo" fields={[{ key: "nome", label: "Nome" }, { key: "descricao", label: "Descrição" }]} />
        <CrudSection title="Formas de Pagamento" items={formasPagamento} queryKey="formas_pagamento" table="formas_pagamento" fields={[{ key: "nome", label: "Nome" }]} />
      </div>
    </div>
  );
}
