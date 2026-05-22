import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { formatCurrency } from "@/lib/format";
import { useEmpresa } from "@/contexts/EmpresaContext";
import { Plus, Wallet, TrendingUp, TrendingDown, Users } from "lucide-react";

const fmtC = (centavos?: number | null) => formatCurrency((centavos ?? 0) / 100);

type DashJson = {
  ativo?: boolean;
  saldo_total_devido_centavos?: number;
  qtd_clientes_com_saldo?: number;
  creditado_mes_centavos?: number;
  qtd_os_creditadas_mes?: number;
  usado_mes_centavos?: number;
  qtd_os_usaram_mes?: number;
  top_clientes?: Array<any>;
  movimentacoes_recentes?: Array<any>;
};

const tipoLabel: Record<string, string> = {
  credito_os: "Crédito (OS)",
  debito_uso_os: "Uso em OS",
  credito_ajuste: "Crédito manual",
  debito_ajuste: "Débito manual",
  debito_estorno_os: "Estorno",
};

const tipoRegraLabel: Record<string, string> = {
  pct_global: "Global",
  pct_grupo: "Grupo",
  pct_cliente: "Cliente",
  valor_fixo_cliente: "Valor fixo (cliente)",
  pct_tipo_servico: "Tipo de serviço",
};

