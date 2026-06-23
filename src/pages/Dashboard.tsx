import { useState, useMemo } from "react";
import { OnboardingWelcome } from "@/components/OnboardingWelcome";
import { ComboWidget } from "@/components/ComboWidget";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate, Navigate } from "react-router-dom";
import { useModulos } from "@/hooks/useModulos";
import { usePermissoes } from "@/hooks/usePermissoes";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Plus, AlertTriangle, Clock, CheckCircle, TrendingUp,
  TrendingDown, Wrench, Smartphone, DollarSign, Package,
  Users, Target, AlertCircle, ChevronRight,
  Settings, Loader2, Receipt, CreditCard, Info,
} from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { format, startOfMonth, endOfMonth, subMonths, differenceInHours } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RTooltip,
  ResponsiveContainer,
} from "recharts";
import { DashboardPeriodFilter } from "@/components/dashboard/DashboardPeriodFilter";
import {
  type PeriodPreset,
  type PeriodRange,
  rangeFromPreset,
} from "@/components/dashboard/period-presets";

// ─── TIPOS ────────────────────────────────────────────────────────────────────

type OrderRow = {
  id: string;
  numero: number;
  status: string;
  data_entrada: string;
  data_conclusao: string | null;
  previsao_entrega: string | null;
  valor: number | null;
  valor_total: number | null;
  custo_pecas: number | null;
  loja_id: string | null;
  aparelhos?: {
    marca: string;
    modelo: string;
    imei: string | null;
    clientes?: { nome: string; telefone: string } | null;
  } | null;
};

// ─── STATUS HELPERS ───────────────────────────────────────────────────────────

const STATUS_LABELS: Record<string, string> = {
  recebido: "Recebido",
  em_analise: "Em Análise",
  aguardando_aprovacao: "Aguard. Aprovação",
  em_reparo: "Em Reparo",
  pronto: "Pronto",
  entregue: "Entregue",
  cancelado: "Cancelada",
};

const STATUS_COLORS: Record<string, string> = {
  recebido: "bg-blue-100 text-blue-700",
  em_analise: "bg-green-100 text-green-700",
  aguardando_aprovacao: "bg-orange-100 text-orange-700",
  em_reparo: "bg-blue-100 text-blue-700",
  pronto: "bg-green-100 text-green-700",
  entregue: "bg-muted text-muted-foreground",
  cancelado: "bg-red-100 text-red-700",
};

const isCancelada = (s: string) => s === "cancelado";
const isAtiva = (s: string) => !isCancelada(s) && s !== "entregue";
const isFaturado = (s: string) => s === "pronto" || s === "entregue";
// "Aguardando reparo" = OS recebidas mas que ainda não entraram em reparo.
// Inclui o limbo de aprovação e o aguardo por peças.
// NÃO inclui em_reparo (esse status tem seu próprio card no Operacional).
const isAguardando = (s: string) =>
  ["recebido", "em_analise", "aguardando_aprovacao", "aprovado", "aguardando_peca"].includes(s);

// ─── FORMATAÇÃO ───────────────────────────────────────────────────────────────

const brl = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

const pct = (v: number) => `${v.toFixed(1)}%`;

const formatMonthKey = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;

const getCompetenciaMonths = (start: Date, end: Date) => {
  const months: string[] = [];
  const cursor = new Date(start.getFullYear(), start.getMonth(), 1);
  const last = new Date(end.getFullYear(), end.getMonth(), 1);

  while (cursor <= last) {
    months.push(formatMonthKey(cursor));
    cursor.setMonth(cursor.getMonth() + 1);
  }

  return months;
};

// Detecta se o range cobre meses inteiros (do dia 1 ao último dia)
const rangeCobreMesesInteiros = (start: Date, end: Date) => {
  const startEhDia1 = start.getDate() === 1;
  const endEhUltimoDia =
    end.getDate() ===
    new Date(end.getFullYear(), end.getMonth() + 1, 0).getDate();
  return startEhDia1 && endEhUltimoDia;
};

// ─── COMPONENTES AUXILIARES ───────────────────────────────────────────────────

function MetricCard({
  icon: Icon,
  label,
  value,
  sub,
  color = "text-foreground",
  bg = "bg-card",
  badge,
  iconColor = "text-blue-500",
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  sub?: string;
  color?: string;
  bg?: string;
  badge?: React.ReactNode;
  iconColor?: string;
}) {
  return (
    <Card className={bg}>
      <CardContent className="p-3">
        <div className="flex items-center justify-between mb-3">
          <Icon className={`h-4 w-4 ${iconColor}`} />
          {badge}
        </div>
        <p className={`text-lg font-bold ${color}`}>{value}</p>
        <p className="text-[11px] text-muted-foreground">{label}</p>
        {sub && <p className="text-[10px] text-muted-foreground mt-0.5">{sub}</p>}
      </CardContent>
    </Card>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
      {children}
    </h2>
  );
}

