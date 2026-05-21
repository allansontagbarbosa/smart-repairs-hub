import { useState } from "react";
import {
  Loader2,
  TrendingUp,
  TrendingDown,
  PiggyBank,
  Sparkles,
  Star,
  AlertTriangle,
  Users,
  Target,
  Plus,
  Wallet,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { usePainelSocio } from "@/hooks/usePainelSocio";
import { useValidaPainel } from "@/hooks/useValidaPainel";
import { NovaMetaDialog } from "@/components/painel-socio/NovaMetaDialog";
import { FatoresExternosCards } from "@/components/painel-socio/FatoresExternosCards";
import { InsightsIA } from "@/components/painel-socio/InsightsIA";
import {
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RTooltip,
  ResponsiveContainer,
} from "recharts";

const brl = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v || 0);

function nomeDoMes(dataStr: string | null | undefined): string {
  if (!dataStr) return "";
  const meses = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
  const d = new Date(dataStr + "T00:00:00");
  return `${meses[d.getMonth()]}/${String(d.getFullYear()).slice(2)}`;
}

const STATUS_FUNC: Record<
  string,
  { label: string; bg: string; fg: string }
> = {
  estrela: { label: "🌟 Estrela", bg: "bg-emerald-500/15", fg: "text-emerald-700 dark:text-emerald-300" },
  ok: { label: "Saudável", bg: "bg-emerald-500/10", fg: "text-emerald-700 dark:text-emerald-300" },
  atencao: { label: "⚠ Atenção", bg: "bg-amber-500/15", fg: "text-amber-700 dark:text-amber-300" },
  prejuizo: { label: "🚨 Prejuízo", bg: "bg-red-500/15", fg: "text-red-700 dark:text-red-300" },
  sem_salario: { label: "—", bg: "bg-muted", fg: "text-muted-foreground" },
};

