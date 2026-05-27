import { useState } from "react";
import { Loader2, Wallet, Shield, TrendingUp, ArrowDownToLine, User, ChevronLeft, RotateCcw, CheckCircle2, Plus, History } from "lucide-react";
import { Link } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { TooltipProvider } from "@/components/ui/tooltip";
import { usePainelSocio } from "@/hooks/usePainelSocio";
import { useContasSocio, useExtratoSocio, type ExtratoFiltro } from "@/hooks/useContasSocio";
import { NovaRetiradaDialog } from "@/components/painel-socio/NovaRetiradaDialog";
import { FecharMesDialog } from "@/components/painel-socio/FecharMesDialog";
import { ReabrirMesDialog } from "@/components/painel-socio/ReabrirMesDialog";
import { NovoLancamentoDialog } from "@/components/painel-socio/NovoLancamentoDialog";
import { SolicitacoesPendentes } from "@/components/painel-socio/SolicitacoesPendentes";

const reaisToBRL = (v: number | null | undefined) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(v ?? 0));

const centavosToBRL = (c: number | null | undefined) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(c ?? 0) / 100);

const fmtMesLabel = (ym: string) => {
  if (!ym) return "—";
  const [y, m] = ym.split("-");
  return `${m}/${y}`;
};

const fmtData = (iso: string) => {
  if (!iso) return "—";
  const d = new Date(iso.length <= 10 ? iso + "T00:00:00" : iso);
  return d.toLocaleDateString("pt-BR");
};

const tipoLabel: Record<string, { label: string; credito: boolean }> = {
  credito_fechamento: { label: "Crédito", credito: true },
  debito_retirada: { label: "Débito", credito: false },
  estorno_fechamento: { label: "Estorno", credito: false },
  estorno_retirada: { label: "Estorno", credito: true },
  pro_labore: { label: "Pró-labore", credito: false },
  ajuste: { label: "Ajuste", credito: true },
};

