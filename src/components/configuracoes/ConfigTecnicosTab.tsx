import { useState, useCallback } from "react";
import { Plus, Pencil, Search, Trash2, User, MapPin, Briefcase, DollarSign } from "lucide-react";
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
  nome: "", cpf: "", telefone: "", email: "", cargo: "", funcao: "", especialidade: "",
  endereco: "", numero: "", complemento: "", bairro: "", cep: "", cidade: "", estado: "",
  carga_horaria: "", salario_fixo: 0, vale_transporte: 0, vale_alimentacao: 0,
  data_admissao: "",
  tipo_comissao: "fixa" as string, valor_comissao: 0, ativo: true, observacoes: "",
};

export function ConfigTecnicosTab({ funcionarios }: Props) {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<any>({ ...emptyForm });
  const [tab, setTab] = useState("dados");

  const { data: tiposServico = [] } = useQuery({
    queryKey: ["tipos_servico"],
    queryFn: async () => {
      const { data } = await supabase.from("tipos_servico").select("*").eq("ativo", true).order("nome");
      return data || [];
    },
  });

  const [comissoesPorServico, setComissoesPorServico] = useState<Record<string, { tipo: string; valor: number }>>({});
  const [loadingComissoes, setLoadingComissoes] = useState(false);

  const filtered = funcionarios.filter((f) =>
    f.nome?.toLowerCase().includes(search.toLowerCase()) ||
    f.cargo?.toLowerCase().includes(search.toLowerCase()) ||
    f.especialidade?.toLowerCase().includes(search.toLowerCase())
  );

  const set = (k: string, v: any) => setForm((p: any) => ({ ...p, [k]: v }));

  const handleCepData = useCallback((data: CepData) => {
    setForm((p: any) => ({
      ...p,
      endereco: data.logradouro || p.endereco,
      bairro: data.bairro || "",
      cidade: data.localidade || "",
      estado: data.uf || "",
    }));
  }, []);

  const handleSave = async () => {
    if (!form.nome) { toast.error("Nome é obrigatório"); return; }
    const payload: any = {
      nome: form.nome,
      cpf: form.cpf || null,
      telefone: form.telefone || null,
      email: form.email || null,
      cargo: form.cargo || null,
      funcao: form.funcao || null,
      especialidade: form.especialidade || null,
      endereco: form.endereco || null,
      numero: form.numero || null,
      complemento: form.complemento || null,
      bairro: form.bairro || null,
      cep: form.cep || null,
      cidade: form.cidade || null,
      estado: form.estado || null,
      carga_horaria: form.carga_horaria || null,
      salario_fixo: Number(form.salario_fixo) || 0,
      vale_transporte: Number(form.vale_transporte) || 0,
      vale_alimentacao: Number(form.vale_alimentacao) || 0,
      data_admissao: form.data_admissao || null,
      tipo_comissao: form.tipo_comissao,
      valor_comissao: Number(form.valor_comissao) || 0,
      ativo: form.ativo,
      observacoes: form.observacoes || null,
    };

    let funcId = editId;
    if (editId) {
      const { error } = await supabase.from("funcionarios").update(payload).eq("id", editId);
      if (error) { toast.error("Erro ao atualizar"); return; }
    } else {
      const { data, error } = await supabase.from("funcionarios").insert(payload).select("id").single();
      if (error) { toast.error("Erro ao cadastrar"); return; }
      funcId = data.id;
    }

    // Save per-service commissions
    if (funcId) {
      // Delete existing
      await supabase.from("comissoes_servico").delete().eq("funcionario_id", funcId);
      // Insert new ones (only where valor > 0)
      const rows = Object.entries(comissoesPorServico)
        .filter(([, v]) => v.valor > 0)
        .map(([tipoServicoId, v]) => ({
          funcionario_id: funcId!,
          tipo_servico_id: tipoServicoId,
          tipo_comissao: v.tipo as any,
          valor: v.valor,
        }));
      if (rows.length > 0) {
        await supabase.from("comissoes_servico").insert(rows);
      }
    }

    qc.invalidateQueries({ queryKey: ["funcionarios"] });
    toast.success(editId ? "Técnico atualizado" : "Técnico cadastrado");
    setOpen(false); setEditId(null); setForm({ ...emptyForm }); setComissoesPorServico({}); setTab("dados");
  };

  const handleEdit = async (f: any) => {
    setForm({
      nome: f.nome || "", cpf: f.cpf || "", telefone: f.telefone || "", email: f.email || "",
      funcao: f.funcao || "", cargo: f.cargo || "", especialidade: f.especialidade || "",
      endereco: f.endereco || "", numero: f.numero || "", complemento: f.complemento || "",
      bairro: f.bairro || "", cep: f.cep || "", cidade: f.cidade || "", estado: f.estado || "",
      carga_horaria: f.carga_horaria || "", salario_fixo: f.salario_fixo || 0,
      vale_transporte: f.vale_transporte || 0, vale_alimentacao: f.vale_alimentacao || 0,
      data_admissao: f.data_admissao || "",
      tipo_comissao: f.tipo_comissao || "fixa", valor_comissao: f.valor_comissao || 0,
      ativo: f.ativo, observacoes: f.observacoes || "",
    });
    setEditId(f.id); setTab("dados"); setOpen(true);

    // Load per-service commissions
    setLoadingComissoes(true);
    const { data: cs } = await supabase
      .from("comissoes_servico")
      .select("tipo_servico_id, tipo_comissao, valor")
      .eq("funcionario_id", f.id);
    const map: Record<string, { tipo: string; valor: number }> = {};
    (cs || []).forEach((r: any) => { map[r.tipo_servico_id] = { tipo: r.tipo_comissao, valor: Number(r.valor) }; });
    setComissoesPorServico(map);
    setLoadingComissoes(false);
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("funcionarios").update({ deleted_at: new Date().toISOString(), ativo: false }).eq("id", id);
    if (error) { toast.error("Erro ao remover"); return; }
    qc.invalidateQueries({ queryKey: ["funcionarios"] });
    toast.success("Técnico removido");
  };

  const fmt = (v: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

  const custoTotal = Number(form.salario_fixo || 0) + Number(form.vale_transporte || 0) + Number(form.vale_alimentacao || 0);

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-3 justify-between">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar por nome, cargo ou especialidade..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) { setEditId(null); setForm({ ...emptyForm }); setComissoesPorServico({}); setTab("dados"); } }}>
          <DialogTrigger asChild>
            <Button size="sm"><Plus className="h-4 w-4 mr-1" />Novo Técnico</Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editId ? "Editar" : "Novo"} Técnico / Funcionário</DialogTitle>
            </DialogHeader>

            <Tabs value={tab} onValueChange={setTab} className="w-full">
              <TabsList className="w-full grid grid-cols-4">
                <TabsTrigger value="dados" className="text-xs sm:text-sm gap-1">
                  <User className="h-3.5 w-3.5 hidden sm:block" />Dados
                </TabsTrigger>
                <TabsTrigger value="endereco" className="text-xs sm:text-sm gap-1">
                  <MapPin className="h-3.5 w-3.5 hidden sm:block" />Endereço
                </TabsTrigger>
                <TabsTrigger value="profissional" className="text-xs sm:text-sm gap-1">
                  <Briefcase className="h-3.5 w-3.5 hidden sm:block" />Profissional
                </TabsTrigger>
                <TabsTrigger value="comissao" className="text-xs sm:text-sm gap-1">
                  <DollarSign className="h-3.5 w-3.5 hidden sm:block" />Comissão
                </TabsTrigger>
              </TabsList>

              {/* DADOS PESSOAIS */}
              <TabsContent value="dados" className="space-y-4 mt-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <Label>Nome completo *</Label>
                    <Input value={form.nome} onChange={(e) => set("nome", e.target.value)} placeholder="Nome do funcionário" />
                  </div>
                  <div>
                    <Label>CPF</Label>
                    <MaskedInput mask="cpf" value={form.cpf} onValueChange={(_, m) => set("cpf", m)} placeholder="000.000.000-00" />
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <Label>Telefone</Label>
                    <MaskedInput mask="phone" value={form.telefone} onValueChange={(_, m) => set("telefone", m)} placeholder="(00) 00000-0000" />
                  </div>
                  <div>
                    <Label>Email</Label>
                    <Input type="email" value={form.email} onChange={(e) => set("email", e.target.value)} placeholder="email@exemplo.com" />
                  </div>
                </div>
                <div>
                  <Label>Observações</Label>
                  <Textarea value={form.observacoes} onChange={(e) => set("observacoes", e.target.value)} placeholder="Anotações sobre o funcionário..." rows={3} />
                </div>
                <div className="flex items-center gap-2">
                  <Switch checked={form.ativo} onCheckedChange={(v) => set("ativo", v)} />
                  <Label>Funcionário ativo</Label>
                </div>
              </TabsContent>

              {/* ENDEREÇO */}
              <TabsContent value="endereco" className="space-y-4 mt-4">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <CepLookup cep={form.cep} onCepChange={(v) => set("cep", v)} onAddressFound={handleCepData} />
                  <div className="sm:col-span-2">
                    <Label>Rua / Logradouro</Label>
                    <Input value={form.endereco} onChange={(e) => set("endereco", e.target.value)} placeholder="Rua, Avenida..." />
                  </div>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div>
                    <Label>Número</Label>
                    <Input value={form.numero} onChange={(e) => set("numero", e.target.value)} placeholder="Nº" />
                  </div>
                  <div>
                    <Label>Complemento</Label>
                    <Input value={form.complemento} onChange={(e) => set("complemento", e.target.value)} placeholder="Apto, Bloco..." />
                  </div>
                  <div>
                    <Label>Bairro</Label>
                    <Input value={form.bairro} onChange={(e) => set("bairro", e.target.value)} />
                  </div>
                  <div className="hidden sm:block" /> {/* spacer */}
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Cidade</Label>
                    <Input value={form.cidade} onChange={(e) => set("cidade", e.target.value)} />
                  </div>
                  <div>
                    <Label>Estado</Label>
                    <Input value={form.estado} onChange={(e) => set("estado", e.target.value)} maxLength={2} placeholder="UF" />
                  </div>
                </div>
              </TabsContent>

              {/* PROFISSIONAL */}
              <TabsContent value="profissional" className="space-y-4 mt-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <Label>Cargo</Label>
                    <Input value={form.cargo} onChange={(e) => set("cargo", e.target.value)} placeholder="Ex: Técnico Sênior" />
                  </div>
                  <div>
                    <Label>Especialidade</Label>
                    <Input value={form.especialidade} onChange={(e) => set("especialidade", e.target.value)} placeholder="Ex: Telas, Placas, Software" />
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <Label>Carga horária</Label>
                    <Input value={form.carga_horaria} onChange={(e) => set("carga_horaria", e.target.value)} placeholder="Ex: 44h semanais" />
                  </div>
                  <div>
                    <Label>Data de admissão</Label>
                    <Input type="date" value={form.data_admissao} onChange={(e) => set("data_admissao", e.target.value)} />
                  </div>
                </div>

                <div className="border-t pt-4">
                  <h4 className="text-sm font-semibold mb-3">Remuneração e Benefícios</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <Label>Salário fixo</Label>
                      <CurrencyInput value={form.salario_fixo} onValueChange={(v) => set("salario_fixo", v)} placeholder="Salário mensal" />
                    </div>
                    <div>
                      <Label>Vale transporte</Label>
                      <CurrencyInput value={form.vale_transporte} onValueChange={(v) => set("vale_transporte", v)} placeholder="Valor do VT" />
                    </div>
                    <div>
                      <Label>Vale alimentação</Label>
                      <CurrencyInput value={form.vale_alimentacao} onValueChange={(v) => set("vale_alimentacao", v)} placeholder="Valor do VA" />
                    </div>
                  </div>
                  {custoTotal > 0 && (
                    <div className="mt-3 p-3 bg-muted/50 rounded-lg flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">Custo total mensal</span>
                      <span className="font-semibold text-base">{fmt(custoTotal)}</span>
                    </div>
                  )}
                </div>
              </TabsContent>

              {/* COMISSÃO */}
              <TabsContent value="comissao" className="space-y-4 mt-4">
                <div className="p-3 bg-muted/50 rounded-lg space-y-1">
                  <p className="text-xs font-medium text-muted-foreground">Comissão padrão (fallback)</p>
                  <p className="text-xs text-muted-foreground">Usada quando não houver comissão específica para o serviço.</p>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <Label>Tipo padrão</Label>
                    <Select value={form.tipo_comissao} onValueChange={(v) => set("tipo_comissao", v)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="fixa">Fixa (R$)</SelectItem>
                        <SelectItem value="percentual">Percentual (%)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>{form.tipo_comissao === "percentual" ? "Percentual (%)" : "Valor fixo (R$)"}</Label>
                    <CurrencyInput value={form.valor_comissao} onValueChange={(v) => set("valor_comissao", v)} placeholder="Valor fallback" />
                  </div>
                </div>

                <div className="border-t pt-4 space-y-2">
                  <Label className="text-sm font-semibold">Comissões por serviço</Label>
                  <p className="text-xs text-muted-foreground">Defina comissões específicas por tipo de serviço. Estas sobrepõem a comissão padrão.</p>

                  {tiposServico.length === 0 ? (
                    <p className="text-sm text-muted-foreground py-4 text-center">Nenhum tipo de serviço cadastrado.</p>
                  ) : (
                    <div className="border rounded-lg overflow-hidden">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="bg-muted/50 border-b">
                            <th className="text-left p-2 font-medium">Serviço</th>
                            <th className="text-left p-2 font-medium w-32">Tipo</th>
                            <th className="text-right p-2 font-medium w-28">Valor</th>
                            <th className="p-2 w-10"></th>
                          </tr>
                        </thead>
                        <tbody className="divide-y">
                          {tiposServico.map((s: any) => {
                            const cs = comissoesPorServico[s.id];
                            return (
                              <tr key={s.id} className={cs ? "bg-primary/5" : ""}>
                                <td className="p-2 text-sm">{s.nome}</td>
                                <td className="p-2">
                                  <Select
                                    value={cs?.tipo || "fixa"}
                                    onValueChange={(v) => setComissoesPorServico((p) => ({
                                      ...p,
                                      [s.id]: { tipo: v, valor: cs?.valor || 0 },
                                    }))}
                                  >
                                    <SelectTrigger className="h-8 text-xs">
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="fixa">R$ Fixo</SelectItem>
                                      <SelectItem value="percentual">%</SelectItem>
                                    </SelectContent>
                                  </Select>
                                </td>
                                <td className="p-2">
                                  <Input
                                    className="h-8 text-xs text-right w-full"
                                    placeholder="—"
                                    value={cs?.valor || ""}
                                    onChange={(e) => {
                                      const val = Number(e.target.value) || 0;
                                      setComissoesPorServico((p) => ({
                                        ...p,
                                        [s.id]: { tipo: p[s.id]?.tipo || "fixa", valor: val },
                                      }));
                                    }}
                                    inputMode="decimal"
                                  />
                                </td>
                                <td className="p-2 text-center">
                                  {cs && cs.valor > 0 && (
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-7 w-7 text-destructive"
                                      onClick={() => {
                                        setComissoesPorServico((p) => {
                                          const next = { ...p };
                                          delete next[s.id];
                                          return next;
                                        });
                                      }}
                                    >
                                      <Trash2 className="h-3.5 w-3.5" />
                                    </Button>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </TabsContent>
            </Tabs>

            <div className="flex gap-2 mt-4 pt-3 border-t">
              <Button onClick={handleSave} className="flex-1">{editId ? "Salvar alterações" : "Cadastrar"}</Button>
              <Button variant="outline" onClick={() => { setOpen(false); setEditId(null); setForm({ ...emptyForm }); }}>Cancelar</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* LISTA */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="text-left p-3 font-medium">Nome</th>
                  <th className="text-left p-3 font-medium hidden md:table-cell">Cargo</th>
                  <th className="text-left p-3 font-medium hidden lg:table-cell">Especialidade</th>
                  <th className="text-left p-3 font-medium hidden lg:table-cell">Salário</th>
                  <th className="text-left p-3 font-medium hidden md:table-cell">Comissão</th>
                  <th className="text-left p-3 font-medium">Status</th>
                  <th className="p-3 w-20"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((f) => (
                  <tr key={f.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                    <td className="p-3">
                      <div className="font-medium">{f.nome}</div>
                      <div className="text-xs text-muted-foreground md:hidden">{f.cargo || "—"}</div>
                    </td>
                    <td className="p-3 hidden md:table-cell text-muted-foreground">{f.cargo || "—"}</td>
                    <td className="p-3 hidden lg:table-cell text-muted-foreground">{f.especialidade || f.funcao || "—"}</td>
                    <td className="p-3 hidden lg:table-cell">{f.salario_fixo > 0 ? fmt(f.salario_fixo) : "—"}</td>
                    <td className="p-3 hidden md:table-cell">
                      {f.tipo_comissao === "percentual" ? `${f.valor_comissao}%` : fmt(f.valor_comissao)}
                    </td>
                    <td className="p-3">
                      <Badge variant={f.ativo ? "default" : "secondary"}>{f.ativo ? "Ativo" : "Inativo"}</Badge>
                    </td>
                    <td className="p-3 text-right">
                      <div className="flex gap-1 justify-end">
                        <Button variant="ghost" size="icon" onClick={() => handleEdit(f)}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive" onClick={() => handleDelete(f.id)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr><td colSpan={7} className="p-8 text-center text-muted-foreground">Nenhum técnico cadastrado</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
