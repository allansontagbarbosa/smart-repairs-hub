import {
  Wrench, Clock, DollarSign, TrendingUp, CheckCircle, Loader2,
  AlertTriangle, Plus, Search, Package, Timer, Store,
  BarChart3, ArrowUpRight, ArrowDownRight, CreditCard, Users,
} from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { statusLabels } from "@/lib/status";
import { abrirWhatsApp } from "@/lib/whatsapp";
import { ConfirmarEntregaDialog, useConfirmarEntrega } from "@/components/ConfirmarEntregaDialog";
import { useAlertas } from "@/hooks/useAlertas";
import { useAlertasPecas } from "@/hooks/useAlertasPecas";
import { AlertsBanner } from "@/components/AlertsBanner";
import type { GenericAlert } from "@/components/AlertsBanner";
import { useState, useMemo } from "react";
import { OrdemDetalheSheet } from "@/components/OrdemDetalheSheet";
import { NovaOrdemDialog } from "@/components/NovaOrdemDialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { differenceInHours, startOfMonth, endOfMonth, subMonths, format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip as RTooltip, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line, CartesianGrid,
} from "recharts";

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

async function fetchDashboardSummary() {
  const { data, error } = await supabase.rpc("get_dashboard_summary");
  if (error) throw error;
  return data as {
    ordens: OrderRow[];
    estoque_baixo: number;
    contas_pendentes: any[];
    comissoes_pendentes: any[];
    lojas: { id: string; nome: string }[];
}

const fmt = (v: number) => `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 0 })}`;
const CHART_COLORS = [
  "hsl(224, 76%, 48%)", "hsl(152, 55%, 42%)", "hsl(36, 90%, 52%)",
  "hsl(212, 72%, 52%)", "hsl(0, 72%, 51%)", "hsl(280, 60%, 50%)",
];

const statusColors: Record<string, string> = {
  recebido: "bg-muted-foreground",
  em_analise: "bg-info",
  aguardando_aprovacao: "bg-warning",
  aprovado: "bg-success",
  em_reparo: "bg-primary",
  aguardando_peca: "bg-warning",
  pronto: "bg-success",
  entregue: "bg-muted-foreground/50",
};

export default function Dashboard() {
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [novaOrdemOpen, setNovaOrdemOpen] = useState(false);
  const [filtroLoja, setFiltroLoja] = useState("todas");
  const { entrega, pedirConfirmacao, cancelar } = useConfirmarEntrega();
  const [filtroPeriodo, setFiltroPeriodo] = useState("mes");
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: summary, isLoading: loadingOrders } = useQuery({
    queryKey: ["dashboard-summary"],
    queryFn: fetchDashboardSummary,
    refetchInterval: 60000,
  });

  const orders = summary?.ordens ?? [];
  const pecasEstoqueBaixo = summary?.estoque_baixo ?? 0;
  const contasPendentes = summary?.contas_pendentes ?? [];
  const comissoesPendentes = summary?.comissoes_pendentes ?? [];
  const lojas = summary?.lojas ?? [];

  const entregarMutation = useMutation({
    mutationFn: async (orderId: string) => {
      const { error } = await supabase
        .from("ordens_de_servico")
        .update({ status: "entregue" as any, data_entrega: new Date().toISOString() })
        .eq("id", orderId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ordens"] });
      toast.success("Ordem marcada como entregue!");
    },
  });

  // Filter orders by loja
  const filteredOrders = useMemo(() => {
    if (filtroLoja === "todas") return orders;
    return orders.filter(o => o.loja_id === filtroLoja);
  }, [orders, filtroLoja]);

  const kpis = useMemo(() => {
    const now = new Date();
    const hoje = now.toISOString().split("T")[0];
    const mesAtual = now.getMonth();
    const anoAtual = now.getFullYear();

    const ativas = filteredOrders.filter(o => o.status !== "entregue");
    const ordensHoje = filteredOrders.filter(o => o.data_entrada.split("T")[0] === hoje);
    const ordensMes = filteredOrders.filter(o => {
      const d = new Date(o.data_entrada);
      return d.getMonth() === mesAtual && d.getFullYear() === anoAtual;
    });

    const faturamentoMes = ordensMes.reduce((s, o) => s + Number(o.valor ?? 0), 0);
    const custosMes = ordensMes.reduce((s, o) => s + Number(o.custo_pecas ?? 0), 0);

    // Real profit: faturamento - peças - comissões - despesas
    const comissoesTotal = comissoesPendentes.reduce((s, c) => s + Number(c.valor ?? 0), 0);
    const despesasTotal = contasPendentes
      .filter(c => c.data_vencimento?.startsWith(`${anoAtual}-${String(mesAtual + 1).padStart(2, "0")}`))
      .reduce((s, c) => s + Number(c.valor ?? 0), 0);
    const lucroMes = faturamentoMes - custosMes - comissoesTotal - despesasTotal;

    const ordensComValorMes = ordensMes.filter(o => Number(o.valor ?? 0) > 0);
    const ticketMedio = ordensComValorMes.length > 0
      ? ordensComValorMes.reduce((s, o) => s + Number(o.valor ?? 0), 0) / ordensComValorMes.length
      : 0;

    const concluidas = filteredOrders.filter(o => o.data_conclusao);
    let tempoMedio = 0;
    if (concluidas.length > 0) {
      const totalHoras = concluidas.reduce((s, o) => {
        return s + differenceInHours(new Date(o.data_conclusao!), new Date(o.data_entrada));
      }, 0);
      tempoMedio = Math.round(totalHoras / concluidas.length);
    }

    const emAtraso = ativas.filter(o =>
      o.previsao_entrega && new Date(o.previsao_entrega) < now && o.status !== "pronto"
    ).length;

    const emAssistencia = ativas.filter(o => !["pronto"].includes(o.status)).length;
    const aguardandoEntrega = ativas.filter(o => o.status === "pronto").length;

    const statusCounts: Record<string, number> = {};
    for (const o of ativas) {
      statusCounts[o.status] = (statusCounts[o.status] || 0) + 1;
    }

    const contasValor = contasPendentes.reduce((s, c) => s + Number(c.valor ?? 0), 0);
    const comissoesValor = comissoesPendentes.reduce((s, c) => s + Number(c.valor ?? 0), 0);

    const estoqueBaixo = pecas.filter(p => p.quantidade_minima > 0 && p.quantidade <= p.quantidade_minima).length;

    // Lucro por loja
    const lucroPorLoja: { nome: string; receita: number; custo: number; lucro: number }[] = [];
    if (lojas.length > 0) {
      for (const loja of lojas) {
        const ordensLoja = ordensMes.filter(o => o.loja_id === loja.id);
        const rec = ordensLoja.reduce((s, o) => s + Number(o.valor ?? 0), 0);
        const cst = ordensLoja.reduce((s, o) => s + Number(o.custo_pecas ?? 0), 0);
        if (rec > 0 || cst > 0) {
          lucroPorLoja.push({ nome: loja.nome, receita: rec, custo: cst, lucro: rec - cst });
        }
      }
      // Add orders without store
      const semLoja = ordensMes.filter(o => !o.loja_id);
      if (semLoja.length > 0) {
        const rec = semLoja.reduce((s, o) => s + Number(o.valor ?? 0), 0);
        const cst = semLoja.reduce((s, o) => s + Number(o.custo_pecas ?? 0), 0);
        if (rec > 0 || cst > 0) {
          lucroPorLoja.push({ nome: "Sem loja", receita: rec, custo: cst, lucro: rec - cst });
        }
      }
      lucroPorLoja.sort((a, b) => b.lucro - a.lucro);
    }

    return {
      faturamentoMes, lucroMes, ticketMedio, tempoMedio,
      emAtraso, emAssistencia, aguardandoEntrega, statusCounts,
      contasValor, comissoesValor, estoqueBaixo,
      totalOrdensMes: ordensMes.length,
      lucroPorLoja,
    };
  }, [filteredOrders, contasPendentes, comissoesPendentes, pecas, lojas]);

  // Chart: faturamento últimos 6 meses
  const faturamentoChart = useMemo(() => {
    const meses: { name: string; faturamento: number; lucro: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = subMonths(new Date(), i);
      const start = startOfMonth(d);
      const end = endOfMonth(d);
      const mesOrdens = filteredOrders.filter(o => {
        const de = new Date(o.data_entrada);
        return de >= start && de <= end;
      });
      const fat = mesOrdens.reduce((s, o) => s + Number(o.valor ?? 0), 0);
      const custo = mesOrdens.reduce((s, o) => s + Number(o.custo_pecas ?? 0), 0);
      meses.push({
        name: format(d, "MMM", { locale: ptBR }),
        faturamento: fat,
        lucro: fat - custo,
      });
    }
    return meses;
  }, [filteredOrders]);

  // Chart: serviços por status
  const statusChart = useMemo(() => {
    const ativas = filteredOrders.filter(o => o.status !== "entregue");
    const counts: Record<string, number> = {};
    for (const o of ativas) {
      const label = statusLabels[o.status] || o.status;
      counts[label] = (counts[label] || 0) + 1;
    }
    return Object.entries(counts).map(([name, value]) => ({ name, value }));
  }, [filteredOrders]);

  // Chart: top serviços (marcas mais frequentes)
  const topMarcas = useMemo(() => {
    const now = new Date();
    const mesOrdens = filteredOrders.filter(o => {
      const d = new Date(o.data_entrada);
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    });
    const counts: Record<string, number> = {};
    for (const o of mesOrdens) {
      const marca = o.aparelhos?.marca ?? "Outros";
      counts[marca] = (counts[marca] || 0) + 1;
    }
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name, value]) => ({ name, value }));
  }, [filteredOrders]);

  const alertasOS = useAlertas(filteredOrders);
  const alertasPecas = useAlertasPecas(pecas);

  const allAlertas = useMemo<GenericAlert[]>(() => {
    // Add financial alerts
    const finAlertas: GenericAlert[] = [];
    const hoje = new Date().toISOString().split("T")[0];
    const contasHoje = contasPendentes.filter(c => c.data_vencimento === hoje);
    const contasAtrasadas = contasPendentes.filter(c => c.data_vencimento < hoje);

    if (contasAtrasadas.length > 0) {
      finAlertas.push({
        type: "danger",
        message: `${contasAtrasadas.length} conta(s) a pagar atrasada(s) — total R$ ${contasAtrasadas.reduce((s, c) => s + Number(c.valor), 0).toLocaleString("pt-BR")}`,
      });
    }
    if (contasHoje.length > 0) {
      finAlertas.push({
        type: "warning",
        message: `${contasHoje.length} conta(s) vencendo hoje — total R$ ${contasHoje.reduce((s, c) => s + Number(c.valor), 0).toLocaleString("pt-BR")}`,
      });
    }
    if (comissoesPendentes.length > 0) {
      finAlertas.push({
        type: "info",
        message: `${comissoesPendentes.length} comissão(ões) pendente(s) — total R$ ${comissoesPendentes.reduce((s, c) => s + Number(c.valor), 0).toLocaleString("pt-BR")}`,
      });
    }

    return [...finAlertas, ...alertasOS, ...alertasPecas];
  }, [alertasOS, alertasPecas, contasPendentes, comissoesPendentes]);

  const handleAlertAction = (action: string, orderId: string, phone?: string) => {
    const sendWhatsApp = (p: string, msg: string) => abrirWhatsApp(p, msg);

    const order = orders.find(o => o.id === orderId);
    const osLabel = `OS #${String(order?.numero ?? 0).padStart(3, "0")}`;

    if ((action === "whatsapp_retirada" || action === "whatsapp") && phone) {
      sendWhatsApp(phone, `Olá! Informamos que o serviço referente à ${osLabel} está pronto para retirada. Aguardamos seu contato!`);
    } else if ((action === "cobrar_aprovacao" || action === "cobrar") && phone) {
      sendWhatsApp(phone, `Olá! O serviço referente à ${osLabel} está aguardando sua aprovação. Por favor, entre em contato conosco.`);
    } else if (action === "entregar") {
      const order2 = orders.find(o => o.id === orderId);
      pedirConfirmacao({
        orderId,
        numero: order2?.numero ?? 0,
        clienteNome: order2?.aparelhos?.clientes?.nome ?? "—",
      });
    } else if (action === "verificar_status") {
      setSelectedOrderId(orderId);
    }
  };

  if (loadingOrders) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const tempoMedioLabel = kpis.tempoMedio < 24
    ? `${kpis.tempoMedio}h`
    : `${Math.round(kpis.tempoMedio / 24)}d`;

  return (
    <div className="space-y-6 md:space-y-8">
      {/* Header with filters */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="page-title">Central de Controle</h1>
          <p className="page-subtitle">Visão completa do negócio</p>
        </div>
        <div className="flex flex-wrap gap-2 items-center">
          {lojas.length > 0 && (
            <Select value={filtroLoja} onValueChange={setFiltroLoja}>
              <SelectTrigger className="w-36 h-8 text-xs">
                <Store className="h-3 w-3 mr-1.5" />
                <SelectValue placeholder="Loja" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todas">Todas as lojas</SelectItem>
                {lojas.map(l => (
                  <SelectItem key={l.id} value={l.id}>{l.nome}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <Button size="sm" onClick={() => setNovaOrdemOpen(true)} className="gap-1.5 h-8 text-xs">
            <Plus className="h-3.5 w-3.5" /> Nova OS
          </Button>
        </div>
      </div>

      {/* Alerts */}
      {allAlertas.length > 0 && (
        <AlertsBanner
          alertas={allAlertas}
          max={5}
          onClickAlert={setSelectedOrderId}
          onAction={handleAlertAction}
        />
      )}

      {/* KPI Cards Row 1 - Financial */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="stat-card">
          <div className="flex items-center justify-between mb-3">
            <DollarSign className="h-4 w-4 text-primary" />
            <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded-full">{kpis.totalOrdensMes} OS</span>
          </div>
          <p className="stat-value">{fmt(kpis.faturamentoMes)}</p>
          <p className="stat-label">Faturamento do mês</p>
        </div>
        <div className="stat-card">
          <div className="flex items-center justify-between mb-3">
            <TrendingUp className="h-4 w-4 text-success" />
            {kpis.lucroMes >= 0
              ? <ArrowUpRight className="h-3.5 w-3.5 text-success" />
              : <ArrowDownRight className="h-3.5 w-3.5 text-destructive" />
            }
          </div>
          <p className={`stat-value ${kpis.lucroMes >= 0 ? "text-success" : "text-destructive"}`}>{fmt(kpis.lucroMes)}</p>
          <p className="stat-label">Lucro do mês</p>
        </div>
        <div className="stat-card">
          <CreditCard className="h-4 w-4 text-warning mb-3" />
          <p className="stat-value">{fmt(kpis.contasValor)}</p>
          <p className="stat-label">Contas a pagar</p>
        </div>
        <div className="stat-card">
          <Users className="h-4 w-4 text-info mb-3" />
          <p className="stat-value">{fmt(kpis.comissoesValor)}</p>
          <p className="stat-label">Comissões pendentes</p>
        </div>
      </div>

      {/* KPI Cards Row 2 - Operational */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        <div className="stat-card cursor-pointer" onClick={() => navigate("/assistencia")}>
          <Wrench className="h-4 w-4 text-info mb-3" />
          <p className="stat-value">{kpis.emAssistencia}</p>
          <p className="stat-label">Em assistência</p>
        </div>
        <div className="stat-card cursor-pointer" onClick={() => navigate("/assistencia?status=pronto")}>
          <CheckCircle className="h-4 w-4 text-success mb-3" />
          <p className="stat-value">{kpis.aguardandoEntrega}</p>
          <p className="stat-label">Prontos p/ entrega</p>
        </div>
        <div className={`stat-card ${kpis.emAtraso > 0 ? "border-destructive/30" : ""}`}>
          <AlertTriangle className={`h-4 w-4 mb-3 ${kpis.emAtraso > 0 ? "text-destructive" : "text-muted-foreground"}`} />
          <p className={`stat-value ${kpis.emAtraso > 0 ? "text-destructive" : ""}`}>{kpis.emAtraso}</p>
          <p className="stat-label">Em atraso</p>
        </div>
        <div className="stat-card">
          <Timer className="h-4 w-4 text-muted-foreground mb-3" />
          <p className="stat-value">{tempoMedioLabel}</p>
          <p className="stat-label">Tempo médio reparo</p>
        </div>
        <div className={`stat-card ${kpis.estoqueBaixo > 0 ? "border-warning/30" : ""}`}>
          <Package className={`h-4 w-4 mb-3 ${kpis.estoqueBaixo > 0 ? "text-warning" : "text-muted-foreground"}`} />
          <p className={`stat-value ${kpis.estoqueBaixo > 0 ? "text-warning" : ""}`}>{kpis.estoqueBaixo}</p>
          <p className="stat-label">Estoque baixo</p>
        </div>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Revenue chart */}
        <div className="section-card">
          <div className="section-header">
            <h3 className="section-title flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-muted-foreground" />
              Faturamento x Lucro
            </h3>
            <span className="text-xs text-muted-foreground">Últimos 6 meses</span>
          </div>
          <div className="p-4 h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={faturamentoChart} barGap={2}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                <YAxis tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                <RTooltip
                  contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }}
                  formatter={(value: number) => [fmt(value)]}
                />
                <Bar dataKey="faturamento" name="Faturamento" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                <Bar dataKey="lucro" name="Lucro" fill="hsl(var(--success))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Status distribution */}
        <div className="section-card">
          <div className="section-header">
            <h3 className="section-title">Ordens por Status</h3>
            <span className="text-xs text-muted-foreground">{filteredOrders.filter(o => o.status !== "entregue").length} ativas</span>
          </div>
          <div className="p-4 h-56 flex items-center">
            {statusChart.length > 0 ? (
              <div className="flex items-center gap-6 w-full">
                <ResponsiveContainer width="50%" height={180}>
                  <PieChart>
                    <Pie
                      data={statusChart}
                      cx="50%"
                      cy="50%"
                      innerRadius={45}
                      outerRadius={70}
                      paddingAngle={3}
                      dataKey="value"
                    >
                      {statusChart.map((_, i) => (
                        <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                      ))}
                    </Pie>
                    <RTooltip
                      contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }}
                    />
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

      {/* Top Marcas */}
      {topMarcas.length > 0 && (
        <div className="section-card">
          <div className="section-header">
            <h3 className="section-title">Top Marcas do Mês</h3>
          </div>
          <div className="p-4 h-44">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={topMarcas} layout="vertical" barSize={20}>
                <XAxis type="number" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                <YAxis dataKey="name" type="category" width={80} tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                <RTooltip
                  contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }}
                />
                <Bar dataKey="value" name="Ordens" fill="hsl(var(--info))" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Lucro por Loja */}
      {kpis.lucroPorLoja.length > 0 && (
        <div className="section-card">
          <div className="section-header">
            <h3 className="section-title flex items-center gap-2">
              <Store className="h-4 w-4 text-muted-foreground" />
              Lucro por Loja (Mês)
            </h3>
          </div>
          <div className="p-4">
            <div className="space-y-2">
              {kpis.lucroPorLoja.map((l) => (
                <div key={l.nome} className="flex items-center justify-between rounded-lg border px-4 py-2.5">
                  <span className="text-sm font-medium">{l.nome}</span>
                  <div className="flex items-center gap-4 text-sm">
                    <span className="text-muted-foreground">Receita: {fmt(l.receita)}</span>
                    <span className="text-muted-foreground">Custos: {fmt(l.custo)}</span>
                    <span className={`font-semibold ${l.lucro >= 0 ? "text-success" : "text-destructive"}`}>{fmt(l.lucro)}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Status bar */}
      <div>
        <h2 className="section-title mb-3">Visão Rápida por Status</h2>
        <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-8 gap-2">
          {(["recebido", "em_analise", "aguardando_aprovacao", "aprovado", "em_reparo", "aguardando_peca", "pronto", "entregue"] as const).map(status => {
            const count = status === "entregue"
              ? filteredOrders.filter(o => o.status === "entregue").length
              : (kpis.statusCounts[status] || 0);
            return (
              <div
                key={status}
                onClick={() => navigate(`/assistencia?status=${status}`)}
                className="stat-card cursor-pointer hover:shadow-md transition-shadow text-center py-3 px-2"
              >
                <div className={`w-2 h-2 rounded-full ${statusColors[status]} mx-auto mb-2`} />
                <p className="text-lg font-semibold">{count}</p>
                <p className="text-[10px] text-muted-foreground leading-tight">{statusLabels[status]}</p>
              </div>
            );
          })}
        </div>
      </div>

      <OrdemDetalheSheet orderId={selectedOrderId} onClose={() => setSelectedOrderId(null)} />
      <NovaOrdemDialog
        open={novaOrdemOpen}
        onOpenChange={setNovaOrdemOpen}
        onSuccess={() => queryClient.invalidateQueries({ queryKey: ["ordens"] })}
      />
      <ConfirmarEntregaDialog
        entrega={entrega}
        onConfirm={(id) => {
          entregarMutation.mutate(id);
          cancelar();
        }}
        onCancel={cancelar}
      />
    </div>
  );
}