export default function Cashback() {
  const qc = useQueryClient();
  const { empresa } = useEmpresa();
  const empresaId = empresa?.id;

  const { data, isLoading } = useQuery({
    queryKey: ["cashback-dashboard"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_cashback_empresa_dashboard");
      if (error) throw error;
      return data as unknown as DashJson;
    },
  });

  const { data: config } = useQuery({
    queryKey: ["cashback-config", empresaId],
    enabled: !!empresaId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cashback_config")
        .select("*")
        .eq("empresa_id", empresaId!)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const toggleAtivo = useMutation({
    mutationFn: async (ativo: boolean) => {
      if (!empresaId) return;
      const { error } = await supabase
        .from("cashback_config")
        .update({ ativo, updated_at: new Date().toISOString() })
        .eq("empresa_id", empresaId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["cashback-config"] });
      qc.invalidateQueries({ queryKey: ["cashback-dashboard"] });
      toast.success("Configuração atualizada");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const [novaRegraOpen, setNovaRegraOpen] = useState(false);
  const [ajusteOpen, setAjusteOpen] = useState(false);

  return (
    <div className="container mx-auto p-6 space-y-6">
      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Cashback</h1>
          <p className="text-muted-foreground">Programa de fidelidade para clientes e lojistas B2B</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 rounded-lg border px-3 py-2">
            <Switch
              checked={config?.ativo ?? false}
              onCheckedChange={(v) => toggleAtivo.mutate(v)}
              disabled={toggleAtivo.isPending}
            />
            <Label className="text-sm">{config?.ativo ? "Ativo" : "Inativo"}</Label>
          </div>
          <Button variant="outline" onClick={() => setAjusteOpen(true)}>
            Ajuste manual
          </Button>
          <Button onClick={() => setNovaRegraOpen(true)}>
            <Plus className="w-4 h-4 mr-2" /> Nova regra
          </Button>
        </div>
      </header>

      <div className="grid gap-4 md:grid-cols-3">
        <Kpi
          icon={<Wallet className="w-5 h-5 text-primary" />}
          title="Saldo total devido"
          value={fmtC(data?.saldo_total_devido_centavos)}
          sub={`${data?.qtd_clientes_com_saldo ?? 0} clientes com saldo`}
          loading={isLoading}
        />
        <Kpi
          icon={<TrendingUp className="w-5 h-5 text-emerald-500" />}
          title="Creditado este mês"
          value={fmtC(data?.creditado_mes_centavos)}
          sub={`${data?.qtd_os_creditadas_mes ?? 0} OS`}
          loading={isLoading}
        />
        <Kpi
          icon={<TrendingDown className="w-5 h-5 text-orange-500" />}
          title="Usado este mês"
          value={fmtC(data?.usado_mes_centavos)}
          sub={`${data?.qtd_os_usaram_mes ?? 0} OS`}
          loading={isLoading}
        />
      </div>

      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Visão geral</TabsTrigger>
          <TabsTrigger value="regras">Regras</TabsTrigger>
          <TabsTrigger value="saldos">Saldos</TabsTrigger>
          <TabsTrigger value="movs">Movimentações</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="w-4 h-4" /> Top clientes com saldo
              </CardTitle>
            </CardHeader>
            <CardContent>
              {(data?.top_clientes ?? []).length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhum cliente com saldo ainda.</p>
              ) : (
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                  {(data?.top_clientes ?? []).map((c: any) => (
                    <div key={c.cliente_id} className="rounded-lg border p-3 flex items-center justify-between">
                      <div className="min-w-0">
                        <div className="font-medium truncate">{c.nome}</div>
                        <div className="text-xs text-muted-foreground truncate">
                          {c.tipo_cliente}{c.grupo_nome ? ` · ${c.grupo_nome}` : ""}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-semibold text-primary">{fmtC(c.saldo_centavos)}</div>
                        <div className="text-xs text-muted-foreground">
                          +{fmtC(c.total_recebido_centavos)} / −{fmtC(c.total_usado_centavos)}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Movimentações recentes</CardTitle></CardHeader>
            <CardContent>
              <MovsTable movs={data?.movimentacoes_recentes ?? []} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="regras">
          <RegrasTab onNova={() => setNovaRegraOpen(true)} />
        </TabsContent>

        <TabsContent value="saldos">
          <SaldosTab />
        </TabsContent>

        <TabsContent value="movs">
          <Card><CardContent className="pt-6"><MovsTable movs={data?.movimentacoes_recentes ?? []} /></CardContent></Card>
        </TabsContent>
      </Tabs>

      <NovaRegraDialog open={novaRegraOpen} onClose={() => setNovaRegraOpen(false)} />
      <AjusteManualDialog open={ajusteOpen} onClose={() => setAjusteOpen(false)} />
    </div>
  );
}

function Kpi({ icon, title, value, sub, loading }: any) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">{title}</p>
            {loading ? <Skeleton className="h-7 w-24" /> : <p className="text-2xl font-bold">{value}</p>}
            <p className="text-xs text-muted-foreground">{sub}</p>
          </div>
          <div className="rounded-lg bg-muted p-2">{icon}</div>
        </div>
      </CardContent>
    </Card>
  );
}

function MovsTable({ movs }: { movs: any[] }) {
  if (!movs.length) return <p className="text-sm text-muted-foreground">Nenhuma movimentação.</p>;
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Data</TableHead>
          <TableHead>Cliente</TableHead>
          <TableHead>Tipo</TableHead>
          <TableHead>OS</TableHead>
          <TableHead className="text-right">Valor</TableHead>
          <TableHead className="text-right">Saldo após</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {movs.map((m) => (
          <TableRow key={m.id}>
            <TableCell className="whitespace-nowrap">{new Date(m.created_at).toLocaleDateString("pt-BR")}</TableCell>
            <TableCell className="max-w-[200px] truncate">{m.cliente_nome}</TableCell>
            <TableCell>
              <Badge variant={m.tipo.startsWith("credito") ? "default" : "secondary"}>
                {tipoLabel[m.tipo] ?? m.tipo}
              </Badge>
            </TableCell>
            <TableCell>{m.ordem_numero ? `#${m.ordem_numero}` : "—"}</TableCell>
            <TableCell className={`text-right font-medium ${m.tipo.startsWith("credito") ? "text-emerald-600" : "text-orange-600"}`}>
              {m.tipo.startsWith("credito") ? "+" : "−"}{fmtC(m.valor_centavos)}
            </TableCell>
            <TableCell className="text-right">{fmtC(m.saldo_apos_centavos)}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function RegrasTab({ onNova }: { onNova: () => void }) {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["cashback-regras"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cashback_regras")
        .select("*, target_cliente:clientes(nome), target_grupo:lojista_grupos(nome), target_tipo_servico:tipos_servico(nome)")
        .order("prioridade")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as any[];
    },
  });

  const toggle = useMutation({
    mutationFn: async ({ id, ativo }: { id: string; ativo: boolean }) => {
      const { error } = await supabase.from("cashback_regras").update({ ativo }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["cashback-regras"] });
      toast.success("Regra atualizada");
    },
  });

  const remover = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("cashback_regras").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["cashback-regras"] });
      toast.success("Regra removida");
    },
  });

  if (isLoading) return <Skeleton className="h-40" />;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Regras de cashback</CardTitle>
        <Button size="sm" onClick={onNova}><Plus className="w-4 h-4 mr-2" />Nova regra</Button>
      </CardHeader>
      <CardContent>
        {!data?.length ? (
          <p className="text-sm text-muted-foreground">Nenhuma regra cadastrada. Crie uma para começar.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Prioridade</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Alvo</TableHead>
                <TableHead className="text-right">Valor</TableHead>
                <TableHead>Ativa</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((r) => (
                <TableRow key={r.id}>
                  <TableCell><Badge variant="outline">P{r.prioridade}</Badge></TableCell>
                  <TableCell>{tipoRegraLabel[r.tipo] ?? r.tipo}</TableCell>
                  <TableCell className="max-w-[240px] truncate">
                    {r.target_cliente?.nome || r.target_grupo?.nome || r.target_tipo_servico?.nome || "Todos"}
                  </TableCell>
                  <TableCell className="text-right">
                    {r.tipo === "valor_fixo_cliente" ? fmtC(r.valor_fixo_centavos) : `${r.percentual}%`}
                  </TableCell>
                  <TableCell>
                    <Switch checked={r.ativo} onCheckedChange={(v) => toggle.mutate({ id: r.id, ativo: v })} />
                  </TableCell>
                  <TableCell className="text-right">
                    <Button size="sm" variant="ghost" onClick={() => {
                      if (confirm("Remover esta regra?")) remover.mutate(r.id);
                    }}>Remover</Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}

function SaldosTab() {
  const { data, isLoading } = useQuery({
    queryKey: ["cashback-saldos-all"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cashback_saldos")
        .select("*, cliente:clientes(nome, tipo_cliente)")
        .order("saldo_centavos", { ascending: false });
      if (error) throw error;
      return data as any[];
    },
  });
  if (isLoading) return <Skeleton className="h-40" />;
  return (
    <Card>
      <CardContent className="pt-6">
        {!data?.length ? (
          <p className="text-sm text-muted-foreground">Nenhum saldo registrado.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Cliente</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead className="text-right">Saldo</TableHead>
                <TableHead className="text-right">Recebido</TableHead>
                <TableHead className="text-right">Usado</TableHead>
                <TableHead>Última mov.</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((s) => (
                <TableRow key={s.id}>
                  <TableCell>{s.cliente?.nome}</TableCell>
                  <TableCell><Badge variant="outline">{s.cliente?.tipo_cliente}</Badge></TableCell>
                  <TableCell className="text-right font-semibold text-primary">{fmtC(s.saldo_centavos)}</TableCell>
                  <TableCell className="text-right text-emerald-600">{fmtC(s.total_recebido_centavos)}</TableCell>
                  <TableCell className="text-right text-orange-600">{fmtC(s.total_usado_centavos)}</TableCell>
                  <TableCell>{s.ultima_movimentacao_em ? new Date(s.ultima_movimentacao_em).toLocaleDateString("pt-BR") : "—"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}

function NovaRegraDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const qc = useQueryClient();
  const { empresa } = useEmpresa();
  const [tipo, setTipo] = useState<string>("pct_global");
  const [targetCliente, setTargetCliente] = useState<string>("");
  const [targetGrupo, setTargetGrupo] = useState<string>("");
  const [targetTipoServ, setTargetTipoServ] = useState<string>("");
  const [percentual, setPercentual] = useState<string>("5");
  const [valorFixo, setValorFixo] = useState<string>("");
  const [observacoes, setObservacoes] = useState<string>("");

  const { data: clientes } = useQuery({
    queryKey: ["cashback-clientes-opt"],
    enabled: open,
    queryFn: async () => {
      const { data } = await supabase.from("clientes").select("id, nome, tipo_cliente").order("nome").limit(500);
      return data ?? [];
    },
  });
  const { data: grupos } = useQuery({
    queryKey: ["cashback-grupos-opt"],
    enabled: open,
    queryFn: async () => {
      const { data } = await supabase.from("lojista_grupos").select("id, nome").order("nome");
      return data ?? [];
    },
  });
  const { data: tiposServ } = useQuery({
    queryKey: ["cashback-tiposserv-opt"],
    enabled: open,
    queryFn: async () => {
      const { data } = await supabase.from("tipos_servico").select("id, nome").eq("ativo", true).order("nome");
      return data ?? [];
    },
  });

  const salvar = useMutation({
    mutationFn: async () => {
      if (!empresa?.id) throw new Error("Empresa não identificada");
      const payload: any = { empresa_id: empresa.id, tipo, ativo: true, observacoes: observacoes || null };
      if (tipo === "pct_cliente" || tipo === "valor_fixo_cliente") payload.target_cliente_id = targetCliente;
      if (tipo === "pct_grupo") payload.target_grupo_id = targetGrupo;
      if (tipo === "pct_tipo_servico") payload.target_tipo_servico_id = targetTipoServ;
      if (tipo === "valor_fixo_cliente") {
        payload.valor_fixo_centavos = Math.round(parseFloat(valorFixo || "0") * 100);
      } else {
        payload.percentual = parseFloat(percentual || "0");
      }
      const { error } = await supabase.from("cashback_regras").insert(payload);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["cashback-regras"] });
      qc.invalidateQueries({ queryKey: ["cashback-dashboard"] });
      toast.success("Regra criada");
      onClose();
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Nova regra de cashback</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1">
            <Label>Tipo</Label>
            <Select value={tipo} onValueChange={setTipo}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="pct_global">Global (todos os clientes)</SelectItem>
                <SelectItem value="pct_grupo">Por grupo de lojistas</SelectItem>
                <SelectItem value="pct_cliente">Cliente específico (%)</SelectItem>
                <SelectItem value="valor_fixo_cliente">Cliente específico (R$ fixo)</SelectItem>
                <SelectItem value="pct_tipo_servico">Por tipo de serviço</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {(tipo === "pct_cliente" || tipo === "valor_fixo_cliente") && (
            <div className="space-y-1">
              <Label>Cliente</Label>
              <Select value={targetCliente} onValueChange={setTargetCliente}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  {clientes?.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}
          {tipo === "pct_grupo" && (
            <div className="space-y-1">
              <Label>Grupo</Label>
              <Select value={targetGrupo} onValueChange={setTargetGrupo}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  {grupos?.map((g: any) => <SelectItem key={g.id} value={g.id}>{g.nome}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}
          {tipo === "pct_tipo_servico" && (
            <div className="space-y-1">
              <Label>Tipo de serviço</Label>
              <Select value={targetTipoServ} onValueChange={setTargetTipoServ}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  {tiposServ?.map((t: any) => <SelectItem key={t.id} value={t.id}>{t.nome}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}

          {tipo === "valor_fixo_cliente" ? (
            <div className="space-y-1">
              <Label>Valor fixo por OS (R$)</Label>
              <Input type="number" step="0.01" value={valorFixo} onChange={(e) => setValorFixo(e.target.value)} />
            </div>
          ) : (
            <div className="space-y-1">
              <Label>Percentual (%)</Label>
              <Input type="number" step="0.01" min="0" max="100" value={percentual} onChange={(e) => setPercentual(e.target.value)} />
            </div>
          )}

          <div className="space-y-1">
            <Label>Observações</Label>
            <Textarea value={observacoes} onChange={(e) => setObservacoes(e.target.value)} rows={2} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button onClick={() => salvar.mutate()} disabled={salvar.isPending}>Salvar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function AjusteManualDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const qc = useQueryClient();
  const [clienteId, setClienteId] = useState<string>("");
  const [valor, setValor] = useState<string>("");
  const [justificativa, setJustificativa] = useState<string>("");

  const { data: clientes } = useQuery({
    queryKey: ["cashback-clientes-opt-ajuste"],
    enabled: open,
    queryFn: async () => {
      const { data } = await supabase.from("clientes").select("id, nome").order("nome").limit(500);
      return data ?? [];
    },
  });

  const ajustar = useMutation({
    mutationFn: async () => {
      const centavos = Math.round(parseFloat(valor || "0") * 100);
      const { error } = await supabase.rpc("ajustar_cashback_cliente", {
        p_cliente_id: clienteId,
        p_valor_centavos: centavos,
        p_justificativa: justificativa,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["cashback-dashboard"] });
      qc.invalidateQueries({ queryKey: ["cashback-saldos-all"] });
      toast.success("Ajuste aplicado");
      setValor(""); setJustificativa(""); setClienteId("");
      onClose();
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Ajuste manual de cashback</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1">
            <Label>Cliente</Label>
            <Select value={clienteId} onValueChange={setClienteId}>
              <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>
                {clientes?.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>Valor (R$) — use negativo para debitar</Label>
            <Input type="number" step="0.01" value={valor} onChange={(e) => setValor(e.target.value)} placeholder="ex: 50 ou -20" />
          </div>
          <div className="space-y-1">
            <Label>Justificativa</Label>
            <Textarea value={justificativa} onChange={(e) => setJustificativa(e.target.value)} rows={2} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button onClick={() => ajustar.mutate()} disabled={ajustar.isPending || !clienteId || !valor || !justificativa}>
            Aplicar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
