import { useState, useMemo } from "react";
import { OnboardingWelcome } from "@/components/OnboardingWelcome";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
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
  Settings, Loader2, Receipt, CreditCard,
} from "lucide-react";
import { format, startOfMonth, endOfMonth, subMonths, differenceInHours } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RTooltip,
  ResponsiveContainer,
} from "recharts";

// ─── TIPOS ────────────────────────────────────────────────────────────────────

type OrderRow = {
  id: string;
  numero: number;
  status: string;
  data_entrada: string;
  data_conclusao: string | null;
  previsao_entrega: string | null;
  valor: number | null;
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
};

const STATUS_COLORS: Record<string, string> = {
  recebido: "bg-blue-100 text-blue-700",
  em_analise: "bg-green-100 text-green-700",
  aguardando_aprovacao: "bg-orange-100 text-orange-700",
  em_reparo: "bg-blue-100 text-blue-700",
  pronto: "bg-green-100 text-green-700",
  entregue: "bg-gray-100 text-gray-600",
};

const isFaturado = (s: string) => s === "pronto" || s === "entregue";
const isAguardando = (s: string) =>
  ["recebido", "em_analise", "em_reparo"].includes(s);
const isAtrasado = (s: string, prazo: string | null | undefined) => {
  if (!prazo) return false;
  return new Date(prazo) < new Date() && !isFaturado(s);
};
const isIphone = (modelo: string) =>
  /iphone|apple/i.test(modelo || "");

// ─── FORMATAÇÃO ───────────────────────────────────────────────────────────────

const brl = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

const pct = (v: number) => `${v.toFixed(1)}%`;

// ─── COMPONENTES AUXILIARES ───────────────────────────────────────────────────

