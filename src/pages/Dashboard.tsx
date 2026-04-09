import {
  Wrench, Clock, DollarSign, TrendingUp, CheckCircle, Loader2,
  AlertTriangle, Plus, Search, MessageCircle, Package, BarChart3, Timer,
} from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAlertas } from "@/hooks/useAlertas";
import { useAlertasEstoque, useAlertasEstoqueCruzado } from "@/hooks/useAlertasEstoque";
import { useAlertasPecas } from "@/hooks/useAlertasPecas";
import { AlertsBanner } from "@/components/AlertsBanner";
import type { GenericAlert } from "@/components/AlertsBanner";
import { useState, useMemo } from "react";
import { OrdemDetalheSheet } from "@/components/OrdemDetalheSheet";
import { NovaOrdemDialog } from "@/components/NovaOrdemDialog";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { differenceInDays, differenceInHours } from "date-fns";

type OrderRow = {
  id: string;
  numero: number;
  status: string;
  data_entrada: string;
  data_conclusao: string | null;
  previsao_entrega: string | null;
  valor: number | null;
  custo_pecas: number | null;
  aparelhos?: {
    marca: string;
    modelo: string;
    imei: string | null;
    clientes?: { nome: string; telefone: string } | null;
  } | null;
};

async function fetchOrders() {
  const { data, error } = await supabase
    .from("ordens_de_servico")
    .select(`*, aparelhos ( marca, modelo, imei, clientes ( nome, telefone ) )`)
    .order("data_entrada", { ascending: false });
  if (error) throw error;
  return (data ?? []) as OrderRow[];
}

async function fetchPecas() {
  const { data, error } = await supabase.from("estoque").select("id, nome, quantidade, quantidade_minima, categoria");
  if (error) throw error;
  return data ?? [];
}

async function fetchEstoqueAp() {
  const { data, error } = await supabase.from("estoque_aparelhos").select("*");
  if (error) throw error;
  return data ?? [];
}

async function fetchFinanceiro() {
  const { data, error } = await supabase.from("movimentacoes_financeiras").select("tipo, valor, data");
  if (error) throw error;
  return data ?? [];
}

const fmt = (v: number) => `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 0 })}`;

const statusLabels: Record<string, string> = {
  recebido: "Recebido",
  em_analise: "Em Análise",
  aguardando_aprovacao: "Aguard. Aprovação",
  em_reparo: "Em Reparo",
  pronto: "Pronto",
  entregue: "Entregue",
};

const statusColors: Record<string, string> = {
  recebido: "bg-info",
  em_analise: "bg-warning",
  aguardando_aprovacao: "bg-destructive",
  em_reparo: "bg-primary",
  pronto: "bg-success",
  entregue: "bg-muted-foreground",
};

