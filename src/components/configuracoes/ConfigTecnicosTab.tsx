import { useState, useCallback } from "react";
import { Plus, Pencil, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MaskedInput } from "@/components/smart-inputs/MaskedInput";
import { CepLookup, type CepData } from "@/components/smart-inputs/CepLookup";
import { CurrencyInput } from "@/components/smart-inputs/CurrencyInput";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";

interface Props { funcionarios: any[] }

const emptyForm = {
  nome: "", cpf: "", telefone: "", email: "", cargo: "", funcao: "",
  endereco: "", cep: "", cidade: "", estado: "",
  tipo_comissao: "fixa" as string, valor_comissao: 0, ativo: true,
};

export function ConfigTecnicosTab({ funcionarios }: Props) {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<any>(emptyForm);

  const { data: tiposServico = [] } = useQuery({
    queryKey: ["tipos_servico"],
    queryFn: async () => { const { data } = await supabase.from("tipos_servico").select("*").eq("ativo", true).order("nome"); return data || []; },
  });

  // Commission per service (stored locally for display, future: separate table)
  const [comissoesPorServico, setComissoesPorServico] = useState<Record<string, { tipo: string; valor: number }>>({});

  const filtered = funcionarios.filter((f) => f.nome?.toLowerCase().includes(search.toLowerCase()));
  const set = (k: string, v: any) => setForm((p: any) => ({ ...p, [k]: v }));

  const handleCepData = useCallback((data: CepData) => {
    setForm((p: any) => ({ ...p, endereco: data.logradouro || p.endereco, cidade: data.localidade || "", estado: data.uf || "" }));
  }, []);

  const handleSave = async () => {
    if (!form.nome) { toast.error("Nome é obrigatório"); return; }
    const { cep, cidade, estado, cpf, ...rest } = form;
    const payload = { ...rest, valor_comissao: Number(form.valor_comissao) || 0 };
    if (editId) {
      await supabase.from("funcionarios").update(payload).eq("id", editId);
    } else {
      await supabase.from("funcionarios").insert(payload);
    }
    qc.invalidateQueries({ queryKey: ["funcionarios"] });
    toast.success(editId ? "Técnico atualizado" : "Técnico cadastrado");
    setOpen(false); setEditId(null); setForm(emptyForm);
  };

  const handleEdit = (f: any) => {
    setForm({ nome: f.nome, cpf: "", telefone: f.telefone || "", email: f.email || "", funcao: f.funcao || "", cargo: f.cargo || "", endereco: "", cep: "", cidade: "", estado: "", tipo_comissao: f.tipo_comissao, valor_comissao: f.valor_comissao, ativo: f.ativo });
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
        <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) setEditId(null); }}>
          <DialogTrigger asChild><Button size="sm"><Plus className="h-4 w-4 mr-1" />Novo Técnico</Button></DialogTrigger>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader><DialogTitle>{editId ? "Editar" : "Novo"} Técnico</DialogTitle></DialogHeader>
            <Tabs defaultValue="dados" className="w-full">
              <TabsList className="w-full grid grid-cols-3">
                <TabsTrigger value="dados">Dados</TabsTrigger>
                <TabsTrigger value="endereco">Endereço</TabsTrigger>
                <TabsTrigger value="comissao">Comissão</TabsTrigger>
              </TabsList>

              <TabsContent value="dados" className="space-y-3 mt-3">
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>Nome *</Label><Input value={form.nome} onChange={(e) => set("nome", e.target.value)} /></div>
                  <div><Label>CPF</Label><MaskedInput mask="cpf" value={form.cpf} onValueChange={(_, m) => set("cpf", m)} placeholder="000.000.000-00" /></div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>Telefone</Label><MaskedInput mask="phone" value={form.telefone} onValueChange={(_, m) => set("telefone", m)} placeholder="(00) 00000-0000" /></div>
                  <div><Label>Email</Label><Input value={form.email} onChange={(e) => set("email", e.target.value)} /></div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>Cargo</Label><Input value={form.cargo} onChange={(e) => set("cargo", e.target.value)} placeholder="Ex: Técnico Sênior" /></div>
                  <div><Label>Especialidade</Label><Input value={form.funcao} onChange={(e) => set("funcao", e.target.value)} placeholder="Ex: Telas, Placas" /></div>
                </div>
                <div className="flex items-center gap-2"><Switch checked={form.ativo} onCheckedChange={(v) => set("ativo", v)} /><Label>Ativo</Label></div>
              </TabsContent>

              <TabsContent value="endereco" className="space-y-3 mt-3">
                <CepLookup cep={form.cep} onCepChange={(v) => set("cep", v)} onAddressFound={handleCepData} />
                <div><Label>Endereço</Label><Input value={form.endereco} onChange={(e) => set("endereco", e.target.value)} /></div>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>Cidade</Label><Input value={form.cidade} onChange={(e) => set("cidade", e.target.value)} /></div>
                  <div><Label>Estado</Label><Input value={form.estado} onChange={(e) => set("estado", e.target.value)} /></div>
                </div>
              </TabsContent>

              <TabsContent value="comissao" className="space-y-3 mt-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Tipo de comissão padrão</Label>
                    <Select value={form.tipo_comissao} onValueChange={(v) => set("tipo_comissao", v)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="fixa">Fixa (R$)</SelectItem>
                        <SelectItem value="percentual">Percentual (%)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>{form.tipo_comissao === "percentual" ? "Percentual (%)" : "Valor fixo"}</Label>
                    <CurrencyInput value={form.valor_comissao} onValueChange={(v) => set("valor_comissao", v)} placeholder="Digite o valor" />
                  </div>
                </div>

                {tiposServico.length > 0 && (
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Comissão por serviço</Label>
                    <p className="text-xs text-muted-foreground">Defina comissões específicas por tipo de serviço (sobrepõe a comissão padrão).</p>
                    <div className="border rounded-lg divide-y max-h-48 overflow-y-auto">
                      {tiposServico.map((s: any) => (
                        <div key={s.id} className="flex items-center gap-2 px-3 py-2">
                          <span className="text-sm flex-1 truncate">{s.nome}</span>
                          <Input
                            className="w-20 h-8 text-xs text-right"
                            placeholder="—"
                            value={comissoesPorServico[s.id]?.valor || ""}
                            onChange={(e) => setComissoesPorServico((p) => ({ ...p, [s.id]: { tipo: "fixa", valor: Number(e.target.value) || 0 } }))}
                            inputMode="decimal"
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </TabsContent>
            </Tabs>
            <Button onClick={handleSave} className="w-full mt-3">{editId ? "Salvar" : "Cadastrar"}</Button>
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
