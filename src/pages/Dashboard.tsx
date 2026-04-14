import { useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  Plus, AlertTriangle, Clock, CheckCircle, TrendingUp,
  TrendingDown, Wrench, Smartphone, DollarSign, Package,
  Users, Target, AlertCircle, ChevronRight,
  Settings, Loader2, Timer, Receipt, CreditCard,
  ArrowDownRight,
} from "lucide-react";
import { format, startOfMonth, endOfMonth, subMonths, startOfDay, differenceInHours } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RTooltip,
  ResponsiveContainer, PieChart, Pie, Cell,
} from "recharts";
import { OrdemDetalheSheet } from "@/components/OrdemDetalheSheet";
import { NovaOrdemDialog } from "@/components/NovaOrdemDialog";
import { ConfirmarEntregaDialog, useConfirmarEntrega } from "@/components/ConfirmarEntregaDialog";
import { toast } from "sonner";

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
  aprovado: "Aprovado",
  em_reparo: "Em Reparo",
  aguardando_peca: "Aguard. Peça",
  pronto: "Pronto",
  entregue: "Entregue",
};

const STATUS_COLORS: Record<string, string> = {
  recebido: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
  em_analise: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300",
  aguardando_aprovacao: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300",
  em_reparo: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
  pronto: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300",
  entregue: "bg-gray-100 text-gray-600 dark:bg-gray-800/30 dark:text-gray-400",
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

const CHART_COLORS = [
  "hsl(224, 76%, 48%)", "hsl(152, 55%, 42%)", "hsl(36, 90%, 52%)",
  "hsl(212, 72%, 52%)", "hsl(0, 72%, 51%)", "hsl(280, 60%, 50%)",
  "hsl(320, 60%, 50%)", "hsl(170, 55%, 42%)",
];

// ─── COMPONENTES AUXILIARES ───────────────────────────────────────────────────

function MetricCard({
  icon: Icon,
  label,
  value,
  sub,
  color = "text-foreground",
  bg = "bg-card",
  badge,
  iconColor = "text-primary",
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
    <div className={`stat-card ${bg}`}>
      <div className="flex items-center justify-between mb-3">
        <Icon className={`h-4 w-4 ${iconColor}`} />
        {badge}
      </div>
      <p className={`stat-value ${color}`}>{value}</p>
      <p className="stat-label">{label}</p>
      {sub && <p className="text-[10px] text-muted-foreground mt-0.5">{sub}</p>}
    </div>
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
    warn: "border-warning/30 bg-warning-muted text-warning",
    ok: "border-success/20 bg-success-muted text-success",
    error: "border-destructive/20 bg-destructive/5 text-destructive",
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

async function fetchRecebimentosMes() {
  const now = new Date();
  const ms = startOfMonth(now);
  const me = endOfMonth(now);
  const { data, error } = await supabase
    .from("recebimentos")
    .select("valor, data_recebimento")
    .gte("data_recebimento", ms.toISOString().split("T")[0])
    .lte("data_recebimento", me.toISOString().split("T")[0]);
  if (error) throw error;
  return data ?? [];
}

async function fetchComissoesMes() {
  const now = new Date();
  const ms = startOfMonth(now);
  const me = endOfMonth(now);
  const { data, error } = await supabase
    .from("comissoes")
    .select("valor, status, created_at")
    .gte("created_at", ms.toISOString())
    .lte("created_at", me.toISOString());
  if (error) throw error;
  return data ?? [];
}

async function fetchAjustesMes() {
  const now = new Date();
  const anoMes = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const { data, error } = await supabase
    .from("ajustes_mensais")
    .select("tipo, valor")
    .eq("ano_mes", anoMes);
  if (error) throw error;
  return data ?? [];
}

// ─── COMPONENTE PRINCIPAL ─────────────────────────────────────────────────────

export default function Dashboard() {
  const navigate = useNavigate();
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [novaOrdemOpen, setNovaOrdemOpen] = useState(false);
  const { entrega, pedirConfirmacao, cancelar } = useConfirmarEntrega();
  const queryClient = useQueryClient();

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

  const { data: recebimentosMes } = useQuery({
    queryKey: ["dashboard-recebimentos-mes"],
    queryFn: fetchRecebimentosMes,
    refetchInterval: 60000,
  });

  const { data: comissoesMesData } = useQuery({
    queryKey: ["dashboard-comissoes-mes"],
    queryFn: fetchComissoesMes,
    refetchInterval: 60000,
  });

  const { data: ajustesMes } = useQuery({
    queryKey: ["dashboard-ajustes-mes"],
    queryFn: fetchAjustesMes,
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

  const entregarMutation = useMutation({
    mutationFn: async (orderId: string) => {
      const { error } = await supabase
        .from("ordens_de_servico")
        .update({ status: "entregue" as any, data_entrega: new Date().toISOString() })
        .eq("id", orderId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["dashboard-summary"] });
      toast.success("Ordem marcada como entregue!");
    },
  });

  // ── CÁLCULOS ────────────────────────────────────────────────────────────

  const kpis = useMemo(() => {
    const now = new Date();
    const mesAtual = now.getMonth();
    const anoAtual = now.getFullYear();

    const ativas = orders.filter(o => o.status !== "entregue");

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

    const comissoesMes = (comissoesMesData ?? []).reduce((s: number, c: any) => s + Number(c.valor ?? 0), 0);
    const totalRecebimentos = (recebimentosMes ?? []).reduce((s: number, r: any) => s + Number(r.valor ?? 0), 0);

    // EBITDA
    const ebitda = faturamento - custosPecasMes - despesasPagasMes - comissoesMes + totalRecebimentos;
    const ebitdaMargem = faturamento > 0 ? (ebitda / faturamento) * 100 : 0;

    // Ajustes mensais
    const allAjustes = ajustesMes ?? [];
    const depreciacao = allAjustes.filter((a: any) => a.tipo === "depreciacao").reduce((s: number, a: any) => s + Number(a.valor ?? 0), 0);
    const impostos = allAjustes.filter((a: any) => a.tipo === "impostos").reduce((s: number, a: any) => s + Number(a.valor ?? 0), 0);
    const outrosAjustes = allAjustes.filter((a: any) => a.tipo !== "depreciacao" && a.tipo !== "impostos").reduce((s: number, a: any) => s + Number(a.valor ?? 0), 0);

    // Lucro líquido
    const ll = ebitda - depreciacao - impostos - outrosAjustes;
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
    const reservaPct = Number(empresaConfig?.percentual_reserva_empresa ?? 10);
    const nSocios = Number(empresaConfig?.numero_socios ?? 1) || 1;

    const prevLl = metaFaturamento > 0 && faturamento > 0 ? metaFaturamento * (ll / faturamento) : 0;
    const totalGastos = custosPecasMes + despesasPagasMes + depreciacao + impostos;
    const metaPct = metaGastos > 0 ? Math.min(100, (totalGastos / metaGastos) * 100) : 0;

    // Distribuição
    const reservaVal = ll > 0 ? (ll * reservaPct) / 100 : 0;
    const lucroDistrib = ll > 0 ? ll - reservaVal : 0;
    const lucroSocio = lucroDistrib / Math.max(1, nSocios);

    // Operacional
    const concluidas = orders.filter(o => o.data_conclusao);
    let tempoMedio = 0;
    if (concluidas.length > 0) {
      const totalHoras = concluidas.reduce((s, o) => s + differenceInHours(new Date(o.data_conclusao!), new Date(o.data_entrada)), 0);
      tempoMedio = Math.round(totalHoras / concluidas.length);
    }

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
      ebitda, ebitdaMargem, ll, llMargem, depreciacao, impostos, outrosAjustes,
      ticket, llPorAssist, prevLl, totalGastos, metaGastos, metaFaturamento,
      metaPct, reservaPct, nSocios, reservaVal, lucroDistrib, lucroSocio,
      tempoMedio, emAtraso, aguardandoEntrega, aguardandoReparo, emReparo,
      totalOrdensMes: ordensMes.length, totalFaturadas: ordensFaturadas.length,
      iphonesReparados,
    };
  }, [orders, contasPagas, recebimentosMes, comissoesMesData, ajustesMes, empresaConfig]);

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
      const custo = mesOrdens.reduce((s, o) => s + Number(o.custo_pecas ?? 0), 0);
      meses.push({
        mes: format(d, "MMM", { locale: ptBR }),
        faturamento: fat,
        lucro: fat - custo,
      });
    }
    return meses;
  }, [orders]);

  // OS Urgentes
  const osUrgentes = useMemo(() => {
    return orders.filter(
      o => isAtrasado(o.status, o.previsao_entrega) || o.status === "aguardando_aprovacao"
    );
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

  // Status chart para Ordens por Status
  const statusChart = useMemo(() => {
    const ativas = orders.filter(o => o.status !== "entregue");
    const counts: Record<string, number> = {};
    for (const o of ativas) {
      const label = STATUS_LABELS[o.status] || o.status;
      counts[label] = (counts[label] || 0) + 1;
    }
    return Object.entries(counts).map(([name, value]) => ({ name, value }));
  }, [orders]);

  const socios = sociosList ?? [];
  const tempoMedioLabel = kpis.tempoMedio < 24 ? `${kpis.tempoMedio}h` : `${Math.round(kpis.tempoMedio / 24)}d`;

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
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="page-title">Central de Controle</h1>
          <p className="page-subtitle">
            {format(new Date(), "MMMM 'de' yyyy", { locale: ptBR })}
          </p>
        </div>
        <div className="flex flex-wrap gap-2 items-center">
          <Button size="sm" variant="outline" onClick={() => navigate("/configuracoes")} className="gap-1.5 h-8 text-xs">
            <Settings className="h-3.5 w-3.5" /> Config
          </Button>
          <Button size="sm" onClick={() => setNovaOrdemOpen(true)} className="gap-1.5 h-8 text-xs">
            <Plus className="h-3.5 w-3.5" /> Nova OS
          </Button>
        </div>
      </div>

      {/* ── OS URGENTES ── */}
      {osUrgentes.length > 0 && (
        <div className="space-y-1.5">
          {osUrgentes.slice(0, 5).map(o => {
            const clienteNome = o.aparelhos?.clientes?.nome ?? "—";
            const modelo = o.aparelhos?.modelo ?? "—";
            const atrasado = isAtrasado(o.status, o.previsao_entrega);
            return (
              <div
                key={o.id}
                onClick={() => setSelectedOrderId(o.id)}
                className={`flex items-start justify-between rounded-lg border px-3 py-2.5 cursor-pointer hover:brightness-95 transition-all ${
                  atrasado
                    ? "border-destructive/20 bg-destructive/5"
                    : "border-warning/30 bg-warning-muted"
                }`}
              >
                <div className="flex items-start gap-2">
                  <AlertTriangle className={`h-4 w-4 mt-0.5 shrink-0 ${atrasado ? "text-destructive" : "text-warning"}`} />
                  <div>
                    <p className="text-xs font-semibold">
                      #{String(o.numero).padStart(3, "0")} — {modelo} de {clienteNome}
                    </p>
                    <p className="text-[10px] text-muted-foreground">
                      {atrasado ? "⚠️ Prazo vencido" : "💰 Aguardando aprovação do cliente"}
                    </p>
                  </div>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
              </div>
            );
          })}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          SEÇÃO 1 — FINANCEIRO DO MÊS
      ══════════════════════════════════════════════════════════════════════ */}
      <div>
        <SectionTitle>Financeiro do mês</SectionTitle>

        {/* Linha 1: Faturamento, EBITDA, Lucro Líquido, Saúde Financeira */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <MetricCard
            icon={DollarSign}
            label="Faturamento"
            value={brl(kpis.faturamento)}
            iconColor="text-primary"
            badge={
              <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded-full">
                {kpis.totalFaturadas} OS
              </span>
            }
          />
          <MetricCard
            icon={TrendingUp}
            label="EBITDA"
            value={brl(kpis.ebitda)}
            color={kpis.ebitda >= 0 ? "text-success" : "text-destructive"}
            iconColor={kpis.ebitda >= 0 ? "text-success" : "text-destructive"}
            badge={
              <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${kpis.ebitda >= 0 ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive"}`}>
                {pct(kpis.ebitdaMargem)}
              </span>
            }
          />
          <MetricCard
            icon={kpis.ll >= 0 ? TrendingUp : TrendingDown}
            label="Lucro líquido"
            value={brl(kpis.ll)}
            sub={`margem ${pct(kpis.llMargem)}`}
            color={kpis.ll >= 0 ? "text-success" : "text-destructive"}
            iconColor={kpis.ll >= 0 ? "text-success" : "text-destructive"}
            badge={
              <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${kpis.ll >= 0 ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive"}`}>
                {pct(kpis.llMargem)}
              </span>
            }
          />
          <MetricCard
            icon={Target}
            label="Saúde financeira"
            value={kpis.llMargem >= 20 ? "Excelente" : kpis.llMargem >= 10 ? "Saudável" : kpis.llMargem >= 0 ? "Atenção" : "Prejuízo"}
            color={kpis.llMargem >= 20 ? "text-success" : kpis.llMargem >= 10 ? "text-info" : kpis.llMargem >= 0 ? "text-warning" : "text-destructive"}
            iconColor={kpis.llMargem >= 10 ? "text-success" : "text-warning"}
          />
        </div>

        {/* Linha 2: Peças, Fixos, Depreciação, Impostos, Ticket */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mt-3">
          <MetricCard
            icon={Package}
            label="Custo de peças"
            value={brl(kpis.custosPecasMes)}
            sub={kpis.faturamento > 0 ? `${pct((kpis.custosPecasMes / kpis.faturamento) * 100)} do fat.` : undefined}
            iconColor="text-warning"
          />
          <MetricCard icon={Receipt} label="Gastos fixos" value={brl(kpis.gastosFixos)} iconColor="text-muted-foreground" />
          <MetricCard icon={Receipt} label="Depreciação" value={brl(kpis.depreciacao)} iconColor="text-muted-foreground" />
          <MetricCard icon={CreditCard} label="Impostos" value={brl(kpis.impostos)} iconColor="text-muted-foreground" />
          <MetricCard icon={DollarSign} label="Ticket médio" value={brl(kpis.ticket)} iconColor="text-info" />
        </div>

        {/* Fórmula resumida */}
        <div className="section-card mt-3">
          <div className="p-3 space-y-1">
            <p className="text-xs text-muted-foreground">
              <strong>EBITDA:</strong>{" "}
              {brl(kpis.faturamento)} − Peças ({brl(kpis.custosPecasMes)}) − Fixos ({brl(kpis.gastosFixos)}) − Outros ({brl(kpis.gastosVariaveis)}) ={" "}
              <strong className={kpis.ebitda >= 0 ? "text-success" : "text-destructive"}>{brl(kpis.ebitda)}</strong>
            </p>
            <p className="text-xs text-muted-foreground">
              <strong>Lucro líquido:</strong>{" "}
              EBITDA ({brl(kpis.ebitda)}) − Depreciação ({brl(kpis.depreciacao)}) − Impostos ({brl(kpis.impostos)}) ={" "}
              <strong className={kpis.ll >= 0 ? "text-success" : "text-destructive"}>{brl(kpis.ll)}</strong>
            </p>
          </div>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════════════
          SEÇÃO 2 — GASTOS E PREVISÕES
      ══════════════════════════════════════════════════════════════════════ */}
      <div>
        <SectionTitle>Gastos e previsões</SectionTitle>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <MetricCard icon={Receipt} label="Total gastos do mês" value={brl(kpis.totalGastos)} iconColor="text-destructive" />
          <MetricCard icon={Receipt} label="Gastos variáveis" value={brl(kpis.gastosVariaveis)} iconColor="text-warning" />
          <MetricCard
            icon={Target}
            label="Previsão faturamento"
            value={kpis.metaFaturamento > 0 ? brl(kpis.metaFaturamento) : "Não definida"}
            sub={kpis.metaFaturamento > 0 && kpis.faturamento > 0 ? `${pct((kpis.faturamento / kpis.metaFaturamento) * 100)} realizado` : undefined}
            iconColor="text-info"
            color={kpis.metaFaturamento > 0 ? "text-info" : "text-muted-foreground"}
          />
          <MetricCard
            icon={TrendingUp}
            label="Previsão lucro líq."
            value={kpis.prevLl > 0 ? brl(kpis.prevLl) : "—"}
            sub={kpis.metaFaturamento > 0 ? `margem estimada ${pct(kpis.llMargem)}` : undefined}
            color={kpis.prevLl > 0 ? "text-success" : "text-muted-foreground"}
            iconColor="text-success"
          />
        </div>

        {/* Barra de progresso: gastos vs meta */}
        <div className="section-card mt-3">
          <div className="p-3">
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
                  className={`h-3 ${kpis.metaPct > 100 ? "[&>div]:bg-destructive" : kpis.metaPct > 80 ? "[&>div]:bg-warning" : "[&>div]:bg-success"}`}
                />
                <div className="flex justify-between text-[10px] text-muted-foreground mt-1">
                  <span>{pct(kpis.metaPct)} utilizado</span>
                  <span className={
                    kpis.totalGastos > kpis.metaGastos
                      ? "text-destructive font-medium"
                      : kpis.totalGastos > kpis.metaGastos * 0.8
                        ? "text-warning font-medium"
                        : "text-success font-medium"
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
                <span onClick={() => navigate("/configuracoes")} className="text-primary underline cursor-pointer">
                  Configurações
                </span>
              </p>
            )}
          </div>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════════════
          SEÇÃO 3 — OPERACIONAL
      ══════════════════════════════════════════════════════════════════════ */}
      <div>
        <SectionTitle>Operacional</SectionTitle>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <MetricCard icon={Wrench} label="Assistências no mês" value={String(kpis.totalOrdensMes)} iconColor="text-primary" />
          <MetricCard
            icon={Smartphone}
            label="iPhones"
            value={String(kpis.iphonesReparados)}
            sub={kpis.totalOrdensMes > 0 ? pct((kpis.iphonesReparados / kpis.totalOrdensMes) * 100) : "—"}
            iconColor="text-muted-foreground"
          />
          <MetricCard
            icon={Clock}
            label="Aguardando reparo"
            value={String(kpis.aguardandoReparo)}
            color={kpis.aguardandoReparo > 20 ? "text-warning" : "text-foreground"}
            iconColor={kpis.aguardandoReparo > 20 ? "text-warning" : "text-muted-foreground"}
          />
          <MetricCard icon={Wrench} label="Em reparo" value={String(kpis.emReparo)} iconColor="text-info" />
          <MetricCard icon={CheckCircle} label="Prontos p/ entrega" value={String(kpis.aguardandoEntrega)} iconColor="text-success" />
          <MetricCard
            icon={AlertTriangle}
            label="Em atraso"
            value={String(kpis.emAtraso)}
            color={kpis.emAtraso > 0 ? "text-destructive" : "text-foreground"}
            iconColor={kpis.emAtraso > 0 ? "text-destructive" : "text-muted-foreground"}
          />
        </div>

        {/* Lucro por assistência + Custo médio */}
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 mt-3">
          <MetricCard
            icon={DollarSign}
            label="Lucro líq. / assistência"
            value={brl(kpis.llPorAssist)}
            color={kpis.llPorAssist >= 0 ? "text-success" : "text-destructive"}
            iconColor={kpis.llPorAssist >= 0 ? "text-success" : "text-destructive"}
          />
          <MetricCard
            icon={Package}
            label="Custo médio / OS"
            value={brl(kpis.totalOrdensMes > 0 ? (kpis.custosPecasMes + kpis.gastosFixos) / kpis.totalOrdensMes : 0)}
            sub="peças + fixos"
            iconColor="text-muted-foreground"
          />
          <MetricCard icon={Timer} label="Tempo médio reparo" value={tempoMedioLabel} iconColor="text-muted-foreground" />
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════════════
          SEÇÃO 4 — DISTRIBUIÇÃO DO LUCRO
      ══════════════════════════════════════════════════════════════════════ */}
      <div>
        <SectionTitle>Distribuição do lucro</SectionTitle>

        <div className="section-card">
          <div className="p-4 space-y-3">
            <div className="flex items-center gap-2 mb-1">
              <Users className="h-4 w-4 text-primary" />
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
                  <div className="bg-warning" style={{ width: `${kpis.reservaPct}%` }} />
                  <div className="bg-success" style={{ width: `${100 - kpis.reservaPct}%` }} />
                </div>
                <div className="flex justify-between text-[10px] text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <span className="h-2 w-2 rounded-full bg-warning inline-block" />
                    Reserva empresa {brl(kpis.reservaVal)}
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="h-2 w-2 rounded-full bg-success inline-block" />
                    Distribuível {brl(kpis.lucroDistrib)}
                  </span>
                </div>

                {/* Sócios */}
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 mt-2">
                  {Array.from({ length: kpis.nSocios }).map((_, i) => {
                    const socio = socios[i];
                    const nome = socio?.nome?.trim() || `Sócio ${i + 1}`;
                    return (
                      <div key={i} className="stat-card border-success/20 bg-success-muted py-3">
                        <div className="flex items-center gap-2 mb-2">
                          <div className="h-7 w-7 rounded-full bg-success/20 text-success flex items-center justify-center text-xs font-bold">
                            {nome[0]?.toUpperCase() || String(i + 1)}
                          </div>
                          <span className="text-xs font-medium text-muted-foreground">{nome}</span>
                        </div>
                        <p className="text-sm font-bold text-success">{brl(kpis.lucroSocio)}</p>
                      </div>
                    );
                  })}
                </div>
              </>
            )}

            <button
              onClick={() => navigate("/configuracoes")}
              className="mt-3 text-xs text-primary flex items-center gap-1 hover:underline"
            >
              <Settings className="h-3 w-3" /> Editar sócios e reserva
            </button>
          </div>
        </div>
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
        <div className="section-card">
          <div className="p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-4 text-xs">
                <span className="flex items-center gap-1">
                  <span className="h-2.5 w-2.5 rounded-sm bg-primary inline-block" />
                  Faturamento
                </span>
                <span className="flex items-center gap-1">
                  <span className="h-2.5 w-2.5 rounded-sm bg-success inline-block" />
                  Lucro
                </span>
              </div>
              <span className="text-[10px] text-muted-foreground">Últimos 6 meses</span>
            </div>
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={faturamentoChart} barGap={2}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                  <XAxis dataKey="mes" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                  <YAxis tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" tickFormatter={(v) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v)} />
                  <RTooltip
                    formatter={(value: number) => [brl(value)]}
                    contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid hsl(var(--border))", background: "hsl(var(--card))" }}
                  />
                  <Bar dataKey="faturamento" name="Faturamento" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="lucro" name="Lucro" fill="hsl(var(--success))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════════════
          ORDENS POR STATUS
      ══════════════════════════════════════════════════════════════════════ */}
      <div>
        <SectionTitle>Ordens por status</SectionTitle>
        <div className="section-card">
          <div className="p-4">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs text-muted-foreground">
                {orders.filter(o => o.status !== "entregue").length} ativas
              </span>
            </div>
            {statusChart.length > 0 ? (
              <div className="flex items-center gap-6 w-full">
                <ResponsiveContainer width="50%" height={180}>
                  <PieChart>
                    <Pie data={statusChart} cx="50%" cy="50%" innerRadius={45} outerRadius={70} paddingAngle={3} dataKey="value">
                      {statusChart.map((_, i) => (
                        <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                      ))}
                    </Pie>
                    <RTooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="flex-1 space-y-1.5">
                  {statusChart.map((item, i) => (
                    <div key={item.name} className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <div className="h-2.5 w-2.5 rounded-full" style={{ background: CHART_COLORS[i % CHART_COLORS.length] }} />
                        <span className="text-muted-foreground">{item.name}</span>
                      </div>
                      <span className="font-semibold tabular-nums">{item.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center w-full">Nenhuma ordem ativa</p>
            )}
          </div>
        </div>
      </div>

      {/* Modals */}
      <OrdemDetalheSheet orderId={selectedOrderId} onClose={() => setSelectedOrderId(null)} />
      <NovaOrdemDialog open={novaOrdemOpen} onOpenChange={setNovaOrdemOpen} onSuccess={() => queryClient.invalidateQueries({ queryKey: ["dashboard-summary"] })} />
      <ConfirmarEntregaDialog
        entrega={entrega}
        onConfirm={(id) => { entregarMutation.mutate(id); cancelar(); }}
        onCancel={cancelar}
      />
    </div>
  );
}
