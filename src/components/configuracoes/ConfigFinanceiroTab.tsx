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
import { useEmpresa } from "@/contexts/EmpresaContext";

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

function MetasCard() {
  const qc = useQueryClient();
  const { empresaId, empresa } = useEmpresa();
  const { data: config } = useQuery({
    queryKey: ["empresa_config_meta", empresaId],
    enabled: !!empresaId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("empresa_config")
        .select("*")
        .eq("empresa_id", empresaId)
        .maybeSingle();

      if (error) throw error;
      return data;
    },
  });

  const { data: socios, refetch: refetchSocios } = useQuery({
    queryKey: ["config-socios", empresaId],
    enabled: !!empresaId,
    queryFn: async () => {
      const { data } = await supabase.from("socios").select("*").eq("ativo", true).order("ordem");
      return data ?? [];
    },
  });

  const [metaGastos, setMetaGastos] = useState("");
  const [metaFaturamento, setMetaFaturamento] = useState("");
  const [numSocios, setNumSocios] = useState("1");
  const [pctReserva, setPctReserva] = useState("10");
  const [gastosFix, setGastosFix] = useState("");
  const [depreciacao, setDepreciacao] = useState("");
  const [impostos, setImpostos] = useState("");
  const [outrosGastos, setOutrosGastos] = useState("");
  const [socioNomes, setSocioNomes] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!config) return;
    setMetaGastos(String(config.meta_gastos_mes ?? ""));
    setMetaFaturamento(String(config.meta_faturamento_mes ?? ""));
    setNumSocios(String(config.numero_socios ?? 1));
    setPctReserva(String(config.percentual_reserva_empresa ?? 10));
    setGastosFix(String((config as any).gastos_fixos_mensais ?? ""));
    setDepreciacao(String((config as any).depreciacao_mensal ?? ""));
    setImpostos(String((config as any).impostos_mensal ?? ""));
    setOutrosGastos(String((config as any).outros_gastos ?? ""));
  }, [config]);

  useEffect(() => {
    if (socios) {
      const n = Number(numSocios) || 1;
      const nomes = Array.from({ length: n }, (_, i) => socios[i]?.nome ?? "");
      setSocioNomes(nomes);
    }
  }, [socios, numSocios]);

  const handleSave = async () => {
    if (!empresaId) {
      toast.error("Empresa não identificada");
      return;
    }

    setSaving(true);

    try {
      const ns = Number(numSocios) || 1;
      const payload = {
        empresa_id: empresaId,
        meta_gastos_mes: Number(metaGastos) || 0,
        meta_faturamento_mes: Number(metaFaturamento) || 0,
        numero_socios: ns,
        percentual_reserva_empresa: Number(pctReserva) || 0,
        gastos_fixos_mensais: Number(gastosFix) || 0,
        depreciacao_mensal: Number(depreciacao) || 0,
        impostos_mensal: Number(impostos) || 0,
        outros_gastos: Number(outrosGastos) || 0,
      };

      const { data: existingConfig, error: lookupError } = await supabase
        .from("empresa_config")
        .select("id")
        .eq("empresa_id", empresaId)
        .maybeSingle();

      if (lookupError) throw lookupError;

      const configResponse = existingConfig?.id
        ? await supabase.from("empresa_config").update(payload as any).eq("id", existingConfig.id)
        : await supabase.from("empresa_config").insert({
            nome: empresa?.nome || "Minha Assistência Técnica",
            ...payload,
          } as any);

      if (configResponse.error) throw configResponse.error;

      const existing = socios ?? [];
      for (let i = 0; i < ns; i++) {
        const nome = socioNomes[i]?.trim() || "";
        const socioResponse = existing[i]
          ? await supabase.from("socios").update({ nome, ordem: i } as any).eq("id", existing[i].id)
          : await supabase.from("socios").insert({ nome, ordem: i, empresa_id: empresaId } as any);

        if (socioResponse.error) throw socioResponse.error;
      }

      for (let i = ns; i < existing.length; i++) {
        const { error } = await supabase.from("socios").update({ ativo: false } as any).eq("id", existing[i].id);
        if (error) throw error;
      }

      qc.invalidateQueries({ queryKey: ["empresa_config_meta", empresaId] });
      qc.invalidateQueries({ queryKey: ["dashboard-empresa-config"] });
      qc.invalidateQueries({ queryKey: ["dashboard-socios"] });
      refetchSocios();
      toast.success("Configurações atualizadas");
    } catch (error: any) {
      console.error("Erro ao salvar configurações financeiras:", error);
      toast.error(error?.message || "Erro ao salvar configurações financeiras");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium">Metas e Distribuição de Lucro</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <Label>Meta de gastos (R$)</Label>
            <Input type="number" step="0.01" placeholder="Ex: 5000.00" value={metaGastos} onChange={(e) => setMetaGastos(e.target.value)} />
          </div>
          <div>
            <Label>Meta de faturamento (R$)</Label>
            <Input type="number" step="0.01" placeholder="Ex: 20000.00" value={metaFaturamento} onChange={(e) => setMetaFaturamento(e.target.value)} />
          </div>
        </div>

        <div className="border-t pt-3 space-y-3">
          <p className="text-xs font-semibold text-muted-foreground uppercase">Gastos Operacionais</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label>Gastos fixos mensais (R$)</Label>
              <Input type="number" step="0.01" value={gastosFix} onChange={(e) => setGastosFix(e.target.value)} />
            </div>
            <div>
              <Label>Depreciação mensal (R$)</Label>
              <Input type="number" step="0.01" value={depreciacao} onChange={(e) => setDepreciacao(e.target.value)} />
            </div>
            <div>
              <Label>Impostos / IR mensal (R$)</Label>
              <Input type="number" step="0.01" value={impostos} onChange={(e) => setImpostos(e.target.value)} />
            </div>
            <div>
              <Label>Outros gastos operacionais (R$)</Label>
              <Input type="number" step="0.01" value={outrosGastos} onChange={(e) => setOutrosGastos(e.target.value)} />
            </div>
          </div>
        </div>

        <div className="border-t pt-3 space-y-3">
          <p className="text-xs font-semibold text-muted-foreground uppercase">Distribuição do Lucro</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label>Número de sócios</Label>
              <Input type="number" min="1" max="10" value={numSocios} onChange={(e) => setNumSocios(e.target.value)} />
            </div>
            <div>
              <Label>Reserva da empresa (%)</Label>
              <Input type="number" step="0.5" min="0" max="100" value={pctReserva} onChange={(e) => setPctReserva(e.target.value)} />
              <p className="text-[10px] text-muted-foreground mt-1">% do lucro líquido reservado antes de dividir entre sócios.</p>
            </div>
          </div>

          {Array.from({ length: Number(numSocios) || 1 }, (_, i) => (
            <div key={i}>
              <Label>Nome do Sócio {i + 1}</Label>
              <Input
                placeholder={`Sócio ${i + 1}`}
                value={socioNomes[i] ?? ""}
                onChange={(e) => {
                  const copy = [...socioNomes];
                  copy[i] = e.target.value;
                  setSocioNomes(copy);
                }}
              />
            </div>
          ))}
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
      <MetasCard />
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <CrudSection title="Categorias Financeiras" items={categoriasFinanceiras} queryKey="categorias_financeiras" table="categorias_financeiras" fields={[{ key: "nome", label: "Nome" }, { key: "tipo", label: "Tipo (fixo/variavel)" }]} />
        <CrudSection title="Centros de Custo" items={centrosCusto} queryKey="centros_custo" table="centros_custo" fields={[{ key: "nome", label: "Nome" }, { key: "descricao", label: "Descrição" }]} />
        <CrudSection title="Formas de Pagamento" items={formasPagamento} queryKey="formas_pagamento" table="formas_pagamento" fields={[{ key: "nome", label: "Nome" }]} />
      </div>
    </div>
  );
}
