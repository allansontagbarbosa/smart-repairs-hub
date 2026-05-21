import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2, Wallet, Shield, TrendingUp, ArrowDownToLine, ArrowUpFromLine, User, ChevronLeft } from "lucide-react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";

const brl = (centavos: number | null | undefined) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(
    Number(centavos ?? 0) / 100,
  );

const fmtData = (iso?: string | null) =>
  iso ? new Date(iso).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" }) : "—";

const fmtMes = (ym?: string | null) => {
  if (!ym) return "—";
  const [y, m] = ym.split("-");
  return `${m}/${y}`;
};

const TIPO_LABEL: Record<string, { label: string; tone: "credit" | "debit" }> = {
  credito_distribuicao: { label: "Distribuição", tone: "credit" },
  credito_adiantamento: { label: "Adiantamento", tone: "credit" },
  credito_ajuste: { label: "Ajuste +", tone: "credit" },
  debito_pro_labore: { label: "Pró-labore", tone: "debit" },
  debito_retirada: { label: "Retirada", tone: "debit" },
  debito_ajuste: { label: "Ajuste −", tone: "debit" },
};

type Filtro = "todos" | "creditos" | "debitos" | "pro_labore";

export default function PainelSocioContas() {
  const queryClient = useQueryClient();
  const [retirarOpen, setRetirarOpen] = useState(false);
  const [retirarValor, setRetirarValor] = useState("");
  const [retirarTipo, setRetirarTipo] = useState<"debito_pro_labore" | "debito_retirada">("debito_pro_labore");
  const [retirarDescricao, setRetirarDescricao] = useState("");
  const [retirarAta, setRetirarAta] = useState("");
  const [fecharMesAlvo, setFecharMesAlvo] = useState<string | null>(null);
  const [filtro, setFiltro] = useState<Filtro>("todos");

  const { data: caixa, isLoading: loadingCaixa } = useQuery({
    queryKey: ["caixa-empresa"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_caixa_empresa_completo" as any);
      if (error) throw error;
      return data as any;
    },
  });

  const { data: minhaConta, isLoading: loadingConta } = useQuery({
    queryKey: ["conta-socio", "me"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_conta_socio" as any, { p_socio_id: null } as any);
      if (error) throw error;
      return data as any;
    },
  });

  const { data: distribuicoes } = useQuery({
    queryKey: ["distribuicoes-mensais"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("distribuicoes_mensais" as any)
        .select("*")
        .order("mes_referencia", { ascending: false })
        .limit(12);
      if (error) throw error;
      return (data as any[]) || [];
    },
  });

  const retirarMutation = useMutation({
    mutationFn: async () => {
      const valor = Number(retirarValor.replace(",", "."));
      if (!valor || valor <= 0) throw new Error("Valor inválido");
      const socioId = minhaConta?.socio?.id;
      if (!socioId) throw new Error("Sócio não encontrado");
      const { data, error } = await supabase.rpc("registrar_retirada_socio" as any, {
        p_socio_id: socioId,
        p_valor_centavos: Math.round(valor * 100),
        p_tipo: retirarTipo,
        p_descricao: retirarDescricao || "Retirada",
        p_ata_referencia: retirarAta || null,
      } as any);
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success("Retirada registrada");
      queryClient.invalidateQueries({ queryKey: ["caixa-empresa"] });
      queryClient.invalidateQueries({ queryKey: ["conta-socio"] });
      setRetirarOpen(false);
      setRetirarValor("");
      setRetirarDescricao("");
      setRetirarAta("");
    },
    onError: (err: any) => toast.error(err?.message || "Erro ao registrar retirada"),
  });

  const fecharMesMutation = useMutation({
    mutationFn: async (mes: string) => {
      const { data, error } = await supabase.rpc("fechar_mes_distribuicao" as any, {
        p_mes_referencia: mes,
      } as any);
      if (error) throw error;
      return data;
    },
    onSuccess: (data: any) => {
      const dist = Number(data?.distribuivel_centavos ?? 0) / 100;
      toast.success(`Mês fechado · R$ ${dist.toLocaleString("pt-BR", { minimumFractionDigits: 2 })} distribuídos`);
      queryClient.invalidateQueries({ queryKey: ["caixa-empresa"] });
      queryClient.invalidateQueries({ queryKey: ["conta-socio"] });
      queryClient.invalidateQueries({ queryKey: ["distribuicoes-mensais"] });
      setFecharMesAlvo(null);
    },
    onError: (err: any) => toast.error(err?.message || "Erro ao fechar mês"),
  });

  const saldoAtualSocio = Number(minhaConta?.conta?.saldo_centavos ?? 0);
  const valorRetiradaNum = Number((retirarValor || "0").replace(",", ".")) || 0;
  const saldoPosCentavos = saldoAtualSocio - Math.round(valorRetiradaNum * 100);
  const valorValido = valorRetiradaNum > 0 && saldoPosCentavos >= 0;

  const extratoFiltrado = useMemo(() => {
    const itens = (minhaConta?.extrato || []) as any[];
    if (filtro === "todos") return itens;
    if (filtro === "creditos") return itens.filter((i) => i.tipo?.startsWith("credito"));
    if (filtro === "debitos") return itens.filter((i) => i.tipo?.startsWith("debito"));
    if (filtro === "pro_labore") return itens.filter((i) => i.tipo === "debito_pro_labore");
    return itens;
  }, [minhaConta, filtro]);

  if (loadingCaixa || loadingConta) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (caixa?.erro) {
    return <div className="p-6 text-muted-foreground">Não foi possível carregar o caixa: {String(caixa.erro)}</div>;
  }

  const c = caixa?.caixa || {};
  const socios = (caixa?.socios || []) as any[];

  // Sugestão de próximo mês a fechar (mês anterior se ainda não fechado)
  const hoje = new Date();
  const mesAnterior = new Date(hoje.getFullYear(), hoje.getMonth() - 1, 1);
  const mesAnteriorYM = `${mesAnterior.getFullYear()}-${String(mesAnterior.getMonth() + 1).padStart(2, "0")}`;
  const jaFechado = (distribuicoes || []).some(
    (d) => d.mes_referencia === mesAnteriorYM && d.status === "fechado",
  );

  return (
    <div className="p-6 space-y-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-end justify-between gap-3 flex-wrap">
        <div>
          <Link
            to="/painel-socio"
            className="inline-flex items-center text-xs text-muted-foreground hover:text-foreground"
          >
            <ChevronLeft className="h-3 w-3 mr-1" /> Voltar ao Painel
          </Link>
          <h1 className="text-3xl font-bold tracking-tight mt-1">Contas &amp; Caixa</h1>
          <p className="text-sm text-muted-foreground">
            Saldos da empresa, reserva e conta corrente de cada sócio
          </p>
        </div>
        {!jaFechado && (
          <Button onClick={() => setFecharMesAlvo(mesAnteriorYM)}>
            Fechar mês {fmtMes(mesAnteriorYM)}
          </Button>
        )}
      </div>

      {/* SEÇÃO 1 — Caixa da Empresa */}
      <section className="space-y-3">
        <h2 className="text-xs uppercase tracking-wider text-muted-foreground">Caixa da empresa</h2>
        <div className="grid md:grid-cols-3 gap-4">
          <Card className="border-l-4 border-l-emerald-500">
            <CardContent className="p-5">
              <div className="flex items-center gap-2 text-xs text-muted-foreground uppercase tracking-wider">
                <TrendingUp className="h-3 w-3" /> Lucro a distribuir
              </div>
              <div className="text-3xl font-bold mt-2 tabular-nums">
                {brl(c.saldo_a_distribuir_centavos)}
              </div>
              <div className="text-xs text-muted-foreground mt-1">
                Crédito disponível para distribuição extraordinária
              </div>
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-sky-500">
            <CardContent className="p-5">
              <div className="flex items-center gap-2 text-xs text-muted-foreground uppercase tracking-wider">
                <Wallet className="h-3 w-3" /> Caixa operacional
              </div>
              <div className="text-3xl font-bold mt-2 tabular-nums">
                {brl(c.saldo_operacional_centavos)}
              </div>
              <div className="text-xs text-muted-foreground mt-1">
                Cobre {(Number(c.dias_runway || 0) / 30).toFixed(1)} meses de despesas fixas
                {" · "}
                {Number(c.dias_runway || 0)} dias de runway
              </div>
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-violet-500">
            <CardContent className="p-5">
              <div className="flex items-center gap-2 text-xs text-muted-foreground uppercase tracking-wider">
                <Shield className="h-3 w-3" /> Reserva de emergência
              </div>
              <div className="text-3xl font-bold mt-2 tabular-nums">
                {brl(c.saldo_reserva_centavos)}
              </div>
              <Progress value={Math.min(100, Number(c.reserva_progresso_pct || 0))} className="h-1.5 mt-3" />
              <div className="text-xs text-muted-foreground mt-1">
                {Number(c.reserva_progresso_pct || 0).toFixed(0)}% da meta ·{" "}
                {brl(c.reserva_meta_centavos)} ({c.reserva_meta_meses}m)
              </div>
            </CardContent>
          </Card>
        </div>
        {c.ultimo_fechamento_em && (
          <div className="text-xs text-muted-foreground">
            Último fechamento: {fmtData(c.ultimo_fechamento_em)}
          </div>
        )}
      </section>

      {/* SEÇÃO 2 — Sócios */}
      <section className="space-y-3">
        <h2 className="text-xs uppercase tracking-wider text-muted-foreground">Contas dos sócios</h2>
        <div className="grid md:grid-cols-3 gap-4">
          {socios.map((s) => (
            <Card key={s.id} className={s.eh_voce ? "ring-1 ring-primary/40" : ""}>
              <CardContent className="p-5 space-y-3">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center">
                        <User className="h-4 w-4 text-muted-foreground" />
                      </div>
                      <div>
                        <div className="font-semibold leading-tight">{s.nome}</div>
                        <div className="text-xs text-muted-foreground">
                          {Number(s.percentual || 0).toFixed(2)}% participação
                        </div>
                      </div>
                    </div>
                  </div>
                  {s.eh_voce && (
                    <Badge variant="secondary" className="text-[10px]">VOCÊ</Badge>
                  )}
                </div>

                <div>
                  <div className="text-[10px] text-muted-foreground uppercase tracking-wider">
                    Saldo a retirar
                  </div>
                  <div className="text-2xl font-bold tabular-nums">
                    {brl(s.saldo_centavos)}
                  </div>
                  <div className="text-[11px] text-muted-foreground mt-0.5">
                    Creditado no ano: {brl(s.total_creditado_ano_centavos)} · Retirado:{" "}
                    {brl(s.total_retirado_ano_centavos)}
                  </div>
                </div>

                {s.eh_voce && (
                  <Button
                    size="sm"
                    className="w-full"
                    onClick={() => setRetirarOpen(true)}
                    disabled={Number(s.saldo_centavos) <= 0}
                  >
                    <ArrowDownToLine className="h-3.5 w-3.5 mr-1.5" />
                    Retirar
                  </Button>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* SEÇÃO 3 — Extrato do sócio logado */}
      <section className="space-y-3">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <h2 className="text-xs uppercase tracking-wider text-muted-foreground">
            Meu extrato · {minhaConta?.socio?.nome}
          </h2>
          <div className="flex gap-1 text-xs">
            {(["todos", "creditos", "debitos", "pro_labore"] as Filtro[]).map((f) => (
              <button
                key={f}
                onClick={() => setFiltro(f)}
                className={`px-2.5 py-1 rounded-md border transition-colors ${
                  filtro === f ? "bg-primary text-primary-foreground border-primary" : "border-border hover:bg-muted"
                }`}
              >
                {f === "todos" && "Todos"}
                {f === "creditos" && "Créditos"}
                {f === "debitos" && "Débitos"}
                {f === "pro_labore" && "Pró-labore"}
              </button>
            ))}
          </div>
        </div>

        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Descrição</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                  <TableHead className="text-right">Saldo após</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {extratoFiltrado.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground py-10">
                      Nenhuma movimentação ainda.
                    </TableCell>
                  </TableRow>
                )}
                {extratoFiltrado.map((m: any) => {
                  const meta = TIPO_LABEL[m.tipo] || { label: m.tipo, tone: "credit" as const };
                  const isCred = meta.tone === "credit";
                  return (
                    <TableRow key={m.id} className={m.estornada ? "opacity-50" : ""}>
                      <TableCell className="font-mono text-xs">{fmtData(m.data)}</TableCell>
                      <TableCell>
                        <div className="text-sm">{m.descricao}</div>
                        {m.ata_referencia && (
                          <div className="text-[10px] text-muted-foreground">{m.ata_referencia}</div>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={
                            isCred
                              ? "border-emerald-500/40 text-emerald-700 dark:text-emerald-300"
                              : "border-amber-500/40 text-amber-700 dark:text-amber-300"
                          }
                        >
                          {isCred ? (
                            <ArrowUpFromLine className="h-3 w-3 mr-1" />
                          ) : (
                            <ArrowDownToLine className="h-3 w-3 mr-1" />
                          )}
                          {meta.label}
                        </Badge>
                      </TableCell>
                      <TableCell className={`text-right tabular-nums font-medium ${isCred ? "text-emerald-600" : "text-amber-600"}`}>
                        {isCred ? "+" : "−"} {brl(m.valor_centavos)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-muted-foreground">
                        {brl(m.saldo_apos_centavos)}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </section>

      {/* SEÇÃO 4 — Fechamentos mensais */}
      <section className="space-y-3">
        <h2 className="text-xs uppercase tracking-wider text-muted-foreground">Fechamentos mensais</h2>
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Mês</TableHead>
                  <TableHead className="text-right">Lucro líquido</TableHead>
                  <TableHead className="text-right">Reserva</TableHead>
                  <TableHead className="text-right">Distribuído</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(!distribuicoes || distribuicoes.length === 0) && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground py-10">
                      Nenhum mês fechado ainda.
                    </TableCell>
                  </TableRow>
                )}
                {(distribuicoes || []).map((d: any) => (
                  <TableRow key={d.id}>
                    <TableCell className="font-medium">{fmtMes(d.mes_referencia)}</TableCell>
                    <TableCell className="text-right tabular-nums">{brl(d.lucro_liquido_centavos)}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {brl(d.reserva_valor_centavos)}
                      <span className="text-[10px] text-muted-foreground ml-1">
                        ({Number(d.reserva_percentual_aplicado || 0).toFixed(0)}%)
                      </span>
                    </TableCell>
                    <TableCell className="text-right tabular-nums font-semibold">
                      {brl(d.distribuivel_centavos)}
                    </TableCell>
                    <TableCell>
                      <Badge variant={d.status === "fechado" ? "default" : "outline"}>
                        {d.status === "fechado" ? "Fechado" : d.status === "projecao" ? "Projeção" : "Revisão"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right text-xs text-muted-foreground">
                      {d.fechado_em ? fmtData(d.fechado_em) : ""}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </section>

      {/* MODAL — Retirar */}
      <Dialog open={retirarOpen} onOpenChange={setRetirarOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Registrar retirada</DialogTitle>
            <DialogDescription>
              Saldo disponível:{" "}
              <span className="font-semibold">{brl(saldoAtualSocio)}</span>
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="valor">Valor (R$)</Label>
              <Input
                id="valor"
                type="text"
                inputMode="decimal"
                placeholder="0,00"
                value={retirarValor}
                onChange={(e) => setRetirarValor(e.target.value)}
              />
              {valorRetiradaNum > 0 && (
                <div className={`text-xs ${valorValido ? "text-muted-foreground" : "text-destructive"}`}>
                  Saldo após: <span className="font-medium">{brl(saldoPosCentavos)}</span>
                  {!valorValido && " · valor excede o saldo"}
                </div>
              )}
            </div>
            <div className="space-y-1.5">
              <Label>Tipo</Label>
              <Select value={retirarTipo} onValueChange={(v) => setRetirarTipo(v as any)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="debito_pro_labore">Pró-labore</SelectItem>
                  <SelectItem value="debito_retirada">Retirada extraordinária</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="desc">Descrição</Label>
              <Textarea
                id="desc"
                placeholder="Ex.: Pró-labore referente a abril/2026"
                value={retirarDescricao}
                onChange={(e) => setRetirarDescricao(e.target.value)}
                rows={2}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ata">Ata de referência (opcional)</Label>
              <Input
                id="ata"
                placeholder="ata #007/2026"
                value={retirarAta}
                onChange={(e) => setRetirarAta(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRetirarOpen(false)}>
              Cancelar
            </Button>
            <Button
              disabled={!valorValido || retirarMutation.isPending}
              onClick={() => retirarMutation.mutate()}
            >
              {retirarMutation.isPending && <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />}
              Confirmar retirada
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ALERT — Fechar mês */}
      <AlertDialog open={!!fecharMesAlvo} onOpenChange={(o) => !o && setFecharMesAlvo(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Fechar {fmtMes(fecharMesAlvo)}?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação calcula o lucro do mês, separa {Number(c.reserva_percentual || 0).toFixed(0)}%
              para a reserva e credita os {socios.length} sócios proporcionalmente à participação.
              <br />
              <strong>É irreversível.</strong>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={fecharMesMutation.isPending}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={fecharMesMutation.isPending}
              onClick={() => fecharMesAlvo && fecharMesMutation.mutate(fecharMesAlvo)}
            >
              {fecharMesMutation.isPending && <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />}
              Confirmar fechamento
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
