import { useState, useMemo } from "react";
import { Plus, Pencil, Trash2, Search, Sparkles, Package } from "lucide-react";
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
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { CurrencyInput } from "@/components/smart-inputs/CurrencyInput";
import { ComboboxWithCreate } from "@/components/smart-inputs/ComboboxWithCreate";
import { ServicoPecasSection, saveServicoPecas, type VinculoPeca } from "./ServicoPecasSection";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

interface Props { tiposServico: any[] }

const emptyForm = {
  nome: "",
  descricao: "",
  categoria: "",
  valor_padrao: null as number | null,
  comissao_padrao: null as number | null,
  ativo: true,
  tipo_comissao: "fixa",
};

const CATEGORIAS_PADRAO = [
  "audio", "bateria", "biometria", "botoes", "camera",
  "conector", "fisico", "rede", "software", "tela", "geral",
];

export function ConfigServicosTab({ tiposServico }: Props) {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [filtroCategoria, setFiltroCategoria] = useState<string>("todas");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<any>(emptyForm);
  const [editId, setEditId] = useState<string | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [vinculos, setVinculos] = useState<VinculoPeca[]>([]);

  // Carrega contagem agregada de peças vinculadas por serviço
  const { data: pecasPorServico = {} } = useQuery({
    queryKey: ["servico_pecas_count"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("servico_pecas" as any)
        .select("servico_id, estoque_itens:peca_id ( nome_personalizado, sku )");
      if (error) throw error;
      const map: Record<string, { count: number; nomes: string[] }> = {};
      for (const row of (data ?? []) as any[]) {
        const sid = row.servico_id;
        if (!map[sid]) map[sid] = { count: 0, nomes: [] };
        map[sid].count++;
        const p = row.estoque_itens;
        const nome = p?.nome_personalizado || p?.sku || "Peça";
        map[sid].nomes.push(nome);
      }
      return map;
    },
  });

  const categoriasOpts = useMemo(() => {
    const s = new Set<string>(CATEGORIAS_PADRAO);
    tiposServico.forEach((t: any) => { if (t.categoria) s.add(String(t.categoria).toLowerCase()); });
    return Array.from(s).sort().map((c) => ({ id: c, nome: c }));
  }, [tiposServico]);

  const filtered = tiposServico.filter((s) => {
    const matchSearch = !search || s.nome?.toLowerCase().includes(search.toLowerCase());
    const matchCat = filtroCategoria === "todas" || (s.categoria || "").toLowerCase() === filtroCategoria;
    return matchSearch && matchCat;
  });

  const set = (k: string, v: any) => setForm((p: any) => ({ ...p, [k]: v }));

  const handleSave = async () => {
    if (!form.nome) { toast.error("Nome é obrigatório"); return; }
    const payload = {
      nome: form.nome,
      descricao: form.descricao || null,
      categoria: form.categoria ? String(form.categoria).toLowerCase() : null,
      valor_padrao: Number(form.valor_padrao) || 0,
      comissao_padrao: Number(form.comissao_padrao) || 0,
      ativo: form.ativo,
    };
    try {
      let servicoId = editId;
      if (editId) {
        const { error } = await supabase.from("tipos_servico").update(payload).eq("id", editId);
        if (error) throw error;
      } else {
        const { data, error } = await supabase.from("tipos_servico").insert(payload).select("id").single();
        if (error) throw error;
        servicoId = data.id;
      }
      if (servicoId) {
        await saveServicoPecas(servicoId, vinculos);
      }
      qc.invalidateQueries({ queryKey: ["tipos_servico"] });
      qc.invalidateQueries({ queryKey: ["tipos_servico_os"] });
      qc.invalidateQueries({ queryKey: ["servico_pecas_count"] });
      qc.invalidateQueries({ queryKey: ["servico_pecas"] });
      toast.success(editId ? "Serviço atualizado" : "Serviço cadastrado");
      setOpen(false); setForm(emptyForm); setEditId(null); setVinculos([]);
    } catch (e: any) {
      toast.error(e.message || "Erro ao salvar serviço");
    }
  };

  const handleEdit = (s: any) => {
    setForm({
      nome: s.nome,
      descricao: s.descricao || "",
      categoria: s.categoria || "",
      valor_padrao: s.valor_padrao || null,
      comissao_padrao: s.comissao_padrao || null,
      ativo: s.ativo,
      tipo_comissao: "fixa",
    });
    setEditId(s.id);
    setVinculos([]); // será carregado pelo ServicoPecasSection via servicoId
    setOpen(true);
  };

  const handleNew = () => {
    setForm(emptyForm);
    setEditId(null);
    setVinculos([]);
    setOpen(true);
  };

  const handleDelete = async (id: string) => {
    await supabase.from("tipos_servico").delete().eq("id", id);
    qc.invalidateQueries({ queryKey: ["tipos_servico"] });
    qc.invalidateQueries({ queryKey: ["tipos_servico_os"] });
    qc.invalidateQueries({ queryKey: ["servico_pecas_count"] });
    toast.success("Serviço removido");
  };

  const createCategoria = async (nome: string) => {
    const v = nome.trim().toLowerCase();
    return { id: v, nome: v };
  };

  const fmt = (v: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-3 justify-between">
        <div className="flex flex-1 gap-2 max-w-xl">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Buscar serviço..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
          </div>
          <Select value={filtroCategoria} onValueChange={setFiltroCategoria}>
            <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todas">Todas categorias</SelectItem>
              {categoriasOpts.map((c) => (
                <SelectItem key={c.id} value={c.id} className="capitalize">{c.nome}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => setImportOpen(true)}>
            <Sparkles className="h-4 w-4 mr-1" />Importar via IA
          </Button>
          <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) { setForm(emptyForm); setEditId(null); setVinculos([]); } }}>
          <DialogTrigger asChild><Button size="sm" onClick={handleNew}><Plus className="h-4 w-4 mr-1" />Novo Serviço</Button></DialogTrigger>
          <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
            <DialogHeader><DialogTitle>{editId ? "Editar" : "Novo"} Serviço</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div><Label>Nome *</Label><Input value={form.nome} onChange={(e) => set("nome", e.target.value)} /></div>
              <div>
                <Label>Categoria</Label>
                <ComboboxWithCreate
                  items={categoriasOpts}
                  value={form.categoria || ""}
                  onChange={(_id, nome) => set("categoria", nome)}
                  onCreate={createCategoria}
                  placeholder="Selecione ou crie uma categoria"
                  entityName="categoria"
                />
              </div>
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

              <ServicoPecasSection
                servicoId={editId}
                valorServico={Number(form.valor_padrao) || 0}
                value={vinculos}
                onChange={setVinculos}
              />

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
              <thead><tr className="border-b bg-muted/50">
                <th className="text-left p-3 font-medium">Serviço</th>
                <th className="text-left p-3 font-medium">Categoria</th>
                <th className="text-left p-3 font-medium hidden md:table-cell">Valor</th>
                <th className="text-left p-3 font-medium hidden lg:table-cell">Peças</th>
                <th className="text-left p-3 font-medium hidden md:table-cell">Comissão</th>
                <th className="text-left p-3 font-medium">Status</th>
                <th className="p-3"></th>
              </tr></thead>
              <tbody>
                {filtered.map((s) => {
                  const pecasInfo = (pecasPorServico as any)[s.id];
                  return (
                  <tr key={s.id} className="border-b last:border-0 hover:bg-muted/30">
                    <td className="p-3 font-medium">{s.nome}<div className="text-xs text-muted-foreground">{s.descricao}</div></td>
                    <td className="p-3">
                      {s.categoria ? <Badge variant="outline" className="text-[10px] capitalize">{s.categoria}</Badge> : <span className="text-xs text-muted-foreground">—</span>}
                    </td>
                    <td className="p-3 hidden md:table-cell">{fmt(s.valor_padrao || 0)}</td>
                    <td className="p-3 hidden lg:table-cell">
                      {pecasInfo ? (
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Badge variant="secondary" className="text-[10px] gap-1">
                                <Package className="h-3 w-3" />
                                {pecasInfo.count} peça{pecasInfo.count > 1 ? "s" : ""}
                              </Badge>
                            </TooltipTrigger>
                            <TooltipContent className="max-w-xs">
                              <p className="text-xs font-medium mb-1">Peças vinculadas:</p>
                              <ul className="text-xs list-disc pl-4">
                                {pecasInfo.nomes.map((n: string, i: number) => <li key={i}>{n}</li>)}
                              </ul>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="p-3 hidden md:table-cell">{fmt(s.comissao_padrao || 0)}</td>
                    <td className="p-3"><Badge variant={s.ativo ? "default" : "secondary"}>{s.ativo ? "Ativo" : "Inativo"}</Badge></td>
                    <td className="p-3 text-right">
                      <Button variant="ghost" size="icon" onClick={() => handleEdit(s)}><Pencil className="h-3.5 w-3.5" /></Button>
                      <Button variant="ghost" size="icon" onClick={() => handleDelete(s.id)}><Trash2 className="h-3.5 w-3.5 text-destructive" /></Button>
                    </td>
                  </tr>
                  );
                })}
                {filtered.length === 0 && <tr><td colSpan={7} className="p-6 text-center text-muted-foreground">Nenhum serviço cadastrado</td></tr>}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