function AlertCard({
  type,
  message,
}: {
  type: "warn" | "ok" | "error";
  message: string;
}) {
  const styles = {
    warn: "bg-amber-50 border-amber-200 text-amber-800",
    ok: "bg-green-50 border-green-200 text-green-800",
    error: "bg-red-50 border-red-200 text-red-800",
  };
  const icons = {
    warn: <AlertTriangle className="h-3.5 w-3.5 shrink-0" />,
    ok: <CheckCircle className="h-3.5 w-3.5 shrink-0" />,
    error: <AlertCircle className="h-3.5 w-3.5 shrink-0" />,
  };
  return (
    <div className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-medium ${styles[type]}`}>
      {icons[type]}
      {message}
    </div>
  );
}

// ─── DATA FETCHING ────────────────────────────────────────────────────────────

async function fetchDashboardSummary(rangeStart: Date, rangeEnd: Date) {
  const { data, error } = await (supabase as any).rpc("get_dashboard_summary", {
    p_inicio: rangeStart.toISOString(),
    p_fim: rangeEnd.toISOString(),
  });
  if (error) throw error;
  return data as {
    ordens: OrderRow[];
    estoque_baixo: number;
    contas_pendentes: any[];
    comissoes_pendentes: any[];
    comissoes_periodo_total: number | null;
    comissoes_periodo_a_pagar: number | null;
    lojas: { id: string; nome: string }[];
  };
}

async function fetchContasPeriodo(rangeStart: Date, rangeEnd: Date) {
  const competencias = getCompetenciaMonths(rangeStart, rangeEnd);
  const { data, error } = await supabase
    .from("contas_a_pagar")
    .select("valor, recorrente, mes_competencia, categoria")
    .in("mes_competencia", competencias)
    .is("deleted_at", null);
  if (error) throw error;
  // Igual à DRE (RelDRE.tsx): ignora categorias já contadas em "Custos".
  // Comissões vêm da tabela `comissoes` via RPC; Prejuízos vêm de `prejuizos`.
  // Se essas categorias também aparecem em `contas_a_pagar`, é dupla contagem.
  return (data ?? []).filter(
    (c: any) => c.categoria !== "Comissões" && c.categoria !== "Prejuízos"
  );
}

async function fetchEmpresaConfig() {
  const { data, error } = await supabase
    .from("empresa_config")
    .select("meta_gastos_mes, meta_faturamento_mes, numero_socios, percentual_reserva_empresa")
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data;
}

async function fetchSocios() {
  const { data, error } = await supabase
    .from("socios")
    .select("id, nome, ordem, percentual_participacao")
    .eq("ativo", true)
    .is("deleted_at", null)
    .order("ordem");
  if (error) throw error;
  return data ?? [];
}

// ─── COMPONENTE PRINCIPAL ─────────────────────────────────────────────────────

export default function Dashboard() {
  const navigate = useNavigate();
  const { can } = usePermissoes();
  const [periodPreset, setPeriodPreset] = useState<PeriodPreset>("este_mes");
  const [periodRange, setPeriodRange] = useState<PeriodRange>(() => rangeFromPreset("este_mes")!);
  const range = useMemo(() => ({ start: periodRange.from, end: periodRange.to }), [periodRange]);
  function handlePeriodChange(p: PeriodPreset, r: PeriodRange) {
    setPeriodPreset(p);
    setPeriodRange(r);
  }

  // ── QUERIES ──────────────────────────────────────────────────────────────

  const { data: summary, isLoading } = useQuery({
    queryKey: ["dashboard-summary", range.start.toISOString(), range.end.toISOString()],
    queryFn: () => fetchDashboardSummary(range.start, range.end),
    refetchInterval: 60000,
  });

  const { data: contasPeriodo } = useQuery({
    queryKey: ["dashboard-contas-periodo", range.start.toISOString(), range.end.toISOString()],
    queryFn: () => fetchContasPeriodo(range.start, range.end),
    refetchInterval: 60000,
  });

  // FONTE ÚNICA: DRE canônica usada para todos os valores financeiros
  const { data: dre } = useQuery({
    queryKey: ["dashboard-dre", range.start.toISOString(), range.end.toISOString()],
    queryFn: async () => {
      const ini = `${range.start.getFullYear()}-${String(range.start.getMonth() + 1).padStart(2, "0")}-${String(range.start.getDate()).padStart(2, "0")}`;
      const fi = `${range.end.getFullYear()}-${String(range.end.getMonth() + 1).padStart(2, "0")}-${String(range.end.getDate()).padStart(2, "0")}`;
      const { data, error } = await (supabase as any).rpc("get_dre_periodo", {
        p_inicio: ini,
        p_fim: fi,
      });
      if (error) throw error;
      return data as any;
    },
    refetchInterval: 60000,
  });

  const { data: empresaConfig } = useQuery({
    queryKey: ["dashboard-empresa-config"],
    queryFn: fetchEmpresaConfig,
    refetchInterval: 60000,
  });

  const { data: sociosList } = useQuery({
    queryKey: ["dashboard-socios"],
    queryFn: fetchSocios,
    refetchInterval: 60000,
  });

  const allOrders = summary?.ordens ?? [];

  // Filter orders by selected period (excludes canceladas — defesa em profundidade)
  // Filtro base do Dashboard: OS concluídas dentro do range (data_conclusao).
  // OS canceladas e OS sem data_conclusao ficam de fora.
  // Operação ao vivo (em reparo, aguardando, em atraso) NÃO usa esse filtro —
  // continua olhando allOrders (estado atual real, independe do range).
  const orders = useMemo(() => {
    return allOrders.filter(o => {
      if (isCancelada(o.status)) return false;
      if (!o.data_conclusao) return false;
      const d = new Date(o.data_conclusao);
      return d >= range.start && d <= range.end;
    });
  }, [allOrders, range]);

  const competenciaInfo = useMemo(() => {
    const meses = getCompetenciaMonths(range.start, range.end);
    const fracao = !rangeCobreMesesInteiros(range.start, range.end);
    return { meses, fracao };
  }, [range]);

  // ── CÁLCULOS ────────────────────────────────────────────────────────────

  const kpis = useMemo(() => {
    const now = new Date();


    const ordensMes = orders;
    const ordensFaturadas = orders.filter(o => isFaturado(o.status));

    // VALORES FINANCEIROS: vêm da fonte única get_dre_periodo
    const faturamento = Number(dre?.receitas?.bruta ?? 0);
    const custosPecasMes = Number(dre?.custos?.pecas ?? 0);
    const totalComissoesPeriodo = Number(dre?.custos?.comissoes ?? 0);
    const gastosFixos = Number(dre?.despesas?.gastos_fixos ?? 0);
    const gastosVariaveis = Number(dre?.despesas?.outros ?? 0);
    const despesasPagasMes = gastosFixos + gastosVariaveis;
    const ebitda = Number(dre?.despesas?.ebitda ?? 0);
    const ebitdaMargem = faturamento > 0 ? (ebitda / faturamento) * 100 : 0;
    const depreciacao = Number(dre?.resultado?.depreciacao ?? 0);
    const impostos = Number(dre?.deducoes?.impostos ?? 0);
    const ll = Number(dre?.resultado?.lucro_liquido ?? 0);
    const llMargem = Number(dre?.resultado?.margem_pct ?? 0);

    const ordensComValor = ordensFaturadas.filter(o => Number(o.valor_total ?? o.valor ?? 0) > 0);
    const ticket = ordensComValor.length > 0
      ? ordensComValor.reduce((s, o) => s + Number(o.valor_total ?? o.valor ?? 0), 0) / ordensComValor.length
      : 0;

    const llPorAssist = ordensMes.length > 0 ? ll / ordensMes.length : 0;

    const metaGastos = Number(empresaConfig?.meta_gastos_mes ?? 0);
    const metaFaturamento = Number(empresaConfig?.meta_faturamento_mes ?? 0);
    const reservaPct = Number(dre?.distribuicao?.reserva_pct ?? empresaConfig?.percentual_reserva_empresa ?? 20);
    const nSocios = Number(empresaConfig?.numero_socios ?? 2) || 1;

    const prevLl = metaFaturamento > 0 && faturamento > 0 ? metaFaturamento * (ll / faturamento) : 0;
    const totalGastos = custosPecasMes + gastosFixos + gastosVariaveis + totalComissoesPeriodo + depreciacao + impostos;
    const metaPct = metaGastos > 0 ? Math.min(100, (totalGastos / metaGastos) * 100) : 0;

    const reservaVal = Number(dre?.distribuicao?.reserva_valor ?? 0);
    const lucroDistrib = Number(dre?.distribuicao?.distribuivel ?? 0);
    const lucroSocio = lucroDistrib / Math.max(1, nSocios);

    // Operacional uses ALL orders (not filtered by period) for live status counts
    const ativas = allOrders.filter(o => isAtiva(o.status));
    const emAtraso = ativas.filter(o => o.previsao_entrega && new Date(o.previsao_entrega) < now && o.status !== "pronto").length;
    const aguardandoEntrega = ativas.filter(o => o.status === "pronto").length;
    const aguardandoReparo = ativas.filter(o => isAguardando(o.status)).length;
    const emReparo = ativas.filter(o => o.status === "em_reparo").length;

    const iphonesReparados = ordensMes.filter(o => {
      const marca = (o.aparelhos as any)?.marca?.toLowerCase() ?? "";
      const modelo = (o.aparelhos as any)?.modelo?.toLowerCase() ?? "";
      return marca.includes("apple") || modelo.includes("iphone");
    }).length;

    return {
      faturamento, custosPecasMes, despesasPagasMes, gastosFixos, gastosVariaveis, totalComissoesPeriodo,
      ebitda, ebitdaMargem, ll, llMargem, depreciacao, impostos,
      ticket, llPorAssist, prevLl, totalGastos, metaGastos, metaFaturamento,
      metaPct, reservaPct, nSocios, reservaVal, lucroDistrib, lucroSocio,
      emAtraso, aguardandoEntrega, aguardandoReparo, emReparo,
      totalOrdensMes: ordensMes.length, totalFaturadas: ordensFaturadas.length,
      totalRecebidasPeriodo: ordensMes.length,
      totalConcluidasPeriodo: ordensFaturadas.length,
      iphonesReparados,
    };
  }, [orders, allOrders, dre, empresaConfig]);

  // Chart: faturamento últimos 6 meses (always uses allOrders)
  const faturamentoChart = useMemo(() => {
    const meses: { mes: string; faturamento: number; lucroBruto: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = subMonths(new Date(), i);
      const start = startOfMonth(d);
      const end = endOfMonth(d);
      // Pega OS FATURADAS do mês usando data_conclusao (mesma regra da receita do mês atual)
      const ordensFaturadasMes = allOrders.filter(o => {
        if (!isFaturado(o.status) || !o.data_conclusao) return false;
        const dc = new Date(o.data_conclusao);
        return dc >= start && dc <= end;
      });
      const fat = ordensFaturadasMes.reduce(
        (s, o) => s + Number((o as any).valor_total ?? o.valor ?? 0),
        0
      );
      const custoPecas = ordensFaturadasMes.reduce(
        (s, o) => s + Number(o.custo_pecas ?? 0),
        0
      );
      // Lucro BRUTO (não inclui gastos fixos/variáveis/comissões — esses não estão
      // disponíveis por mês neste componente). É menos otimista que 30%, mas factual.
      const lucroBruto = fat - custoPecas;
      meses.push({
        mes: format(d, "MMM", { locale: ptBR }),
        faturamento: fat,
        lucroBruto,
      });
    }
    return meses;
  }, [allOrders]);

  // Alertas automáticos — financeiros filtrados por permissão
  const canFinanceiro = can("financeiro", "ver");
  const alertas = useMemo(() => {
    const list: { type: "warn" | "ok" | "error"; message: string }[] = [];

    if (canFinanceiro) {
      if (kpis.ll < 0)
        list.push({ type: "error", message: `Prejuízo de ${brl(Math.abs(kpis.ll))} este mês — revise os custos com urgência.` });
      if (kpis.llMargem >= 0 && kpis.llMargem < 10)
        list.push({ type: "warn", message: `Margem líquida baixa (${pct(kpis.llMargem)}) — atenção aos custos.` });
      if (kpis.faturamento > 0 && kpis.custosPecasMes / kpis.faturamento > 0.4)
        list.push({ type: "warn", message: `Custo de peças acima de 40% do faturamento — avalie a margem por serviço.` });
      if (kpis.metaGastos > 0 && kpis.totalGastos > kpis.metaGastos)
        list.push({ type: "warn", message: `Gastos ultrapassaram a meta mensal de ${brl(kpis.metaGastos)}.` });
      if (kpis.ll > 0 && kpis.llMargem >= 20)
        list.push({ type: "ok", message: `Ótima performance! Margem líquida de ${pct(kpis.llMargem)} este mês.` });
      if (kpis.ticket > 250)
        list.push({ type: "ok", message: `Ticket médio saudável de ${brl(kpis.ticket)} por OS.` });
    }

    if (kpis.aguardandoReparo > 20)
      list.push({ type: "warn", message: `${kpis.aguardandoReparo} aparelhos aguardando reparo — risco de insatisfação.` });
    if (kpis.emAtraso > 0)
      list.push({ type: "warn", message: `${kpis.emAtraso} OS com prazo vencido.` });

    return list;
  }, [kpis, canFinanceiro]);

  const socios = sociosList ?? [];

  // Distribuição por sócio respeitando percentual_participacao
  const partesSocios = useMemo(() => {
    return socios.map((s: any) => {
      const pct = Number(s.percentual_participacao ?? 0);
      return {
        id: s.id,
        nome: s.nome,
        percentual: pct,
        valor: kpis.lucroDistrib * (pct / 100),
      };
    });
  }, [socios, kpis.lucroDistrib]);

  const somaPctSocios = useMemo(
    () => partesSocios.reduce((acc, p) => acc + p.percentual, 0),
    [partesSocios]
  );
  const percentuaisOk = Math.abs(somaPctSocios - 100) < 0.01;

  // ─────────────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────────────

  // Empresa atacado (sem loja) nunca deve ficar presa no dashboard da assistência.
  const { atacadoAtivo, lojaAtivo, isLoading: modulosLoading } = useModulos();
  if (!modulosLoading && atacadoAtivo && !lojaAtivo) {
    return <Navigate to="/atacado/dashboard" replace />;
  }

  if (isLoading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6 md:space-y-8">

      {/* ── HEADER + PERIOD FILTER ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <h1 className="text-xl font-bold">Dashboard</h1>
        <DashboardPeriodFilter
          preset={periodPreset}
          range={periodRange}
          onChange={handlePeriodChange}
        />
      </div>

      <OnboardingWelcome />

      <ComboWidget compact />

      {/* ══════════════════════════════════════════════════════════════════════
          SEÇÃO 1 — FINANCEIRO DO MÊS
      ══════════════════════════════════════════════════════════════════════ */}
      {can("financeiro", "ver") && (
      <div>
        <div className="flex items-center gap-2 mb-3">
          <SectionTitle>Financeiro do período</SectionTitle>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="ghost" size="icon" className="h-7 w-7 -ml-1 text-muted-foreground">
                <Info className="h-4 w-4" />
              </Button>
            </PopoverTrigger>
            <PopoverContent side="bottom" align="start" className="w-72 text-xs space-y-2">
              <p>
                Faturamento e lucro contam OS <strong>concluídas</strong> (status Pronto ou Entregue) com data de conclusão dentro do período selecionado.
              </p>
              <p className="text-muted-foreground">
                Período: {format(periodRange.from, "dd/MM/yyyy")} – {format(periodRange.to, "dd/MM/yyyy")}
              </p>
            </PopoverContent>
          </Popover>
        </div>


        {/* ── MOBILE: hierarquia destacada ── */}
        <div className="grid grid-cols-1 gap-3 sm:hidden">
          {/* Card grande VERDE — Faturamento (a métrica que mais importa) */}
          <Card className="bg-primary text-primary-foreground border-0 shadow-lg">
            <CardContent className="p-4">
              <p className="text-[11px] uppercase tracking-wider opacity-80 font-medium">
                Faturamento
              </p>
              <p className="text-3xl font-bold mt-1 tracking-tight">{brl(kpis.faturamento)}</p>
              <p className="text-[11px] opacity-80 mt-1.5">
                {kpis.totalFaturadas} OS concluídas no período · margem {pct(kpis.faturamento > 0 ? (kpis.ll / kpis.faturamento) * 100 : 0)}
              </p>
            </CardContent>
          </Card>

          {/* Card branco — Lucro líquido */}
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium">
                    Lucro líquido
                  </p>
                  <p className={`text-2xl font-bold mt-1 tracking-tight ${kpis.ll >= 0 ? "text-foreground" : "text-destructive"}`}>
                    {brl(kpis.ll)}
                  </p>
                  <p className="text-[11px] text-muted-foreground mt-1">
                    EBITDA {brl(kpis.ebitda)} · margem {pct(kpis.llMargem)}
                  </p>
                </div>
                {kpis.ll >= 0 ? (
                  <TrendingUp className="h-5 w-5 text-primary" />
                ) : (
                  <TrendingDown className="h-5 w-5 text-destructive" />
                )}
              </div>
            </CardContent>
          </Card>

          {/* Pares menores */}
          <div className="grid grid-cols-2 gap-3">
            <Card>
              <CardContent className="p-3">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
                  Custo de peças
                </p>
                <p className="text-base font-semibold mt-1 tracking-tight">{brl(kpis.custosPecasMes)}</p>
                {kpis.faturamento > 0 && (
                  <p className="text-[10px] text-muted-foreground mt-0.5">
                    {pct((kpis.custosPecasMes / kpis.faturamento) * 100)} do fat.
                  </p>
                )}
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-3">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
                  Ticket médio
                </p>
                <p className="text-base font-semibold mt-1 tracking-tight">{brl(kpis.ticket)}</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">
                  {kpis.totalConcluidasPeriodo} OS concluídas no período
                </p>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* ── DESKTOP/TABLET: grid completa ── */}
        {/* Linha 1: Faturamento, EBITDA, Lucro Líquido, Saúde Financeira */}
        <div className="hidden sm:grid grid-cols-2 lg:grid-cols-4 gap-3">
          <MetricCard
            icon={DollarSign}
            label="Faturamento"
            value={brl(kpis.faturamento)}
            iconColor="text-blue-500"
            badge={
              <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded-full">
                {kpis.totalFaturadas} concluídas
              </span>
            }
          />
          <MetricCard
            icon={TrendingUp}
            label="EBITDA"
            value={brl(kpis.ebitda)}
            color={kpis.ebitda >= 0 ? "text-green-600" : "text-red-600"}
            iconColor={kpis.ebitda >= 0 ? "text-green-500" : "text-red-500"}
            badge={
              <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${kpis.ebitda >= 0 ? "text-green-500" : "text-red-500"}`}>
                {pct(kpis.ebitdaMargem)}
              </span>
            }
          />
          <MetricCard
            icon={kpis.ll >= 0 ? TrendingUp : TrendingDown}
            label="Lucro líquido"
            value={brl(kpis.ll)}
            sub={`margem ${pct(kpis.llMargem)}`}
            color={kpis.ll >= 0 ? "text-green-600" : "text-red-600"}
            iconColor={kpis.ll >= 0 ? "text-green-500" : "text-red-500"}
            badge={
              <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${kpis.ll >= 0 ? "text-green-500" : "text-red-500"}`}>
                {pct(kpis.llMargem)}
              </span>
            }
          />
          <MetricCard
            icon={Target}
            label="Saúde financeira"
            value={kpis.llMargem < 0 ? "Prejuízo" : kpis.llMargem >= 30 ? "Excelente" : kpis.llMargem >= 15 ? "Saudável" : kpis.llMargem >= 5 ? "Atenção" : "Crítica"}
            color={kpis.llMargem < 0 ? "text-red-600" : kpis.llMargem >= 30 ? "text-green-600" : kpis.llMargem >= 15 ? "text-blue-600" : kpis.llMargem >= 5 ? "text-amber-600" : "text-red-600"}
            iconColor={kpis.llMargem < 0 ? "text-red-500" : kpis.llMargem >= 15 ? "text-green-500" : kpis.llMargem >= 5 ? "text-amber-500" : "text-red-500"}
          />
        </div>

        {/* Linha 2: Peças, Fixos, Variáveis, Comissões, Impostos, Ticket — só desktop */}
        <div className="hidden sm:grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mt-3">
          <MetricCard
            icon={Package}
            label="Custo de peças"
            value={brl(kpis.custosPecasMes)}
            sub={kpis.faturamento > 0 ? `${pct((kpis.custosPecasMes / kpis.faturamento) * 100)} do fat.` : undefined}
            iconColor="text-orange-500"
          />
          <MetricCard
            icon={Receipt}
            label="Gastos fixos"
            value={brl(kpis.gastosFixos)}
            iconColor="text-muted-foreground"
            sub={
              competenciaInfo.fracao
                ? `Mês inteiro de competência (${competenciaInfo.meses.join(", ")})`
                : `Competência: ${competenciaInfo.meses.join(", ")}`
            }
          />
          <MetricCard
            icon={Receipt}
            label="Gastos variáveis"
            value={brl(kpis.gastosVariaveis)}
            iconColor="text-orange-500"
            sub={
              competenciaInfo.fracao
                ? `Mês inteiro de competência (${competenciaInfo.meses.join(", ")})`
                : `Competência: ${competenciaInfo.meses.join(", ")}`
            }
          />
          <MetricCard
            icon={Users}
            label="Comissões"
            value={brl(kpis.totalComissoesPeriodo)}
            sub={
              kpis.faturamento > 0
                ? `${pct((kpis.totalComissoesPeriodo / kpis.faturamento) * 100)} do fat.`
                : undefined
            }
            iconColor="text-purple-500"
          />
          <MetricCard icon={CreditCard} label="Impostos" value={brl(kpis.impostos)} iconColor="text-muted-foreground" />
          <MetricCard icon={DollarSign} label="Ticket médio" value={brl(kpis.ticket)} iconColor="text-blue-500" />
        </div>

        {/* Fórmula resumida */}
        <Card className="mt-3">
          <CardContent className="p-3 space-y-2">
            {/* Desktop: fórmula em linha */}
            <p className="hidden sm:block text-xs text-muted-foreground">
              <strong>EBITDA:</strong>{" "}
              {brl(kpis.faturamento)} − Peças ({brl(kpis.custosPecasMes)}) − Fixos ({brl(kpis.gastosFixos)}) − Variáveis ({brl(kpis.gastosVariaveis)}) − Comissões ({brl(kpis.totalComissoesPeriodo)}) ={" "}
              <strong className={kpis.ebitda >= 0 ? "text-green-600" : "text-red-600"}>{brl(kpis.ebitda)}</strong>
            </p>
            <p className="hidden sm:block text-xs text-muted-foreground">
              <strong>Lucro líquido:</strong>{" "}
              EBITDA ({brl(kpis.ebitda)}) − Depreciação ({brl(kpis.depreciacao)}) − Impostos ({brl(kpis.impostos)}) ={" "}
              <strong className={kpis.ll >= 0 ? "text-green-600" : "text-red-600"}>{brl(kpis.ll)}</strong>
            </p>

            {/* Mobile: lista vertical */}
            <div className="sm:hidden space-y-1.5">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">EBITDA</p>
              <dl className="text-xs space-y-1 tabular-nums">
                <div className="flex justify-between"><dt className="text-muted-foreground">Faturamento</dt><dd>{brl(kpis.faturamento)}</dd></div>
                <div className="flex justify-between"><dt className="text-muted-foreground">(–) Peças</dt><dd>{brl(kpis.custosPecasMes)}</dd></div>
                <div className="flex justify-between"><dt className="text-muted-foreground">(–) Fixos</dt><dd>{brl(kpis.gastosFixos)}</dd></div>
                <div className="flex justify-between"><dt className="text-muted-foreground">(–) Variáveis</dt><dd>{brl(kpis.gastosVariaveis)}</dd></div>
                <div className="flex justify-between"><dt className="text-muted-foreground">(–) Comissões</dt><dd>{brl(kpis.totalComissoesPeriodo)}</dd></div>
                <div className="flex justify-between border-t pt-1 mt-1 font-semibold">
                  <dt>= EBITDA</dt>
                  <dd className={kpis.ebitda >= 0 ? "text-green-600" : "text-red-600"}>{brl(kpis.ebitda)}</dd>
                </div>
              </dl>

              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground pt-2">Lucro líquido</p>
              <dl className="text-xs space-y-1 tabular-nums">
                <div className="flex justify-between"><dt className="text-muted-foreground">EBITDA</dt><dd>{brl(kpis.ebitda)}</dd></div>
                <div className="flex justify-between"><dt className="text-muted-foreground">(–) Depreciação</dt><dd>{brl(kpis.depreciacao)}</dd></div>
                <div className="flex justify-between"><dt className="text-muted-foreground">(–) Impostos</dt><dd>{brl(kpis.impostos)}</dd></div>
                <div className="flex justify-between border-t pt-1 mt-1 font-semibold">
                  <dt>= Lucro líquido</dt>
                  <dd className={kpis.ll >= 0 ? "text-green-600" : "text-red-600"}>{brl(kpis.ll)}</dd>
                </div>
              </dl>
            </div>

            {competenciaInfo.fracao && (
              <p className="text-xs text-muted-foreground mt-2 break-words">
                ⓘ Faturamento, peças e comissões respeitam o range exato de datas. Gastos fixos e variáveis sempre contam o mês inteiro de competência ({competenciaInfo.meses.join(", ")}) — por isso o EBITDA pode parecer mais negativo em filtros de fração de mês.
              </p>
            )}
          </CardContent>
        </Card>


        {/* Card: Meta mensal de faturamento */}
        <Card className="mt-3">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Target className="h-4 w-4 text-blue-500" />
                <span className="text-sm font-medium">Meta mensal de faturamento</span>
              </div>
              {kpis.metaFaturamento > 0 && (
                <span className="text-xs text-muted-foreground">
                  {brl(kpis.faturamento)} / {brl(kpis.metaFaturamento)}
                </span>
              )}
            </div>
            {kpis.metaFaturamento > 0 ? (() => {
              const metaFatPct = Math.min(100, (kpis.faturamento / kpis.metaFaturamento) * 100);
              const progressColor = metaFatPct >= 80 ? "[&>div]:bg-green-500" : metaFatPct >= 50 ? "[&>div]:bg-amber-500" : "[&>div]:bg-red-500";
              const labelColor = metaFatPct >= 80 ? "text-green-600" : metaFatPct >= 50 ? "text-amber-600" : "text-red-600";
              return (
                <>
                  <Progress value={metaFatPct} className={`h-3 ${progressColor}`} />
                  <div className="flex justify-between text-[10px] mt-1">
                    <span className={`font-semibold ${labelColor}`}>{pct(metaFatPct)} atingido</span>
                    <span className="text-muted-foreground">
                      {kpis.faturamento >= kpis.metaFaturamento
                        ? `Meta batida! +${brl(kpis.faturamento - kpis.metaFaturamento)}`
                        : `Faltam ${brl(kpis.metaFaturamento - kpis.faturamento)}`}
                    </span>
                  </div>
                </>
              );
            })() : (
              <div className="flex items-center gap-2">
                <p className="text-xs text-muted-foreground">Nenhuma meta definida.</p>
                <Button
                  size="sm"
                  variant="outline"
                  className="text-xs h-7"
                  onClick={() => navigate("/configuracoes")}
                >
                  <Settings className="h-3 w-3 mr-1" /> Definir meta
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          SEÇÃO 2 — GASTOS E PREVISÕES
      ══════════════════════════════════════════════════════════════════════ */}
      {can("financeiro", "ver") && (
      <div>
        <SectionTitle>Gastos e previsões</SectionTitle>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <MetricCard icon={Receipt} label="Total gastos do período" value={brl(kpis.totalGastos)} iconColor="text-red-500" />
          <MetricCard icon={Receipt} label="Depreciação" value={brl(kpis.depreciacao)} iconColor="text-muted-foreground" />
          <MetricCard
            icon={Target}
            label="Previsão faturamento"
            value={kpis.metaFaturamento > 0 ? brl(kpis.metaFaturamento) : "Não definida"}
            sub={kpis.metaFaturamento > 0 && kpis.faturamento > 0 ? `${pct((kpis.faturamento / kpis.metaFaturamento) * 100)} realizado` : undefined}
            iconColor="text-blue-400"
            color={kpis.metaFaturamento > 0 ? "text-blue-600" : "text-muted-foreground"}
          />
          <MetricCard
            icon={TrendingUp}
            label="Previsão lucro líq."
            value={kpis.prevLl > 0 ? brl(kpis.prevLl) : "—"}
            sub={kpis.metaFaturamento > 0 ? `margem estimada ${pct(kpis.llMargem)}` : undefined}
            color={kpis.prevLl > 0 ? "text-green-600" : "text-muted-foreground"}
            iconColor="text-green-400"
          />
        </div>

        {/* Barra de progresso: gastos vs meta */}
        <Card className="mt-3">
          <CardContent className="p-3">
            <div className="flex items-center justify-between text-xs mb-2">
              <div className="flex items-center gap-2">
                <Target className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-muted-foreground font-medium">Gastos vs meta mensal</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-semibold">{brl(kpis.totalGastos)}</span>
                <span className="text-muted-foreground">/ {kpis.metaGastos > 0 ? brl(kpis.metaGastos) : "sem meta"}</span>
              </div>
            </div>
            {kpis.metaGastos > 0 ? (
              <>
                <Progress
                  value={kpis.metaPct}
                  className={`h-3 ${kpis.metaPct > 100 ? "[&>div]:bg-red-500" : kpis.metaPct > 80 ? "[&>div]:bg-amber-500" : "[&>div]:bg-green-500"}`}
                />
                <div className="flex justify-between text-[10px] text-muted-foreground mt-1">
                  <span>{pct(kpis.metaPct)} utilizado</span>
                  <span className={
                    kpis.totalGastos > kpis.metaGastos
                      ? "text-red-500 font-medium"
                      : kpis.totalGastos > kpis.metaGastos * 0.8
                        ? "text-amber-500 font-medium"
                        : "text-green-500 font-medium"
                  }>
                    {kpis.totalGastos > kpis.metaGastos
                      ? `${brl(kpis.totalGastos - kpis.metaGastos)} acima da meta`
                      : `${brl(kpis.metaGastos - kpis.totalGastos)} disponível`}
                  </span>
                </div>
              </>
            ) : (
              <p className="text-xs text-muted-foreground">
                Configure uma meta em{" "}
                <span onClick={() => navigate("/configuracoes")} className="text-blue-500 underline cursor-pointer">
                  Configurações
                </span>
              </p>
            )}
          </CardContent>
        </Card>
      </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          SEÇÃO 3 — OPERACIONAL
      ══════════════════════════════════════════════════════════════════════ */}
      <div>
        <SectionTitle>Operacional</SectionTitle>

        {/* Sub-bloco A — Movimento do período (respeita o filtro) */}
        <div className="mb-3">
          <p className="text-[11px] uppercase tracking-wider text-muted-foreground mb-2">
            Movimento do período
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <MetricCard
              icon={Wrench}
              label="OS recebidas"
              value={String(kpis.totalRecebidasPeriodo)}
              sub="entrada no período"
              iconColor="text-blue-500"
            />
            <MetricCard
              icon={CheckCircle}
              label="OS concluídas"
              value={String(kpis.totalConcluidasPeriodo)}
              sub="conclusão no período"
              iconColor="text-green-500"
            />
            <MetricCard
              icon={Smartphone}
              label="iPhones recebidos"
              value={String(kpis.iphonesReparados)}
              sub={
                kpis.totalRecebidasPeriodo > 0
                  ? pct((kpis.iphonesReparados / kpis.totalRecebidasPeriodo) * 100)
                  : "—"
              }
              iconColor="text-muted-foreground"
            />
            {can("financeiro", "ver") && (
              <MetricCard
                icon={DollarSign}
                label="Lucro líq. / OS concluída"
                value={brl(
                  kpis.totalConcluidasPeriodo > 0
                    ? kpis.ll / kpis.totalConcluidasPeriodo
                    : 0
                )}
                color={kpis.ll >= 0 ? "text-green-600" : "text-red-600"}
                iconColor={kpis.ll >= 0 ? "text-green-400" : "text-red-400"}
              />
            )}
          </div>
        </div>

        {/* Sub-bloco B — Snapshot ao vivo (ignora período, mostra estado atual) */}
        <div>
          <p className="text-[11px] uppercase tracking-wider text-muted-foreground mb-2">
            Status atual <span className="text-[10px] normal-case opacity-70">(não depende do período)</span>
          </p>
          {kpis.aguardandoReparo + kpis.emReparo + kpis.aguardandoEntrega + kpis.emAtraso === 0 ? (
            <div className="rounded-lg border border-dashed border-muted-foreground/30 px-4 py-6 text-center text-sm text-muted-foreground">
              Nenhuma OS ativa no momento. Tudo em dia. ✅
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <MetricCard
                icon={Clock}
                label="Aguardando reparo"
                value={String(kpis.aguardandoReparo)}
                color={kpis.aguardandoReparo > 20 ? "text-amber-600" : "text-foreground"}
                iconColor={kpis.aguardandoReparo > 20 ? "text-amber-500" : "text-muted-foreground"}
              />
              <MetricCard
                icon={Wrench}
                label="Em reparo"
                value={String(kpis.emReparo)}
                iconColor="text-blue-400"
              />
              <MetricCard
                icon={CheckCircle}
                label="Prontos p/ entrega"
                value={String(kpis.aguardandoEntrega)}
                iconColor="text-green-500"
              />
              <MetricCard
                icon={AlertTriangle}
                label="Em atraso"
                value={String(kpis.emAtraso)}
                color={kpis.emAtraso > 0 ? "text-red-600" : "text-foreground"}
                iconColor={kpis.emAtraso > 0 ? "text-red-500" : "text-muted-foreground"}
              />
            </div>
          )}
        </div>

        {/* Custo médio fica como rodapé do Operacional */}
        {can("financeiro", "ver") && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
            <MetricCard
              icon={Package}
              label="Custo médio / OS concluída"
              value={brl(
                kpis.totalConcluidasPeriodo > 0
                  ? (kpis.custosPecasMes + kpis.gastosFixos) / kpis.totalConcluidasPeriodo
                  : 0
              )}
              sub="peças + fixos do período"
              iconColor="text-muted-foreground"
            />
          </div>
        )}
      </div>

      {/* ══════════════════════════════════════════════════════════════════════
          SEÇÃO 4 — DISTRIBUIÇÃO DO LUCRO
      ══════════════════════════════════════════════════════════════════════ */}
      {can("financeiro", "ver") && (
      <div>
        <SectionTitle>Distribuição do lucro</SectionTitle>

        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center gap-2 mb-1">
              <Users className="h-4 w-4 text-blue-500" />
              <span className="text-sm font-semibold">Lucro por sócio</span>
              <span className="text-[10px] text-muted-foreground ml-auto">
                {pct(kpis.reservaPct)} reservado para empresa
              </span>
            </div>

            {kpis.ll <= 0 ? (
              <p className="text-xs text-muted-foreground">Sem lucro a distribuir neste período.</p>
            ) : (
              <>
                {/* Barra visual da divisão */}
                <div className="flex rounded-full overflow-hidden h-3">
                  <div className="bg-amber-400" style={{ width: `${kpis.reservaPct}%` }} />
                  <div className="bg-green-500" style={{ width: `${100 - kpis.reservaPct}%` }} />
                </div>
                <div className="flex justify-between text-[10px] text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <span className="h-2 w-2 rounded-full bg-amber-400 inline-block" />
                    Reserva empresa {brl(kpis.reservaVal)}
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="h-2 w-2 rounded-full bg-green-500 inline-block" />
                    Distribuível {brl(kpis.lucroDistrib)}
                  </span>
                </div>

                {/* Sócios */}
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 mt-2">
                  {partesSocios.map((p, i) => {
                    const nome = p.nome?.trim() || `Sócio ${i + 1}`;
                    return (
                      <div key={p.id} className="border rounded-lg p-3 bg-green-50">
                        <div className="flex items-center gap-2 mb-2">
                          <div className="h-7 w-7 rounded-full bg-green-100 text-green-700 flex items-center justify-center text-xs font-bold">
                            {nome[0]?.toUpperCase() || String(i + 1)}
                          </div>
                          <div className="flex flex-col leading-tight">
                            <span className="text-xs font-medium text-muted-foreground">{nome}</span>
                            <span className="text-[10px] text-muted-foreground">{p.percentual.toFixed(2)}%</span>
                          </div>
                        </div>
                        <p className="text-sm font-bold text-green-600">{brl(p.valor)}</p>
                      </div>
                    );
                  })}
                </div>
                {!percentuaisOk && partesSocios.length > 0 && (
                  <p className="text-[11px] text-amber-600 mt-1">
                    ⚠ Percentuais somam {somaPctSocios.toFixed(2)}%, ajuste em Configurações &gt; Financeiro
                  </p>
                )}
              </>
            )}

            <button
              onClick={() => navigate("/configuracoes")}
              className="mt-3 text-xs text-blue-500 flex items-center gap-1 hover:underline"
            >
              <Settings className="h-3 w-3" /> Editar sócios e reserva
            </button>
          </CardContent>
        </Card>
      </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          SEÇÃO 5 — ALERTAS AUTOMÁTICOS
      ══════════════════════════════════════════════════════════════════════ */}
      {alertas.length > 0 && (
        <div>
          <SectionTitle>Alertas automáticos</SectionTitle>
          <div className="space-y-1.5">
            {alertas.map((a, i) => (
              <AlertCard key={i} type={a.type} message={a.message} />
            ))}
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          GRÁFICO — FATURAMENTO x LUCRO (6 meses)
      ══════════════════════════════════════════════════════════════════════ */}
      {can("financeiro", "ver") && (
      <div>
        <SectionTitle>Faturamento x Lucro Bruto</SectionTitle>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-4 text-xs">
                <span className="flex items-center gap-1">
                  <span className="h-2.5 w-2.5 rounded-sm bg-blue-500 inline-block" />
                  Faturamento
                </span>
                <span className="flex items-center gap-1">
                  <span className="h-2.5 w-2.5 rounded-sm bg-green-500 inline-block" />
                  Lucro bruto
                </span>
              </div>
              <span className="text-[10px] text-muted-foreground">Últimos 6 meses</span>
            </div>
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={faturamentoChart} barGap={2}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
                  <XAxis dataKey="mes" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v)} />
                  <RTooltip
                    formatter={(value: number) => brl(value)}
                    contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #e5e7eb" }}
                  />
                  <Bar dataKey="faturamento" name="Faturamento" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="lucroBruto" name="Lucro bruto" fill="#22c55e" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <p className="text-[10px] text-muted-foreground mt-2">
              Lucro bruto = Faturamento − Custo de peças. Não inclui despesas fixas, comissões ou impostos.
            </p>
          </CardContent>
        </Card>
      </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          ORDENS POR STATUS
      ══════════════════════════════════════════════════════════════════════ */}
      <div>
        <SectionTitle>Ordens por status</SectionTitle>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground mb-3">
              Snapshot ao vivo · {allOrders.filter(o => isAtiva(o.status)).length} ativas no momento
              <span className="block text-[10px] opacity-70 mt-0.5">
                Esta seção mostra todas as OS da empresa, independente do período selecionado.
              </span>
            </p>
            <div className="space-y-2">
              {Object.entries(STATUS_LABELS)
                .filter(([key]) => key !== "cancelado")
                .map(([key, label]) => {
                const count = allOrders.filter(o => o.status === key).length;
                if (count === 0) return null;
                return (
                  <div key={key} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Badge className={STATUS_COLORS[key]}>
                        {label}
                      </Badge>
                    </div>
                    <span className="text-sm font-semibold">{count}</span>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>

    </div>
  );
}