export default function Dashboard() {
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [novaOrdemOpen, setNovaOrdemOpen] = useState(false);
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: orders = [], isLoading: loadingOrders } = useQuery({ queryKey: ["ordens"], queryFn: fetchOrders });
  const { data: pecas = [] } = useQuery({ queryKey: ["pecas"], queryFn: fetchPecas });
  const { data: estoqueAp = [] } = useQuery({ queryKey: ["estoque-ap"], queryFn: fetchEstoqueAp });
  const { data: fin = [] } = useQuery({ queryKey: ["financeiro-dash"], queryFn: fetchFinanceiro });

  // Mark as delivered mutation
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

  // KPIs
  const kpis = useMemo(() => {
    const now = new Date();
    const hoje = now.toISOString().split("T")[0];
    const mesAtual = now.getMonth();
    const anoAtual = now.getFullYear();

    const ativas = orders.filter(o => o.status !== "entregue");
    const ordensHoje = orders.filter(o => o.data_entrada.split("T")[0] === hoje);
    const ordensMes = orders.filter(o => {
      const d = new Date(o.data_entrada);
      return d.getMonth() === mesAtual && d.getFullYear() === anoAtual;
    });

    // Receita do dia (ordens de hoje com valor)
    const receitaDia = ordensHoje.reduce((s, o) => s + Number(o.valor ?? 0), 0);

    // Lucro do dia
    const lucroDia = ordensHoje.reduce((s, o) => s + (Number(o.valor ?? 0) - Number(o.custo_pecas ?? 0)), 0);

    // Lucro do mês
    const lucroMes = ordensMes.reduce((s, o) => s + (Number(o.valor ?? 0) - Number(o.custo_pecas ?? 0)), 0);

    // Ticket médio (mês)
    const ordensComValorMes = ordensMes.filter(o => Number(o.valor ?? 0) > 0);
    const ticketMedio = ordensComValorMes.length > 0
      ? ordensComValorMes.reduce((s, o) => s + Number(o.valor ?? 0), 0) / ordensComValorMes.length
      : 0;

    // Tempo médio de reparo (ordens concluídas)
    const concluidas = orders.filter(o => o.data_conclusao);
    let tempoMedio = 0;
    if (concluidas.length > 0) {
      const totalHoras = concluidas.reduce((s, o) => {
        return s + differenceInHours(new Date(o.data_conclusao!), new Date(o.data_entrada));
      }, 0);
      tempoMedio = Math.round(totalHoras / concluidas.length);
    }

    // Ordens em atraso
    const emAtraso = ativas.filter(o =>
      o.previsao_entrega && new Date(o.previsao_entrega) < now && o.status !== "pronto"
    ).length;

    // Em assistência
    const emAssistencia = ativas.filter(o => !["pronto"].includes(o.status)).length;
    const aguardandoEntrega = ativas.filter(o => o.status === "pronto").length;

    // Status counts (for kanban)
    const statusCounts: Record<string, number> = {};
    for (const o of ativas) {
      statusCounts[o.status] = (statusCounts[o.status] || 0) + 1;
    }

    return {
      receitaDia, lucroDia, lucroMes, ticketMedio, tempoMedio,
      emAtraso, emAssistencia, aguardandoEntrega, statusCounts,
    };
  }, [orders]);

  // Alertas
  const alertasOS = useAlertas(orders);
  const alertasEstoque = useAlertasEstoque(estoqueAp);
  const ordensAtivas = orders.filter(o => o.status !== "entregue");
  const alertasCruzados = useAlertasEstoqueCruzado(estoqueAp, ordensAtivas);
  const alertasPecas = useAlertasPecas(pecas);

  // Enrich alerts with phone and actions
  const allAlertas = useMemo<GenericAlert[]>(() => {
    const enriched = alertasOS.map(a => {
      const order = orders.find(o => o.id === a.orderId);
      const phone = order?.aparelhos?.clientes?.telefone;
      const actions: ("whatsapp" | "cobrar" | "entregar")[] = [];
      if (phone) actions.push("whatsapp");
      if (order?.status === "pronto") actions.push("entregar");
      if (order?.status === "aguardando_aprovacao") actions.push("cobrar");
      if (a.type === "danger" && phone) actions.push("cobrar");
      return { ...a, phone, actions };
    });

    return [
      ...enriched,
      ...alertasCruzados,
      ...alertasEstoque,
      ...alertasPecas,
    ];
  }, [alertasOS, alertasEstoque, alertasCruzados, alertasPecas, orders]);

  const handleAlertAction = (action: string, orderId: string, phone?: string) => {
    if (action === "whatsapp" && phone) {
      const cleanPhone = phone.replace(/\D/g, "");
      const fullPhone = cleanPhone.startsWith("55") ? cleanPhone : `55${cleanPhone}`;
      window.open(`https://wa.me/${fullPhone}`, "_blank");
    } else if (action === "cobrar" && phone) {
      const cleanPhone = phone.replace(/\D/g, "");
      const fullPhone = cleanPhone.startsWith("55") ? cleanPhone : `55${cleanPhone}`;
      const order = orders.find(o => o.id === orderId);
      const msg = encodeURIComponent(
        `Olá! Informamos que o serviço referente à OS #${String(order?.numero ?? 0).padStart(3, "0")} está aguardando sua aprovação. Por favor, entre em contato conosco.`
      );
      window.open(`https://wa.me/${fullPhone}?text=${msg}`, "_blank");
    } else if (action === "entregar") {
      entregarMutation.mutate(orderId);
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
      {/* Header + Quick Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="page-title">Central de Controle</h1>
          <p className="page-subtitle">Visão operacional da assistência</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" onClick={() => setNovaOrdemOpen(true)} className="gap-1.5">
            <Plus className="h-3.5 w-3.5" /> Nova OS
          </Button>
          <Button size="sm" variant="outline" onClick={() => navigate("/clientes")} className="gap-1.5">
            <Search className="h-3.5 w-3.5" /> Clientes
          </Button>
          <Button size="sm" variant="outline" onClick={() => navigate("/pecas")} className="gap-1.5">
            <Package className="h-3.5 w-3.5" /> Peças
          </Button>
          <Button size="sm" variant="outline" onClick={() => navigate("/estoque/conferencia")} className="gap-1.5">
            <BarChart3 className="h-3.5 w-3.5" /> Conferir Estoque
          </Button>
        </div>
      </div>

      {/* KPI Cards — Row 1: Financial */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="stat-card">
          <DollarSign className="h-4 w-4 text-success mb-3" />
          <p className="stat-value">{fmt(kpis.receitaDia)}</p>
          <p className="stat-label">Receita do dia</p>
        </div>
        <div className="stat-card">
          <TrendingUp className="h-4 w-4 text-success mb-3" />
          <p className="stat-value text-success">{fmt(kpis.lucroDia)}</p>
          <p className="stat-label">Lucro do dia</p>
        </div>
        <div className="stat-card border-success/20 bg-success-muted">
          <TrendingUp className="h-4 w-4 text-success mb-3" />
          <p className="stat-value text-success">{fmt(kpis.lucroMes)}</p>
          <p className="stat-label">Lucro do mês</p>
        </div>
        <div className="stat-card">
          <DollarSign className="h-4 w-4 text-muted-foreground mb-3" />
          <p className="stat-value">{fmt(kpis.ticketMedio)}</p>
          <p className="stat-label">Ticket médio</p>
        </div>
      </div>

      {/* KPI Cards — Row 2: Operational */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="stat-card">
          <Wrench className="h-4 w-4 text-info mb-3" />
          <p className="stat-value">{kpis.emAssistencia}</p>
          <p className="stat-label">Em assistência</p>
        </div>
        <div className="stat-card">
          <CheckCircle className="h-4 w-4 text-success mb-3" />
          <p className="stat-value">{kpis.aguardandoEntrega}</p>
          <p className="stat-label">Aguardando entrega</p>
        </div>
        <div className="stat-card">
          <Timer className="h-4 w-4 text-warning mb-3" />
          <p className="stat-value">{tempoMedioLabel}</p>
          <p className="stat-label">Tempo médio reparo</p>
        </div>
        <div className={`stat-card ${kpis.emAtraso > 0 ? "border-destructive/30 bg-destructive/5" : ""}`}>
          <AlertTriangle className={`h-4 w-4 mb-3 ${kpis.emAtraso > 0 ? "text-destructive" : "text-muted-foreground"}`} />
          <p className={`stat-value ${kpis.emAtraso > 0 ? "text-destructive" : ""}`}>{kpis.emAtraso}</p>
          <p className="stat-label">Ordens em atraso</p>
        </div>
      </div>

      {/* Status Kanban Summary */}
      <div>
        <h2 className="section-title mb-3">Visão por Status</h2>
        <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
          {(["recebido", "em_analise", "aguardando_aprovacao", "em_reparo", "pronto"] as const).map(status => {
            const count = kpis.statusCounts[status] || 0;
            return (
              <div
                key={status}
                onClick={() => navigate("/assistencia")}
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

      {/* Alertas */}
      {allAlertas.length > 0 && (
        <div>
          <h2 className="section-title mb-3">
            Alertas
            <span className="ml-2 inline-flex items-center justify-center rounded-full bg-destructive/10 text-destructive text-xs font-medium px-2 py-0.5">
              {allAlertas.length}
            </span>
          </h2>
          <AlertsBanner
            alertas={allAlertas}
            max={10}
            onClickAlert={setSelectedOrderId}
            onAction={handleAlertAction}
          />
        </div>
      )}

      <OrdemDetalheSheet orderId={selectedOrderId} onClose={() => setSelectedOrderId(null)} />
      <NovaOrdemDialog
        open={novaOrdemOpen}
        onOpenChange={setNovaOrdemOpen}
        onSuccess={() => queryClient.invalidateQueries({ queryKey: ["ordens"] })}
      />
    </div>
  );
}
