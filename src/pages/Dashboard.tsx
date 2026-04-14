import {
  Wrench, Clock, DollarSign, TrendingUp, CheckCircle, Loader2,
  AlertTriangle, Plus, Search, Package, Timer, Store, Smartphone,
  BarChart3, ArrowUpRight, ArrowDownRight, CreditCard, Users,
  Receipt, Wallet,
} from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { statusLabels } from "@/lib/status";
import { abrirWhatsApp } from "@/lib/whatsapp";
import { ConfirmarEntregaDialog, useConfirmarEntrega } from "@/components/ConfirmarEntregaDialog";
import { useAlertas } from "@/hooks/useAlertas";

import { AlertsBanner } from "@/components/AlertsBanner";
import type { GenericAlert } from "@/components/AlertsBanner";
import { useState, useMemo } from "react";
import { OrdemDetalheSheet } from "@/components/OrdemDetalheSheet";
import { NovaOrdemDialog } from "@/components/NovaOrdemDialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { differenceInHours, startOfMonth, endOfMonth, subMonths, format, startOfDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip as RTooltip, ResponsiveContainer,
  PieChart, Pie, Cell, CartesianGrid,
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

const fmt = (v: number) => `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;
const fmtShort = (v: number) => `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 0 })}`;

const CHART_COLORS = [
  "hsl(224, 76%, 48%)", "hsl(152, 55%, 42%)", "hsl(36, 90%, 52%)",
  "hsl(212, 72%, 52%)", "hsl(0, 72%, 51%)", "hsl(280, 60%, 50%)",
  "hsl(320, 60%, 50%)", "hsl(170, 55%, 42%)",
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
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: summary, isLoading: loadingOrders } = useQuery({
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
      queryClient.invalidateQueries({ queryKey: ["dashboard-summary"] });
      toast.success("Ordem marcada como entregue!");
    },
  });

  const filteredOrders = useMemo(() => {
    if (filtroLoja === "todas") return orders;
    return orders.filter(o => o.loja_id === filtroLoja);
  }, [orders, filtroLoja]);

  const kpis = useMemo(() => {
    const now = new Date();
    const hoje = startOfDay(now);
    const mesAtual = now.getMonth();
    const anoAtual = now.getFullYear();

    const ativas = filteredOrders.filter(o => o.status !== "entregue");

    // --- FINANCEIRO DO MÊS ---
    const ordensMes = filteredOrders.filter(o => {
      const d = new Date(o.data_entrada);
      return d.getMonth() === mesAtual && d.getFullYear() === anoAtual;
    });

    // Faturamento: OS com status "pronto" ou "entregue" no mês
    const ordensFaturadas = ordensMes.filter(o => o.status === "pronto" || o.status === "entregue");
    const faturamentoMes = ordensFaturadas.reduce((s, o) => s + Number(o.valor ?? 0), 0);

    // Custo de peças do mês
    const custosPecasMes = ordensMes.reduce((s, o) => s + Number(o.custo_pecas ?? 0), 0);

    // Despesas pagas no mês - separadas em fixas e variáveis
    const allContasPagas = contasPagas ?? [];
    const despesasPagasMes = allContasPagas.reduce((s: number, c: any) => s + Number(c.valor ?? 0), 0);
    const gastosFixos = allContasPagas
      .filter((c: any) => c.categorias_financeiras?.tipo === "fixo")
      .reduce((s: number, c: any) => s + Number(c.valor ?? 0), 0);
    const gastosVariaveis = despesasPagasMes - gastosFixos;

    // Comissões do mês
    const comissoesMes = (comissoesMesData ?? []).reduce((s: number, c: any) => s + Number(c.valor ?? 0), 0);

    // Recebimentos extras do mês
    const totalRecebimentos = (recebimentosMes ?? []).reduce((s: number, r: any) => s + Number(r.valor ?? 0), 0);

    // Lucro real = Faturamento - Peças - Despesas - Comissões + Recebimentos
    const lucroReal = faturamentoMes - custosPecasMes - despesasPagasMes - comissoesMes + totalRecebimentos;

    // Ticket médio
    const ordensComValor = ordensFaturadas.filter(o => Number(o.valor ?? 0) > 0);
    const ticketMedio = ordensComValor.length > 0
      ? ordensComValor.reduce((s, o) => s + Number(o.valor ?? 0), 0) / ordensComValor.length
      : 0;

    // --- OPERACIONAL ---
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
    const aguardandoReparo = ativas.filter(o => ["recebido", "em_analise", "em_reparo"].includes(o.status)).length;

    const statusCounts: Record<string, number> = {};
    for (const o of ativas) {
      statusCounts[o.status] = (statusCounts[o.status] || 0) + 1;
    }

    const contasValor = contasPendentes.reduce((s: number, c: any) => s + Number(c.valor ?? 0), 0);
    const comissoesValor = comissoesPendentes.reduce((s: number, c: any) => s + Number(c.valor ?? 0), 0);

    // Contas vencidas
    const contasVencidas = contasPendentes.filter((c: any) =>
      new Date(c.data_vencimento + "T23:59:59") < hoje
    ).length;

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

    // Ajustes mensais (depreciação + impostos)
    const allAjustes = ajustesMes ?? [];
    const depreciacao = allAjustes
      .filter((a: any) => a.tipo === "depreciacao")
      .reduce((s: number, a: any) => s + Number(a.valor ?? 0), 0);
    const impostos = allAjustes
      .filter((a: any) => a.tipo === "impostos")
      .reduce((s: number, a: any) => s + Number(a.valor ?? 0), 0);
    const outrosAjustes = allAjustes
      .filter((a: any) => a.tipo !== "depreciacao" && a.tipo !== "impostos")
      .reduce((s: number, a: any) => s + Number(a.valor ?? 0), 0);

    // Lucro líquido = Lucro real (EBITDA) - depreciação - impostos - outros
    const lucroLiquido = lucroReal - depreciacao - impostos - outrosAjustes;

    const metaGastos = Number(empresaConfig?.meta_gastos_mes ?? 0);
    const metaFaturamento = Number(empresaConfig?.meta_faturamento_mes ?? 0);
    const margemLiquida = faturamentoMes > 0 ? lucroLiquido / faturamentoMes : 0;
    const previsaoLucroLiquido = metaFaturamento > 0 ? metaFaturamento * margemLiquida : 0;

    return {
      faturamentoMes, custosPecasMes, despesasPagasMes, comissoesMes,
      totalRecebimentos, lucroReal, lucroLiquido, ticketMedio,
      lucroPorOS: ordensMes.length > 0 ? lucroLiquido / ordensMes.length : 0,
      depreciacao, impostos, outrosAjustes,
      gastosFixos, gastosVariaveis, metaGastos, metaFaturamento,
      previsaoLucroLiquido, margemLiquida,
      tempoMedio, emAtraso, emAssistencia, aguardandoEntrega, aguardandoReparo, statusCounts,
      contasValor, comissoesValor, contasVencidas,
      estoqueBaixo: pecasEstoqueBaixo,
      totalOrdensMes: ordensMes.length,
      totalFaturadas: ordensFaturadas.length,
      iphonesReparados: ordensMes.filter(o => {
        const marca = (o.aparelhos as any)?.marca?.toLowerCase() ?? "";
        const modelo = (o.aparelhos as any)?.modelo?.toLowerCase() ?? "";
        return marca.includes("apple") || modelo.includes("iphone");
      }).length,
      lucroPorLoja,
    };
  }, [filteredOrders, contasPendentes, comissoesPendentes, pecasEstoqueBaixo, lojas, contasPagas, recebimentosMes, comissoesMesData, ajustesMes, empresaConfig]);

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
      const fat = mesOrdens
        .filter(o => o.status === "pronto" || o.status === "entregue")
        .reduce((s, o) => s + Number(o.valor ?? 0), 0);
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

  // Top marcas
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

  const allAlertas = useMemo<GenericAlert[]>(() => {
    const finAlertas: GenericAlert[] = [];
    const hoje = new Date().toISOString().split("T")[0];
    const contasHoje = contasPendentes.filter((c: any) => c.data_vencimento === hoje);
    const contasAtrasadas = contasPendentes.filter((c: any) => c.data_vencimento < hoje);

    if (contasAtrasadas.length > 0) {
      finAlertas.push({
        type: "danger",
        message: `${contasAtrasadas.length} conta(s) a pagar atrasada(s) — total R$ ${contasAtrasadas.reduce((s: number, c: any) => s + Number(c.valor), 0).toLocaleString("pt-BR")}`,
      });
    }
    if (contasHoje.length > 0) {
      finAlertas.push({
        type: "warning",
        message: `${contasHoje.length} conta(s) vencendo hoje — total R$ ${contasHoje.reduce((s: number, c: any) => s + Number(c.valor), 0).toLocaleString("pt-BR")}`,
      });
    }
    if (comissoesPendentes.length > 0) {
      finAlertas.push({
        type: "info",
        message: `${comissoesPendentes.length} comissão(ões) pendente(s) — total R$ ${comissoesPendentes.reduce((s: number, c: any) => s + Number(c.valor), 0).toLocaleString("pt-BR")}`,
      });
    }

    return [...finAlertas, ...alertasOS];
  }, [alertasOS, contasPendentes, comissoesPendentes]);

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
      {/* Header */}
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
                {lojas.map((l: any) => (
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

      {/* SEÇÃO 1 — FINANCEIRO DO MÊS */}
      <div>
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">Financeiro do Mês</h2>
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
          <div className="stat-card">
            <div className="flex items-center justify-between mb-3">
              <DollarSign className="h-4 w-4 text-primary" />
              <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded-full">{kpis.totalFaturadas} OS</span>
            </div>
            <p className="stat-value">{fmt(kpis.faturamentoMes)}</p>
            <p className="stat-label">Faturamento</p>
          </div>

          <div className={`stat-card ${kpis.lucroReal >= 0 ? "border-success/20 bg-success-muted" : "border-destructive/20 bg-destructive/5"}`}>
            <div className="flex items-center justify-between mb-3">
              <TrendingUp className={`h-4 w-4 ${kpis.lucroReal >= 0 ? "text-success" : "text-destructive"}`} />
              {kpis.faturamentoMes > 0 && (
                <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${kpis.lucroReal >= 0 ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive"}`}>
                  {((kpis.lucroReal / kpis.faturamentoMes) * 100).toFixed(1)}%
                </span>
              )}
            </div>
            <p className={`stat-value ${kpis.lucroReal >= 0 ? "text-success" : "text-destructive"}`}>{fmt(kpis.lucroReal)}</p>
            <p className="stat-label">EBITDA (margem)</p>
          </div>

          {(() => {
            const margemPct = kpis.faturamentoMes > 0 ? (kpis.lucroLiquido / kpis.faturamentoMes) * 100 : 0;
            // Verde ≥ 15%, Amarelo 0-15%, Vermelho < 0%
            const faixa = margemPct >= 15 ? "success" : margemPct >= 0 ? "warning" : "destructive";
            const borderBg = faixa === "success"
              ? "border-success/20 bg-success-muted"
              : faixa === "warning"
                ? "border-warning/30 bg-warning-muted"
                : "border-destructive/20 bg-destructive/5";
            const textColor = faixa === "success" ? "text-success" : faixa === "warning" ? "text-warning" : "text-destructive";
            const badgeBg = faixa === "success" ? "bg-success/10 text-success" : faixa === "warning" ? "bg-warning/10 text-warning" : "bg-destructive/10 text-destructive";
            return (
              <div className={`stat-card ${borderBg}`}>
                <div className="flex items-center justify-between mb-3">
                  <ArrowDownRight className={`h-4 w-4 ${textColor}`} />
                  {kpis.faturamentoMes > 0 && (
                    <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${badgeBg}`}>
                      {margemPct.toFixed(1)}%
                    </span>
                  )}
                </div>
                <p className={`stat-value ${textColor}`}>{fmt(kpis.lucroLiquido)}</p>
                <p className="stat-label">{kpis.lucroLiquido < 0 ? "Prejuízo líquido" : "Lucro líquido (margem)"}</p>
                {kpis.lucroLiquido < 0 && (
                  <p className="text-[10px] text-destructive font-semibold mt-1">
                    ⚠ Déficit de {fmt(Math.abs(kpis.lucroLiquido))}
                  </p>
                )}
              </div>
            );
          })()}

          <div className="stat-card">
            <DollarSign className="h-4 w-4 text-info mb-3" />
            <p className="stat-value">{fmt(kpis.ticketMedio)}</p>
            <p className="stat-label">Ticket médio</p>
          </div>

          <div className={`stat-card ${kpis.lucroPorOS < 0 ? "border-destructive/20 bg-destructive/5" : ""}`}>
            <ArrowDownRight className={`h-4 w-4 mb-3 ${kpis.lucroPorOS >= 0 ? "text-success" : "text-destructive"}`} />
            <p className={`stat-value ${kpis.lucroPorOS >= 0 ? "text-success" : "text-destructive"}`}>{fmt(kpis.lucroPorOS)}</p>
            <p className="stat-label">Lucro líq. por OS</p>
          </div>

          <div className={`stat-card ${kpis.contasVencidas > 0 ? "border-destructive/20 bg-destructive/5" : ""}`}>
            <CreditCard className={`h-4 w-4 mb-3 ${kpis.contasVencidas > 0 ? "text-destructive" : "text-warning"}`} />
            <p className={`stat-value ${kpis.contasVencidas > 0 ? "text-destructive" : ""}`}>{fmt(kpis.contasValor)}</p>
            <p className="stat-label">Contas a pagar{kpis.contasVencidas > 0 ? ` (${kpis.contasVencidas} vencida${kpis.contasVencidas > 1 ? "s" : ""})` : ""}</p>
          </div>
        </div>

        {/* Breakdown row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3 mt-3">
          <div className="stat-card py-3">
            <Wallet className="h-3.5 w-3.5 text-success mb-2" />
            <p className="text-sm font-semibold">{fmt(kpis.totalRecebimentos)}</p>
            <p className="stat-label">Recebimentos</p>
          </div>
          <div className="stat-card py-3">
            <Package className="h-3.5 w-3.5 text-warning mb-2" />
            <p className="text-sm font-semibold">{fmt(kpis.custosPecasMes)}</p>
            <p className="stat-label">Custo peças</p>
          </div>
          <div className="stat-card py-3">
            <Receipt className="h-3.5 w-3.5 text-destructive mb-2" />
            <p className="text-sm font-semibold">{fmt(kpis.despesasPagasMes)}</p>
            <p className="stat-label">Despesas pagas</p>
          </div>
          <div className="stat-card py-3">
            <Users className="h-3.5 w-3.5 text-info mb-2" />
            <p className="text-sm font-semibold">{fmt(kpis.comissoesMes)}</p>
            <p className="stat-label">Comissões</p>
          </div>
          <div className="stat-card py-3">
            <Receipt className="h-3.5 w-3.5 text-muted-foreground mb-2" />
            <p className="text-sm font-semibold">{fmt(kpis.depreciacao)}</p>
            <p className="stat-label">Depreciação</p>
          </div>
          <div className="stat-card py-3">
            <CreditCard className="h-3.5 w-3.5 text-muted-foreground mb-2" />
            <p className="text-sm font-semibold">{fmt(kpis.impostos)}</p>
            <p className="stat-label">Impostos</p>
          </div>
          <div className="stat-card py-3">
            <Users className="h-3.5 w-3.5 text-warning mb-2" />
            <p className="text-sm font-semibold">{fmt(kpis.comissoesValor)}</p>
            <p className="stat-label">Comissões pendentes</p>
          </div>
        </div>

        {/* Fórmulas */}
        <div className="section-card mt-3">
          <div className="p-3 space-y-1">
            <p className="text-xs text-muted-foreground">
              <strong>EBITDA:</strong> Faturamento ({fmt(kpis.faturamentoMes)}) + Recebimentos ({fmt(kpis.totalRecebimentos)}) − Peças ({fmt(kpis.custosPecasMes)}) − Despesas ({fmt(kpis.despesasPagasMes)}) − Comissões ({fmt(kpis.comissoesMes)}) = <strong className={kpis.lucroReal >= 0 ? "text-success" : "text-destructive"}>{fmt(kpis.lucroReal)}</strong>
            </p>
            <p className="text-xs text-muted-foreground">
              <strong>Lucro líquido:</strong> EBITDA ({fmt(kpis.lucroReal)}) − Depreciação ({fmt(kpis.depreciacao)}) − Impostos ({fmt(kpis.impostos)}){kpis.outrosAjustes > 0 ? ` − Outros (${fmt(kpis.outrosAjustes)})` : ""} = <strong className={kpis.lucroLiquido >= 0 ? "text-success" : "text-destructive"}>{fmt(kpis.lucroLiquido)}</strong>
            </p>
          </div>
        </div>

        {/* Barra de progresso faturamento vs meta */}
        {kpis.metaFaturamento > 0 && (
          <div className="section-card mt-3">
            <div className="p-3">
              <div className="flex items-center justify-between text-xs mb-2">
                <span className="text-muted-foreground">Faturamento vs Meta</span>
                <span className={`font-semibold ${kpis.faturamentoMes >= kpis.metaFaturamento ? "text-success" : kpis.faturamentoMes >= kpis.metaFaturamento * 0.6 ? "text-warning" : "text-destructive"}`}>
                  {((kpis.faturamentoMes / kpis.metaFaturamento) * 100).toFixed(0)}%
                </span>
              </div>
              <div className="h-3 bg-muted rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${
                    kpis.faturamentoMes >= kpis.metaFaturamento
                      ? "bg-success"
                      : kpis.faturamentoMes >= kpis.metaFaturamento * 0.6
                        ? "bg-warning"
                        : "bg-destructive"
                  }`}
                  style={{ width: `${Math.min((kpis.faturamentoMes / kpis.metaFaturamento) * 100, 100)}%` }}
                />
              </div>
              <div className="flex justify-between text-[10px] text-muted-foreground mt-1">
                <span>{fmt(kpis.faturamentoMes)} faturado</span>
                <span>{fmt(kpis.metaFaturamento)} meta</span>
              </div>
            </div>
          </div>
        )}

        {/* Previsão de lucro líquido */}
        {kpis.metaFaturamento > 0 && kpis.faturamentoMes > 0 && (
          <div className="section-card mt-3">
            <div className="p-3 flex items-center justify-between">
              <div className="text-xs text-muted-foreground">
                <strong>Previsão de lucro líquido:</strong> Meta faturamento ({fmt(kpis.metaFaturamento)}) × Margem atual ({(kpis.margemLiquida * 100).toFixed(1)}%)
              </div>
              <span className={`text-sm font-bold ${kpis.previsaoLucroLiquido >= 0 ? "text-success" : "text-destructive"}`}>
                {fmt(kpis.previsaoLucroLiquido)}
              </span>
            </div>
          </div>
        )}
      </div>
      <div>
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">Gastos e Previsões</h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="stat-card">
            <Receipt className="h-4 w-4 text-muted-foreground mb-3" />
            <p className="stat-value">{fmt(kpis.gastosFixos)}</p>
            <p className="stat-label">Gastos fixos</p>
          </div>
          <div className="stat-card">
            <Receipt className="h-4 w-4 text-warning mb-3" />
            <p className="stat-value">{fmt(kpis.gastosVariaveis)}</p>
            <p className="stat-label">Gastos variáveis</p>
          </div>
          <div className="stat-card">
            <DollarSign className="h-4 w-4 text-info mb-3" />
            <p className="stat-value">{fmt(kpis.despesasPagasMes)}</p>
            <p className="stat-label">Total gastos do mês</p>
          </div>
          <div className={`stat-card ${kpis.metaGastos > 0 && kpis.despesasPagasMes > kpis.metaGastos ? "border-destructive/20 bg-destructive/5" : ""}`}>
            <AlertTriangle className={`h-4 w-4 mb-3 ${kpis.metaGastos > 0 && kpis.despesasPagasMes > kpis.metaGastos ? "text-destructive" : "text-muted-foreground"}`} />
            <p className="stat-value">{kpis.metaGastos > 0 ? fmt(kpis.metaGastos) : "Não definida"}</p>
            <p className="stat-label">Meta de gastos</p>
          </div>
        </div>

        {/* Barra de progresso gastos vs meta */}
        {kpis.metaGastos > 0 && (
          <div className="section-card mt-3">
            <div className="p-3">
              <div className="flex items-center justify-between text-xs mb-2">
                <span className="text-muted-foreground">Gastos vs Meta</span>
                <span className={`font-semibold ${kpis.despesasPagasMes > kpis.metaGastos ? "text-destructive" : kpis.despesasPagasMes > kpis.metaGastos * 0.8 ? "text-warning" : "text-success"}`}>
                  {((kpis.despesasPagasMes / kpis.metaGastos) * 100).toFixed(0)}%
                </span>
              </div>
              <div className="h-3 bg-muted rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${
                    kpis.despesasPagasMes > kpis.metaGastos
                      ? "bg-destructive"
                      : kpis.despesasPagasMes > kpis.metaGastos * 0.8
                        ? "bg-warning"
                        : "bg-success"
                  }`}
                  style={{ width: `${Math.min((kpis.despesasPagasMes / kpis.metaGastos) * 100, 100)}%` }}
                />
              </div>
              <div className="flex justify-between text-[10px] text-muted-foreground mt-1">
                <span>{fmt(kpis.despesasPagasMes)} gastos</span>
                <span>{fmt(kpis.metaGastos)} meta</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* SEÇÃO 3 — OPERACIONAL */}
      <div>
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">Operacional</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <div className="stat-card">
            <Wrench className="h-4 w-4 text-primary mb-3" />
            <p className="stat-value">{kpis.totalOrdensMes}</p>
            <p className="stat-label">Assistências no mês</p>
          </div>
          <div className="stat-card">
            <Smartphone className="h-4 w-4 text-muted-foreground mb-3" />
            <p className="stat-value">{kpis.iphonesReparados}</p>
            <p className="stat-label">iPhones no mês</p>
          </div>
          <div className="stat-card">
            <Clock className="h-4 w-4 text-warning mb-3" />
            <p className="stat-value">{kpis.aguardandoReparo}</p>
            <p className="stat-label">Aguardando reparo</p>
          </div>
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
      </div>

      {/* SEÇÃO 3 — GRÁFICOS */}
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
                  formatter={(value: number) => [fmtShort(value)]}
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
                    <span className="text-muted-foreground">Receita: {fmtShort(l.receita)}</span>
                    <span className="text-muted-foreground">Custos: {fmtShort(l.custo)}</span>
                    <span className={`font-semibold ${l.lucro >= 0 ? "text-success" : "text-destructive"}`}>{fmtShort(l.lucro)}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Status bar */}
      <div>
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">Visão por Status</h2>
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
        onSuccess={() => queryClient.invalidateQueries({ queryKey: ["dashboard-summary"] })}
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