export default function PainelSocioContas() {
  const [filtro, setFiltro] = useState<ExtratoFiltro>("todos");
  const [retirarOpen, setRetirarOpen] = useState(false);
  const [fecharOpen, setFecharOpen] = useState(false);
  const [reabrirMes, setReabrirMes] = useState<string | null>(null);

  const { data, isLoading } = usePainelSocio();
  const { data: contas, isLoading: loadingContas } = useContasSocio();
  const { data: extrato } = useExtratoSocio(filtro);

  if (isLoading || loadingContas) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!data?.sucesso) {
    return <div className="p-6 text-muted-foreground">Não foi possível carregar o painel.</div>;
  }

  const saldoCaixaCentavos = Number(data.saude.saldo_caixa_centavos ?? 0);
  const gastosFixosCentavos = Number(data.saude.gastos_fixos_mes_centavos ?? 0);
  const diasRunway = Number(data.saude.dias_runway ?? 0);
  const mesesCobertura = gastosFixosCentavos > 0 ? (saldoCaixaCentavos / gastosFixosCentavos).toFixed(1) : "—";

  const distribuivel = Number(data.mes_atual.distribuivel ?? 0);
  const sociosContas = contas?.socios || [];
  const fechamentos = contas?.fechamentos || [];
  const mesesDisponiveis = contas?.meses_disponiveis_pra_fechar || [];
  const proximoMesFechar = mesesDisponiveis[0];

  // Sócio logado
  const meuSocio = sociosContas.find((s) => s.eh_voce);
  const meuSaldo = Number(meuSocio?.saldo_a_retirar ?? 0);

  // Preview do fechamento: usa dados de mes_atual (ou histórico se for mês anterior)
  const mesAtual = data.mes_atual;
  const histMes = data.historico?.find((h) => h.mes_inicio?.startsWith(proximoMesFechar || "__"));
  const previewFat = histMes ? Number(histMes.faturamento) : Number(mesAtual.faturamento);
  const previewPecas = histMes ? Number(histMes.custo_pecas) : Number(mesAtual.custo_pecas);
  const previewCom = histMes ? Number(histMes.comissoes) : Number(mesAtual.comissoes);
  const previewDesp = histMes ? Number(histMes.despesas) : Number(mesAtual.despesas);
  const previewLL = histMes ? Number(histMes.lucro_liquido) : Number(mesAtual.lucro_liquido);
  const reservaPct = Number(mesAtual.reserva_pct ?? 10);

  const ultimoFechamento = fechamentos[0]; // ordenados desc

  return (
    <TooltipProvider>
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
          {proximoMesFechar && (
            <Button onClick={() => setFecharOpen(true)}>
              Fechar mês {fmtMesLabel(proximoMesFechar)}
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
                  {reaisToBRL(distribuivel)}
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
                  {centavosToBRL(saldoCaixaCentavos)}
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  Cobre {mesesCobertura} {mesesCobertura === "1.0" ? "mês" : "meses"} · {diasRunway} dias de runway
                </div>
              </CardContent>
            </Card>

            <Card className="border-l-4 border-l-violet-500">
              <CardContent className="p-5">
                <div className="flex items-center gap-2 text-xs text-muted-foreground uppercase tracking-wider">
                  <Shield className="h-3 w-3" /> Reserva de emergência
                </div>
                <div className="text-3xl font-bold mt-2 tabular-nums">
                  {reaisToBRL(0)}
                </div>
                <Progress value={0} className="h-1.5 mt-3" />
                <div className="text-xs text-muted-foreground mt-1 italic">
                  Em desenvolvimento — disponível em breve
                </div>
              </CardContent>
            </Card>
          </div>
        </section>

        {/* SEÇÃO 2 — Sócios */}
        <section className="space-y-3">
          <h2 className="text-xs uppercase tracking-wider text-muted-foreground">Contas dos sócios</h2>
          <div className="grid md:grid-cols-3 gap-4">
            {sociosContas.map((s) => (
              <Card key={s.id} className={s.eh_voce ? "ring-1 ring-primary/40" : ""}>
                <CardContent className="p-5 space-y-3">
                  <div className="flex items-start justify-between">
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
                    {s.eh_voce && (
                      <Badge variant="secondary" className="text-[10px]">VOCÊ</Badge>
                    )}
                  </div>

                  <div>
                    <div className="text-[10px] text-muted-foreground uppercase tracking-wider">
                      Saldo a retirar
                    </div>
                    <div className="text-2xl font-bold tabular-nums">
                      {reaisToBRL(s.saldo_a_retirar)}
                    </div>
                    <div className="text-[11px] text-muted-foreground mt-1">
                      Creditado no ano: {reaisToBRL(s.creditado_no_ano)} · Retirado: {reaisToBRL(s.total_retirado)}
                    </div>
                  </div>

                  {s.eh_voce && (
                    <Button
                      size="sm"
                      className="w-full"
                      disabled={meuSaldo <= 0}
                      onClick={() => setRetirarOpen(true)}
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
              Meu extrato · {data.socio?.nome}
            </h2>
            <div className="flex gap-1 text-xs">
              {(["todos", "creditos", "debitos", "pro_labore"] as ExtratoFiltro[]).map((f) => (
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
                  {(!extrato?.movimentos || extrato.movimentos.length === 0) && (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-muted-foreground py-10">
                        Nenhuma movimentação ainda.
                      </TableCell>
                    </TableRow>
                  )}
                  {extrato?.movimentos?.map((m) => {
                    const meta = tipoLabel[m.tipo] || { label: m.tipo, credito: m.valor >= 0 };
                    const credito = m.valor >= 0;
                    return (
                      <TableRow key={m.id}>
                        <TableCell className="whitespace-nowrap">{fmtData(m.data_movimento)}</TableCell>
                        <TableCell>{m.descricao}</TableCell>
                        <TableCell>
                          <Badge variant={credito ? "secondary" : "outline"} className="text-[10px]">
                            {meta.label}
                          </Badge>
                        </TableCell>
                        <TableCell className={`text-right tabular-nums font-semibold ${credito ? "text-emerald-600" : "text-rose-600"}`}>
                          {credito ? "+" : "−"}{reaisToBRL(Math.abs(m.valor))}
                        </TableCell>
                        <TableCell className="text-right tabular-nums text-muted-foreground">
                          {reaisToBRL(m.saldo_apos)}
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
                    <TableHead className="text-right">Faturamento</TableHead>
                    <TableHead className="text-right">Lucro líquido</TableHead>
                    <TableHead className="text-right">Distribuído</TableHead>
                    <TableHead className="text-right">Meu valor</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {fechamentos.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center text-muted-foreground py-10">
                        Nenhum mês fechado ainda.
                      </TableCell>
                    </TableRow>
                  )}
                  {fechamentos.map((f, idx) => (
                    <TableRow key={f.id}>
                      <TableCell className="font-medium">{fmtMesLabel(f.mes)}</TableCell>
                      <TableCell className="text-right tabular-nums">{reaisToBRL(f.faturamento)}</TableCell>
                      <TableCell className="text-right tabular-nums">{reaisToBRL(f.lucro_liquido)}</TableCell>
                      <TableCell className="text-right tabular-nums">{reaisToBRL(f.distribuivel)}</TableCell>
                      <TableCell className="text-right tabular-nums font-semibold">
                        {reaisToBRL(f.meu_valor)}
                      </TableCell>
                      <TableCell>
                        <Badge className="bg-emerald-500/15 text-emerald-700 hover:bg-emerald-500/20 border-0">
                          <CheckCircle2 className="h-3 w-3 mr-1" /> Fechado
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        {idx === 0 && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setReabrirMes(f.mes)}
                          >
                            <RotateCcw className="h-3.5 w-3.5 mr-1" /> Reabrir
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </section>
      </div>

      {/* Dialogs */}
      {meuSocio && (
        <NovaRetiradaDialog
          open={retirarOpen}
          onOpenChange={setRetirarOpen}
          saldoDisponivel={meuSaldo}
        />
      )}
      {proximoMesFechar && (
        <FecharMesDialog
          open={fecharOpen}
          onOpenChange={setFecharOpen}
          mes={proximoMesFechar}
          faturamento={previewFat}
          custoPecas={previewPecas}
          comissoes={previewCom}
          despesas={previewDesp}
          lucroLiquido={previewLL}
          reservaPct={reservaPct}
          socios={sociosContas.map((s) => ({ id: s.id, nome: s.nome, percentual: s.percentual }))}
        />
      )}
      {reabrirMes && (
        <ReabrirMesDialog
          open={!!reabrirMes}
          onOpenChange={(v) => !v && setReabrirMes(null)}
          mes={reabrirMes}
        />
      )}
    </TooltipProvider>
  );
}