export default function PainelSocio() {
  const { data, isLoading, error } = usePainelSocio();
  useValidaPainel(data);
  const [novaMetaOpen, setNovaMetaOpen] = useState(false);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !data?.sucesso) {
    return (
      <div className="p-6 max-w-2xl">
        <h1 className="text-2xl font-bold mb-2">Erro ao carregar painel</h1>
        <p className="text-muted-foreground">
          {(error as any)?.message || "Tente novamente em alguns instantes."}
        </p>
      </div>
    );
  }

  const m = data.mes_atual;
  const variacao = data.variacao_mes;

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="text-xs uppercase tracking-wider text-muted-foreground">
            PAINEL DO SÓCIO · {new Date(data.gerado_em).toLocaleDateString("pt-BR")}
          </div>
          <h1 className="text-3xl font-bold tracking-tight mt-1">
            Olá, {data.socio.nome.split(" ")[0]}
            <span className="text-muted-foreground text-base font-normal ml-2">
              · Participação {data.socio.percentual.toFixed(2)}%
            </span>
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <Button asChild variant="outline" size="sm">
            <a href="/painel-socio/contas">
              <Wallet className="h-3.5 w-3.5 mr-1.5" /> Contas &amp; Caixa
            </a>
          </Button>
          <Badge variant="outline" className="text-xs">
            <Sparkles className="h-3 w-3 mr-1" />
            Atualizado há instantes
          </Badge>
        </div>
      </div>

      {/* HERO */}
      <Card className="bg-gradient-to-br from-primary to-primary/70 text-primary-foreground border-0">
        <CardContent className="p-6">
          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <div className="text-xs uppercase tracking-wider opacity-80">
                VOCÊ JÁ TEM · DIA {data.periodo.dias_passados}/{data.periodo.dias_no_mes}
              </div>
              <div className="text-4xl md:text-5xl font-bold mt-2">{brl(m.meu_valor_parcial)}</div>
              {variacao && data.mes_passado.meu_valor_periodo > 0 && (
                <div
                  className={`text-sm mt-2 ${
                    variacao.meu_valor_pct >= 0 ? "text-emerald-100" : "text-red-100"
                  }`}
                >
                  {variacao.meu_valor_pct >= 0 ? "↑" : "↓"}{" "}
                  {Math.abs(variacao.meu_valor_pct).toFixed(1)}% vs mesmo período de{" "}
                  {nomeDoMes(data.mes_passado.periodo_ate_dia)} ({brl(data.mes_passado.meu_valor_periodo)})
                </div>
              )}
              <div className="text-xs opacity-80 mt-1">
                Lucro líquido parcial: {brl(m.lucro_liquido)}
              </div>
            </div>
            <div>
              <div className="text-xs uppercase tracking-wider opacity-80 flex items-center gap-1">
                <TrendingUp className="h-3 w-3" /> FECHAMENTO PREVISTO
              </div>
              <div className="text-4xl md:text-5xl font-bold mt-2">{brl(m.fechamento_previsto)}</div>
              {variacao && data.mes_passado.meu_valor > 0 && (
                <div
                  className={`text-sm mt-2 ${
                    variacao.fechamento_pct >= 0 ? "text-emerald-100" : "text-red-100"
                  }`}
                >
                  {variacao.fechamento_pct >= 0 ? "↑" : "↓"}{" "}
                  {Math.abs(variacao.fechamento_pct).toFixed(1)}% vs{" "}
                  {nomeDoMes(data.mes_passado.periodo_ate_dia)} fechado ({brl(data.mes_passado.meu_valor)})
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="text-xs text-muted-foreground uppercase tracking-wider">FATURAMENTO</div>
            <div className="text-2xl font-bold mt-1">{brl(m.faturamento)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-xs text-muted-foreground uppercase tracking-wider">
              CUSTOS + DESPESAS
            </div>
            <div className="text-2xl font-bold mt-1">
              {brl(m.custo_pecas + m.despesas + m.comissoes)}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-xs text-muted-foreground uppercase tracking-wider">
              LUCRO LÍQUIDO
            </div>
            <div className="text-2xl font-bold mt-1">{brl(m.lucro_liquido)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-xs text-muted-foreground uppercase tracking-wider">
              DISTRIBUÍVEL ({(100 - m.reserva_pct).toFixed(0)}%)
            </div>
            <div className="text-2xl font-bold mt-1">{brl(m.distribuivel)}</div>
            <div className="text-xs text-muted-foreground mt-1">Reserva: {brl(m.reserva_val)}</div>
          </CardContent>
        </Card>
      </div>

      {/* KPIs previstos para fim do mês */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Card className="bg-muted/30">
          <CardContent className="p-3">
            <div className="text-[10px] text-muted-foreground uppercase tracking-wider">
              Faturamento previsto
            </div>
            <div className="text-lg font-medium mt-1">{brl(m.faturamento_previsto)}</div>
            <div className="text-[10px] text-muted-foreground mt-0.5">Fim do mês</div>
          </CardContent>
        </Card>
        <Card className="bg-muted/30">
          <CardContent className="p-3">
            <div className="text-[10px] text-muted-foreground uppercase tracking-wider">
              Custos + Despesas previstos
            </div>
            <div className="text-lg font-medium mt-1">
              {brl(
                m.custo_pecas_previsto +
                  m.custo_terceirizado_previsto +
                  m.despesas +
                  m.comissoes_previstas
              )}
            </div>
          </CardContent>
        </Card>
        <Card className="bg-muted/30">
          <CardContent className="p-3">
            <div className="text-[10px] text-muted-foreground uppercase tracking-wider">
              Lucro líquido previsto
            </div>
            <div
              className={`text-lg font-medium mt-1 ${
                m.lucro_liquido_previsto < 0 ? "text-destructive" : ""
              }`}
            >
              {brl(m.lucro_liquido_previsto)}
            </div>
          </CardContent>
        </Card>
        <Card className="bg-muted/30 border-primary/20">
          <CardContent className="p-3">
            <div className="text-[10px] text-muted-foreground uppercase tracking-wider">
              Distribuível previsto ({(100 - m.reserva_pct).toFixed(0)}%)
            </div>
            <div className="text-lg font-medium mt-1 text-primary">
              {brl(m.distribuivel_previsto)}
            </div>
            <div className="text-[10px] text-muted-foreground mt-0.5">
              Reserva: {brl(m.reserva_prevista)}
            </div>
          </CardContent>
        </Card>
      </div>

      {m.confiabilidade_projecao === "baixa" && (
        <p className="text-[11px] text-muted-foreground text-center">
          ⚠️ Projeção com baixa confiabilidade (poucos dias decorridos). Conforme o mês avança, fica mais precisa.
        </p>
      )}

      {/* Fatores externos */}
      <FatoresExternosCards />

      {/* Histórico */}
      <Card>
        <CardHeader>
          <CardTitle>Histórico dos últimos 6 meses</CardTitle>
          <p className="text-sm text-muted-foreground">
            Sua distribuição mensal estimada (mês atual incompleto)
          </p>
        </CardHeader>
        <CardContent>
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={data.historico}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="mes" className="text-xs" />
                <YAxis tickFormatter={(v) => brl(Number(v))} className="text-xs" width={90} />
                <RTooltip
                  formatter={(v: any) => brl(Number(v))}
                  contentStyle={{
                    background: "hsl(var(--background))",
                    border: "1px solid hsl(var(--border))",
                  }}
                />
                <Bar dataKey="meu_valor" fill="hsl(var(--primary))" radius={[6, 6, 0, 0]} />
                <Line
                  type="monotone"
                  dataKey="lucro_liquido"
                  stroke="hsl(var(--muted-foreground))"
                  strokeWidth={2}
                  dot={false}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Insights IA */}
      <InsightsIA />

      {/* Sócios + Saúde */}
      <div className="grid md:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-4 w-4" /> Divisão entre sócios
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {data.socios.map((s) => (
              <div
                key={s.id}
                className={`flex items-center justify-between py-2 px-3 rounded ${
                  s.eh_voce ? "bg-primary/10 border border-primary/30" : "bg-muted/40"
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className="font-medium">{s.nome}</span>
                  {s.eh_voce && (
                    <Badge variant="outline" className="text-[10px]">
                      você
                    </Badge>
                  )}
                  <span className="text-xs text-muted-foreground">
                    {s.percentual.toFixed(2)}%
                  </span>
                </div>
                <span className="font-semibold">{brl(((s as any).valor ?? s.valor_estimado ?? 0))}</span>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <PiggyBank className="h-4 w-4" /> Saúde financeira
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between py-2 border-b">
              <span className="text-sm text-muted-foreground">Inadimplência (vencidos)</span>
              <span className="font-semibold">{brl(data.saude.inadimplencia_centavos / 100)}</span>
            </div>
            <div className="flex justify-between py-2">
              <span className="text-sm text-muted-foreground">
                Gastos fixos médio (últimos 3 meses)
              </span>
              <span className="font-semibold">
                {brl(data.saude.gastos_fixos_mes_centavos / 100)}
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ROI funcionários */}
      <Card>
        <CardHeader>
          <CardTitle>Ranking de produtividade · funcionários CLT</CardTitle>
          <p className="text-xs text-muted-foreground">
            ROI = receita gerada nos últimos 2 meses ÷ custo total mensal (salário + VT + VA)
          </p>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-muted-foreground border-b">
                  <th className="text-left py-2 px-2">#</th>
                  <th className="text-left py-2 px-2">FUNCIONÁRIO</th>
                  <th className="text-right py-2 px-2">CUSTO/MÊS</th>
                  <th className="text-right py-2 px-2">RECEITA 60D</th>
                  <th className="text-right py-2 px-2">ROI</th>
                  <th className="text-right py-2 px-2">STATUS</th>
                </tr>
              </thead>
              <tbody>
                {data.funcionarios_roi.length === 0 && (
                  <tr>
                    <td colSpan={6} className="text-center py-6 text-muted-foreground">
                      Sem funcionários CLT cadastrados.
                    </td>
                  </tr>
                )}
                {data.funcionarios_roi.map((f, i) => {
                  const cfg = STATUS_FUNC[f.status];
                  return (
                    <tr key={f.id} className="border-b last:border-0">
                      <td className="py-2 px-2 text-muted-foreground">{i + 1}</td>
                      <td className="py-2 px-2">
                        <div className="font-medium">{f.nome}</div>
                        <div className="text-xs text-muted-foreground">{f.cargo}</div>
                      </td>
                      <td className="py-2 px-2 text-right">{brl(f.custo_total_centavos / 100)}</td>
                      <td className="py-2 px-2 text-right">{brl(f.receita_centavos / 100)}</td>
                      <td className="py-2 px-2 text-right font-semibold">
                        {f.roi !== null ? f.roi.toFixed(1) + "x" : "—"}
                      </td>
                      <td className="py-2 px-2 text-right">
                        <span className={`px-2 py-0.5 rounded text-xs ${cfg.bg} ${cfg.fg}`}>
                          {cfg.label}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Metas */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Target className="h-4 w-4" /> Suas metas pessoais
            </CardTitle>
            <Button size="sm" variant="outline" onClick={() => setNovaMetaOpen(true)}>
              <Plus className="h-3.5 w-3.5 mr-1" /> Nova meta
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {data.metas.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">
              Você ainda não cadastrou metas. Clique em "Nova meta" pra começar.
            </p>
          ) : (
            <div className="space-y-4">
              {data.metas.map((meta) => (
                <div key={meta.id} className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium">
                      {meta.icone} {meta.titulo}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {brl(meta.valor_acumulado_centavos / 100)} de{" "}
                      {brl(meta.valor_alvo_centavos / 100)} · {meta.progresso_pct}%
                    </span>
                  </div>
                  <Progress value={meta.progresso_pct} />
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground text-center pt-2">
        Valores são estimativas em tempo real. A distribuição efetiva depende de aprovação contábil
        e do regime tributário da empresa. Atualizado automaticamente a cada 5 minutos.
      </p>

      <NovaMetaDialog open={novaMetaOpen} onOpenChange={setNovaMetaOpen} />
    </div>
  );
}