function MetricCard({
  icon: Icon,
  label,
  value,
  sub,
  color = "text-gray-900",
  bg = "bg-white",
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

async function fetchDashboardSummary() {
  const { data, error } = await supabase.rpc("get_dashboard_summary");
  if (error) throw error;
  return data as {
    ordens: OrderRow[];
    estoque_baixo: number;
    contas_pendentes: any[];
    comissoes_pendentes: any[];
    lojas: { id: string; nome: string }[];
  };
}

async function fetchContasPagas() {
  const now = new Date();
  const ms = startOfMonth(now);
  const me = endOfMonth(now);
  const { data, error } = await supabase
    .from("contas_a_pagar")
    .select("valor, data_pagamento, categoria, categoria_financeira_id, categorias_financeiras ( tipo )")
    .eq("status", "paga")
    .gte("data_pagamento", ms.toISOString().split("T")[0])
    .lte("data_pagamento", me.toISOString().split("T")[0]);
  if (error) throw error;
  return data ?? [];
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
    .select("id, nome, ordem")
    .eq("ativo", true)
    .order("ordem");
  if (error) throw error;
  return data ?? [];
}

// ─── COMPONENTE PRINCIPAL ─────────────────────────────────────────────────────

export default function Dashboard() {
  const navigate = useNavigate();
  const { can } = usePermissoes();

  // ── QUERIES ──────────────────────────────────────────────────────────────

  const { data: summary, isLoading } = useQuery({
    queryKey: ["dashboard-summary"],
    queryFn: fetchDashboardSummary,
    refetchInterval: 60000,
  });

  const { data: contasPagas } = useQuery({
    queryKey: ["dashboard-contas-pagas"],
    queryFn: fetchContasPagas,
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

  const orders = summary?.ordens ?? [];

  // ── CÁLCULOS ────────────────────────────────────────────────────────────

  const kpis = useMemo(() => {
    const now = new Date();
    const mesAtual = now.getMonth();
    const anoAtual = now.getFullYear();

    const ordensMes = orders.filter(o => {
      const d = new Date(o.data_entrada);
      return d.getMonth() === mesAtual && d.getFullYear() === anoAtual;
    });

    const ordensFaturadas = ordensMes.filter(o => isFaturado(o.status));
    const faturamento = ordensFaturadas.reduce((s, o) => s + Number(o.valor ?? 0), 0);
    const custosPecasMes = ordensMes.reduce((s, o) => s + Number(o.custo_pecas ?? 0), 0);

    const allContasPagas = contasPagas ?? [];
    const despesasPagasMes = allContasPagas.reduce((s: number, c: any) => s + Number(c.valor ?? 0), 0);
    const gastosFixos = allContasPagas
      .filter((c: any) => c.categorias_financeiras?.tipo === "fixo")
      .reduce((s: number, c: any) => s + Number(c.valor ?? 0), 0);
    const gastosVariaveis = despesasPagasMes - gastosFixos;

    // EBITDA
    const ebitda = faturamento - custosPecasMes - gastosFixos - gastosVariaveis;
    const ebitdaMargem = faturamento > 0 ? (ebitda / faturamento) * 100 : 0;

    // Lucro líquido (sem ajustes extras como no código original — estimado)
    const depreciacao = 0;
    const impostos = 0;
    const ll = ebitda - depreciacao - impostos;
    const llMargem = faturamento > 0 ? (ll / faturamento) * 100 : 0;

    // Ticket médio
    const ordensComValor = ordensFaturadas.filter(o => Number(o.valor ?? 0) > 0);
    const ticket = ordensComValor.length > 0
      ? ordensComValor.reduce((s, o) => s + Number(o.valor ?? 0), 0) / ordensComValor.length
      : 0;

    const llPorAssist = ordensMes.length > 0 ? ll / ordensMes.length : 0;

    // Metas
    const metaGastos = Number(empresaConfig?.meta_gastos_mes ?? 0);
    const metaFaturamento = Number(empresaConfig?.meta_faturamento_mes ?? 0);
    const reservaPct = Number(empresaConfig?.percentual_reserva_empresa ?? 20);
    const nSocios = Number(empresaConfig?.numero_socios ?? 2) || 1;

    const prevLl = metaFaturamento > 0 && faturamento > 0 ? metaFaturamento * (ll / faturamento) : 0;
    const totalGastos = custosPecasMes + despesasPagasMes + depreciacao + impostos;
    const metaPct = metaGastos > 0 ? Math.min(100, (totalGastos / metaGastos) * 100) : 0;

    // Distribuição
    const reservaVal = ll > 0 ? (ll * reservaPct) / 100 : 0;
    const lucroDistrib = ll > 0 ? ll - reservaVal : 0;
    const lucroSocio = lucroDistrib / Math.max(1, nSocios);

    // Operacional
    const ativas = orders.filter(o => o.status !== "entregue");
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
      faturamento, custosPecasMes, despesasPagasMes, gastosFixos, gastosVariaveis,
      ebitda, ebitdaMargem, ll, llMargem, depreciacao, impostos,
      ticket, llPorAssist, prevLl, totalGastos, metaGastos, metaFaturamento,
      metaPct, reservaPct, nSocios, reservaVal, lucroDistrib, lucroSocio,
      emAtraso, aguardandoEntrega, aguardandoReparo, emReparo,
      totalOrdensMes: ordensMes.length, totalFaturadas: ordensFaturadas.length,
      iphonesReparados,
    };
  }, [orders, contasPagas, empresaConfig]);

  // Chart: faturamento últimos 6 meses
  const faturamentoChart = useMemo(() => {
    const meses: { mes: string; faturamento: number; lucro: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = subMonths(new Date(), i);
      const start = startOfMonth(d);
      const end = endOfMonth(d);
      const mesOrdens = orders.filter(o => {
        const de = new Date(o.data_entrada);
        return de >= start && de <= end;
      });
      const fat = mesOrdens.filter(o => isFaturado(o.status)).reduce((s, o) => s + Number(o.valor ?? 0), 0);
      meses.push({
        mes: format(d, "MMM", { locale: ptBR }),
        faturamento: fat,
        lucro: fat * 0.3, // estimado como no código original
      });
    }
    return meses;
  }, [orders]);


  // Alertas automáticos
  const alertas = useMemo(() => {
    const list: { type: "warn" | "ok" | "error"; message: string }[] = [];
    if (kpis.ll < 0)
      list.push({ type: "error", message: `Prejuízo de ${brl(Math.abs(kpis.ll))} este mês — revise os custos com urgência.` });
    if (kpis.llMargem >= 0 && kpis.llMargem < 10)
      list.push({ type: "warn", message: `Margem líquida baixa (${pct(kpis.llMargem)}) — atenção aos custos.` });
    if (kpis.faturamento > 0 && kpis.custosPecasMes / kpis.faturamento > 0.4)
      list.push({ type: "warn", message: `Custo de peças acima de 40% do faturamento — avalie a margem por serviço.` });
    if (kpis.aguardandoReparo > 20)
      list.push({ type: "warn", message: `${kpis.aguardandoReparo} aparelhos aguardando reparo — risco de insatisfação.` });
    if (kpis.emAtraso > 0)
      list.push({ type: "warn", message: `${kpis.emAtraso} OS com prazo vencido.` });
    if (kpis.metaGastos > 0 && kpis.totalGastos > kpis.metaGastos)
      list.push({ type: "warn", message: `Gastos ultrapassaram a meta mensal de ${brl(kpis.metaGastos)}.` });
    if (kpis.ll > 0 && kpis.llMargem >= 20)
      list.push({ type: "ok", message: `Ótima performance! Margem líquida de ${pct(kpis.llMargem)} este mês.` });
    if (kpis.ticket > 250)
      list.push({ type: "ok", message: `Ticket médio saudável de ${brl(kpis.ticket)} por OS.` });
    return list;
  }, [kpis]);

  const socios = sociosList ?? [];

  // ─────────────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6 md:space-y-8">

      {/* ── HEADER ── */}
      <h1 className="text-xl font-bold">Dashboard</h1>

      <OnboardingWelcome />

      {/* ══════════════════════════════════════════════════════════════════════
          SEÇÃO 1 — FINANCEIRO DO MÊS (só para quem tem permissão)
      ══════════════════════════════════════════════════════════════════════ */}
      {can("financeiro", "ver") && (<>
      <div>
        <SectionTitle>Financeiro do mês</SectionTitle>

        {/* Linha 1: Faturamento, EBITDA, Lucro Líquido, Saúde Financeira */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <MetricCard
            icon={DollarSign}
            label="Faturamento"
            value={brl(kpis.faturamento)}
            iconColor="text-blue-500"
            badge={
              <span className="text-[10px] text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded-full">
                {kpis.totalFaturadas} OS
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
            value={kpis.llMargem >= 20 ? "Excelente" : kpis.llMargem >= 10 ? "Saudável" : kpis.llMargem >= 0 ? "Atenção" : "Prejuízo"}
            color={kpis.llMargem >= 20 ? "text-green-600" : kpis.llMargem >= 10 ? "text-blue-600" : kpis.llMargem >= 0 ? "text-amber-600" : "text-red-600"}
            iconColor={kpis.llMargem >= 10 ? "text-green-500" : "text-amber-500"}
          />
        </div>

        {/* Linha 2: Peças, Fixos, Depreciação, Impostos, Ticket */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mt-3">
          <MetricCard
            icon={Package}
            label="Custo de peças"
            value={brl(kpis.custosPecasMes)}
            sub={kpis.faturamento > 0 ? `${pct((kpis.custosPecasMes / kpis.faturamento) * 100)} do fat.` : undefined}
            iconColor="text-orange-500"
          />
          <MetricCard icon={Receipt} label="Gastos fixos" value={brl(kpis.gastosFixos)} iconColor="text-gray-500" />
          <MetricCard icon={Receipt} label="Depreciação" value={brl(kpis.depreciacao)} iconColor="text-gray-500" />
          <MetricCard icon={CreditCard} label="Impostos" value={brl(kpis.impostos)} iconColor="text-gray-500" />
          <MetricCard icon={DollarSign} label="Ticket médio" value={brl(kpis.ticket)} iconColor="text-blue-500" />
        </div>

        {/* Fórmula resumida */}
        <Card className="mt-3">
          <CardContent className="p-3 space-y-1">
            <p className="text-xs text-muted-foreground">
              <strong>EBITDA:</strong>{" "}
              {brl(kpis.faturamento)} − Peças ({brl(kpis.custosPecasMes)}) − Fixos ({brl(kpis.gastosFixos)}) − Outros ({brl(kpis.gastosVariaveis)}) ={" "}
              <strong className={kpis.ebitda >= 0 ? "text-green-600" : "text-red-600"}>{brl(kpis.ebitda)}</strong>
            </p>
            <p className="text-xs text-muted-foreground">
              <strong>Lucro líquido:</strong>{" "}
              EBITDA ({brl(kpis.ebitda)}) − Depreciação ({brl(kpis.depreciacao)}) − Impostos ({brl(kpis.impostos)}) ={" "}
              <strong className={kpis.ll >= 0 ? "text-green-600" : "text-red-600"}>{brl(kpis.ll)}</strong>
            </p>
          </CardContent>
        </Card>
      </div>

      {/* ══════════════════════════════════════════════════════════════════════
          SEÇÃO 2 — GASTOS E PREVISÕES
      ══════════════════════════════════════════════════════════════════════ */}
      <div>
        <SectionTitle>Gastos e previsões</SectionTitle>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <MetricCard icon={Receipt} label="Total gastos do mês" value={brl(kpis.totalGastos)} iconColor="text-red-500" />
          <MetricCard icon={Receipt} label="Gastos variáveis" value={brl(kpis.gastosVariaveis)} iconColor="text-orange-500" />
          <MetricCard
            icon={Target}
            label="Previsão faturamento"
            value={kpis.metaFaturamento > 0 ? brl(kpis.metaFaturamento) : "Não definida"}
            sub={kpis.metaFaturamento > 0 && kpis.faturamento > 0 ? `${pct((kpis.faturamento / kpis.metaFaturamento) * 100)} realizado` : undefined}
            iconColor="text-blue-400"
            color={kpis.metaFaturamento > 0 ? "text-blue-600" : "text-gray-400"}
          />
          <MetricCard
            icon={TrendingUp}
            label="Previsão lucro líq."
            value={kpis.prevLl > 0 ? brl(kpis.prevLl) : "—"}
            sub={kpis.metaFaturamento > 0 ? `margem estimada ${pct(kpis.llMargem)}` : undefined}
            color={kpis.prevLl > 0 ? "text-green-600" : "text-gray-400"}
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
      </div>}

      {/* ══════════════════════════════════════════════════════════════════════
          SEÇÃO 3 — OPERACIONAL
      ══════════════════════════════════════════════════════════════════════ */}
      <div>
        <SectionTitle>Operacional</SectionTitle>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <MetricCard icon={Wrench} label="Assistências no mês" value={String(kpis.totalOrdensMes)} iconColor="text-blue-500" />
          <MetricCard
            icon={Smartphone}
            label="iPhones"
            value={String(kpis.iphonesReparados)}
            sub={kpis.totalOrdensMes > 0 ? pct((kpis.iphonesReparados / kpis.totalOrdensMes) * 100) : "—"}
            iconColor="text-gray-600"
          />
          <MetricCard
            icon={Clock}
            label="Aguardando reparo"
            value={String(kpis.aguardandoReparo)}
            color={kpis.aguardandoReparo > 20 ? "text-amber-600" : "text-gray-900"}
            iconColor={kpis.aguardandoReparo > 20 ? "text-amber-500" : "text-gray-400"}
          />
          <MetricCard icon={Wrench} label="Em reparo" value={String(kpis.emReparo)} iconColor="text-blue-400" />
          <MetricCard icon={CheckCircle} label="Prontos p/ entrega" value={String(kpis.aguardandoEntrega)} iconColor="text-green-500" />
          <MetricCard
            icon={AlertTriangle}
            label="Em atraso"
            value={String(kpis.emAtraso)}
            color={kpis.emAtraso > 0 ? "text-red-600" : "text-gray-900"}
            iconColor={kpis.emAtraso > 0 ? "text-red-500" : "text-gray-300"}
          />
        </div>

        {/* Lucro por assistência + Custo médio */}
        <div className="grid grid-cols-2 gap-3 mt-3">
          <MetricCard
            icon={DollarSign}
            label="Lucro líq. / assistência"
            value={brl(kpis.llPorAssist)}
            color={kpis.llPorAssist >= 0 ? "text-green-600" : "text-red-600"}
            iconColor={kpis.llPorAssist >= 0 ? "text-green-400" : "text-red-400"}
          />
          <MetricCard
            icon={Package}
            label="Custo médio / OS"
            value={brl(kpis.totalOrdensMes > 0 ? (kpis.custosPecasMes + kpis.gastosFixos) / kpis.totalOrdensMes : 0)}
            sub="peças + fixos"
            iconColor="text-gray-400"
          />
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════════════
          SEÇÃO 4 — DISTRIBUIÇÃO DO LUCRO
      ══════════════════════════════════════════════════════════════════════ */}
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
              <p className="text-xs text-muted-foreground">Sem lucro a distribuir este mês.</p>
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
                  {Array.from({ length: kpis.nSocios }).map((_, i) => {
                    const socio = socios[i];
                    const nome = socio?.nome?.trim() || `Sócio ${i + 1}`;
                    return (
                      <div key={i} className="border rounded-lg p-3 bg-green-50">
                        <div className="flex items-center gap-2 mb-2">
                          <div className="h-7 w-7 rounded-full bg-green-100 text-green-700 flex items-center justify-center text-xs font-bold">
                            {nome[0]?.toUpperCase() || String(i + 1)}
                          </div>
                          <span className="text-xs font-medium text-gray-600">{nome}</span>
                        </div>
                        <p className="text-sm font-bold text-green-600">{brl(kpis.lucroSocio)}</p>
                      </div>
                    );
                  })}
                </div>
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
      <div>
        <SectionTitle>Faturamento x Lucro</SectionTitle>
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
                  Lucro
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
                  <Bar dataKey="lucro" name="Lucro" fill="#22c55e" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ══════════════════════════════════════════════════════════════════════
          ORDENS POR STATUS
      ══════════════════════════════════════════════════════════════════════ */}
      <div>
        <SectionTitle>Ordens por status</SectionTitle>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground mb-3">
              {orders.filter(o => o.status !== "entregue").length} ativas
            </p>
            <div className="space-y-2">
              {Object.entries(STATUS_LABELS).map(([key, label]) => {
                const count = orders.filter(o => o.status === key).length;
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
