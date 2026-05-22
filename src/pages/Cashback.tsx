import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Switch } from "@/components/ui/switch";
import { formatCurrency } from "@/lib/format";
import { toast } from "@/hooks/use-toast";
import { Wallet, Users, TrendingUp, TrendingDown, Plus, Settings, Power } from "lucide-react";

const fmtC = (c?: number | null) => formatCurrency((c ?? 0) / 100);

const tipoLabel: Record<string, string> = {
  credito_os: "Crédito OS",
  debito_uso_os: "Uso em OS",
  credito_ajuste: "Crédito manual",
  debito_ajuste: "Débito manual",
  debito_estorno_os: "Estorno",
};

export default function Cashback() {
  const nav = useNavigate();
  const qc = useQueryClient();
  const [openAdd, setOpenAdd] = useState(false);
  const [search, setSearch] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["cashback-dashboard"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_cashback_empresa_dashboard" as any);
      if (error) throw error;
      return data as any;
    },
  });

  const { data: config } = useQuery({
    queryKey: ["cashback-config"],
    queryFn: async () => {
      const { data } = await (supabase as any).from("cashback_config").select("*").maybeSingle();
      return data;
    },
  });

  const toggleConfig = useMutation({
    mutationFn: async (ativo: boolean) => {
      const { error } = await (supabase as any).from("cashback_config")
        .update({ ativo }).eq("id", config?.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["cashback-config"] });
      toast({ title: "Configuração salva" });
    },
  });

  const desativar = useMutation({
    mutationFn: async (cliente_id: string) => {
      const { error } = await supabase.rpc("cashback_ativar_cliente" as any, {
        p_cliente_id: cliente_id, p_ativar: false,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["cashback-dashboard"] });
      toast({ title: "Cliente desativado" });
    },
  });

  if (isLoading) return <div className="container mx-auto p-6"><Skeleton className="h-96" /></div>;
  if (data?.erro) return <div className="container mx-auto p-6">Erro: {data.erro}</div>;

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Cashback</h1>
          <p className="text-muted-foreground">Programa de fidelidade por categoria de serviço</p>
        </div>
        <div className="flex items-center gap-3">
          {config && (
            <div className="flex items-center gap-2 px-3 py-2 border rounded-md">
              <span className="text-sm">Sistema {config.ativo ? "ativo" : "desativado"}</span>
              <Switch checked={!!config.ativo} onCheckedChange={(v) => toggleConfig.mutate(v)} />
            </div>
          )}
          <Button onClick={() => setOpenAdd(true)}>
            <Plus className="w-4 h-4 mr-2" /> Ativar cliente
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <Wallet className="w-5 h-5 text-primary" />
              <div>
                <p className="text-xs text-muted-foreground">Saldo total devido</p>
                <p className="text-2xl font-bold">{fmtC(data?.saldo_total_devido_centavos)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <Users className="w-5 h-5 text-primary" />
              <div>
                <p className="text-xs text-muted-foreground">Clientes ativos</p>
                <p className="text-2xl font-bold">{data?.qtd_clientes_ativos ?? 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <TrendingUp className="w-5 h-5 text-emerald-600" />
              <div>
                <p className="text-xs text-muted-foreground">Creditado no mês</p>
                <p className="text-2xl font-bold text-emerald-600">{fmtC(data?.creditado_mes_centavos)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <TrendingDown className="w-5 h-5 text-orange-600" />
              <div>
                <p className="text-xs text-muted-foreground">Usado no mês</p>
                <p className="text-2xl font-bold text-orange-600">{fmtC(data?.usado_mes_centavos)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle>Clientes no cashback</CardTitle></CardHeader>
        <CardContent>
          {!(data?.clientes_ativos ?? []).length ? (
            <p className="text-sm text-muted-foreground">Nenhum cliente ativado ainda.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Taxas</TableHead>
                  <TableHead className="text-right">Saldo</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-[180px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.clientes_ativos.map((c: any) => (
                  <TableRow key={c.cliente_id}>
                    <TableCell>
                      <div className="font-medium">{c.nome}</div>
                      <div className="text-xs text-muted-foreground">
                        {c.tipo_cliente}{c.grupo_nome ? ` · ${c.grupo_nome}` : ""}
                      </div>
                    </TableCell>
                    <TableCell className="text-sm max-w-md truncate">
                      {c.taxas_resumo ?? <span className="text-muted-foreground">sem taxas</span>}
                    </TableCell>
                    <TableCell className="text-right font-medium">{fmtC(c.saldo_centavos)}</TableCell>
                    <TableCell>
                      {c.ativo
                        ? <Badge variant="default">Ativo</Badge>
                        : <Badge variant="secondary">Inativo</Badge>}
                    </TableCell>
                    <TableCell className="text-right space-x-1">
                      <Button size="sm" variant="outline" onClick={() => nav(`/cashback/cliente/${c.cliente_id}`)}>
                        <Settings className="w-3 h-3 mr-1" /> Config
                      </Button>
                      {c.ativo && (
                        <Button size="sm" variant="ghost" onClick={() => {
                          if (confirm(`Desativar cashback de ${c.nome}?`)) desativar.mutate(c.cliente_id);
                        }}>
                          <Power className="w-3 h-3" />
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Movimentações recentes</CardTitle></CardHeader>
        <CardContent>
          {!(data?.movimentacoes_recentes ?? []).length ? (
            <p className="text-sm text-muted-foreground">Sem movimentações.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Descrição</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.movimentacoes_recentes.map((m: any) => (
                  <TableRow key={m.id}>
                    <TableCell className="text-xs">{new Date(m.created_at).toLocaleDateString("pt-BR")}</TableCell>
                    <TableCell>{m.cliente_nome}</TableCell>
                    <TableCell>
                      <Badge variant={m.tipo?.startsWith("credito") ? "default" : "secondary"}>
                        {tipoLabel[m.tipo] ?? m.tipo}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs">
                      {m.descricao}{m.ordem_numero ? ` · OS #${m.ordem_numero}` : ""}
                    </TableCell>
                    <TableCell className={`text-right font-medium ${m.tipo?.startsWith("credito") ? "text-emerald-600" : "text-orange-600"}`}>
                      {m.tipo?.startsWith("credito") ? "+" : "−"}{fmtC(m.valor_centavos)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <AtivarClienteDialog open={openAdd} onOpenChange={setOpenAdd} search={search} setSearch={setSearch}
        ativosIds={(data?.clientes_ativos ?? []).map((c: any) => c.cliente_id)} />
    </div>
  );
}

function AtivarClienteDialog({ open, onOpenChange, search, setSearch, ativosIds }: any) {
  const nav = useNavigate();
  const qc = useQueryClient();

  const { data: clientes } = useQuery({
    queryKey: ["clientes-busca-cashback", search],
    enabled: open,
    queryFn: async () => {
      let q = (supabase as any).from("clientes").select("id, nome, tipo_cliente").limit(30).order("nome");
      if (search.trim()) q = q.ilike("nome", `%${search}%`);
      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    },
  });

  const ativar = useMutation({
    mutationFn: async (cliente_id: string) => {
      const { error } = await supabase.rpc("cashback_ativar_cliente" as any, {
        p_cliente_id: cliente_id, p_ativar: true,
      });
      if (error) throw error;
      return cliente_id;
    },
    onSuccess: (cliente_id) => {
      qc.invalidateQueries({ queryKey: ["cashback-dashboard"] });
      onOpenChange(false);
      nav(`/cashback/cliente/${cliente_id}`);
    },
  });

  const ativosSet = useMemo(() => new Set(ativosIds), [ativosIds]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>Ativar cashback para um cliente</DialogTitle></DialogHeader>
        <Input placeholder="Buscar por nome..." value={search} onChange={(e) => setSearch(e.target.value)} />
        <div className="max-h-96 overflow-y-auto space-y-1">
          {(clientes ?? []).map((c: any) => {
            const ativo = ativosSet.has(c.id);
            return (
              <button key={c.id} disabled={ativo || ativar.isPending}
                onClick={() => ativar.mutate(c.id)}
                className="w-full text-left p-3 border rounded hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed">
                <div className="flex justify-between items-center">
                  <div>
                    <div className="font-medium">{c.nome}</div>
                    <div className="text-xs text-muted-foreground">{c.tipo_cliente}</div>
                  </div>
                  {ativo && <Badge variant="secondary">Já ativo</Badge>}
                </div>
              </button>
            );
          })}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
