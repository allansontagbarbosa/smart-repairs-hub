import { Wrench, Package, Clock, DollarSign, TrendingUp, TrendingDown, CheckCircle, Loader2 } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAlertas } from "@/hooks/useAlertas";
import { useAlertasEstoque, useAlertasEstoqueCruzado } from "@/hooks/useAlertasEstoque";
import { useAlertasPecas } from "@/hooks/useAlertasPecas";
import { AlertsBanner } from "@/components/AlertsBanner";
import type { GenericAlert } from "@/components/AlertsBanner";
import { useState, useMemo } from "react";
import { OrdemDetalheSheet } from "@/components/OrdemDetalheSheet";

async function fetchOrders() {
  const { data, error } = await supabase
    .from("ordens_de_servico")
    .select(`*, aparelhos ( marca, modelo, imei, clientes ( nome, telefone ) )`)
    .order("data_entrada", { ascending: false });
  if (error) throw error;
  return data;
}

async function fetchPecas() {
  const { data, error } = await supabase.from("estoque").select("id, nome, quantidade, quantidade_minima, categoria");
  if (error) throw error;
  return data ?? [];
}

async function fetchKpis() {
  const [ordensRes, estoqueRes, estoqueApRes, finRes] = await Promise.all([
    supabase.from("ordens_de_servico").select("status, valor"),
    supabase.from("estoque").select("quantidade, preco_custo"),
    supabase.from("estoque_aparelhos").select("*"),
    supabase.from("movimentacoes_financeiras").select("tipo, valor, data"),
  ]);

  const ordens = ordensRes.data ?? [];
  const estoque = estoqueRes.data ?? [];
  const estoqueAp = estoqueApRes.data ?? [];
  const fin = finRes.data ?? [];

  const emAssistencia = ordens.filter(o => !["pronto", "entregue"].includes(o.status)).length;
  const aguardandoEntrega = ordens.filter(o => o.status === "pronto").length;
  const totalPecas = estoqueAp.filter(a => a.status === "disponivel").length;
  const valorEstoque = estoqueAp.reduce((s, a) => s + Number(a.custo_compra ?? 0), 0);

  const now = new Date();
  const mesAtual = now.getMonth();
  const anoAtual = now.getFullYear();
  const finMes = fin.filter(f => {
    const d = new Date(f.data);
    return d.getMonth() === mesAtual && d.getFullYear() === anoAtual;
  });
  const entradas = finMes.filter(f => f.tipo === "entrada").reduce((s, f) => s + Number(f.valor), 0);
  const saidas = finMes.filter(f => f.tipo === "saida").reduce((s, f) => s + Number(f.valor), 0);

  return { emAssistencia, aguardandoEntrega, totalPecas, valorEstoque, entradas, saidas, lucro: entradas - saidas, estoqueAp };
}

const fmt = (v: number) => `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 0 })}`;

export default function Dashboard() {
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);

  const { data: orders = [] } = useQuery({ queryKey: ["ordens"], queryFn: fetchOrders });
  const { data: kpis, isLoading } = useQuery({ queryKey: ["dashboard-kpis"], queryFn: fetchKpis });
  const { data: pecas = [] } = useQuery({ queryKey: ["pecas"], queryFn: fetchPecas });
  const alertasOS = useAlertas(orders);
  const alertasEstoque = useAlertasEstoque(kpis?.estoqueAp ?? []);
  const alertasPecas = useAlertasPecas(pecas);
  const ordensAtivas = orders.filter(o => o.status !== "entregue");
  const alertasCruzados = useAlertasEstoqueCruzado(kpis?.estoqueAp ?? [], ordensAtivas);
  const allAlertas = useMemo<GenericAlert[]>(() => [
    ...alertasOS,
    ...alertasCruzados,
    ...alertasEstoque,
    ...alertasPecas,
  ], [alertasOS, alertasEstoque, alertasCruzados, alertasPecas]);

  const k = kpis ?? { emAssistencia: 0, aguardandoEntrega: 0, totalPecas: 0, valorEstoque: 0, entradas: 0, saidas: 0, lucro: 0 };

  if (isLoading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6 md:space-y-8">
      <div className="page-header">
        <h1 className="page-title">Dashboard</h1>
        <p className="page-subtitle">Resumo geral da assistência</p>
      </div>

      {/* KPI Cards — row 1 */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="stat-card">
          <Wrench className="h-4 w-4 text-info mb-3" />
          <p className="stat-value">{k.emAssistencia}</p>
          <p className="stat-label">Em assistência</p>
        </div>
        <div className="stat-card">
          <CheckCircle className="h-4 w-4 text-success mb-3" />
          <p className="stat-value">{k.aguardandoEntrega}</p>
          <p className="stat-label">Aguardando entrega</p>
        </div>
        <div className="stat-card">
          <Package className="h-4 w-4 text-muted-foreground mb-3" />
          <p className="stat-value">{k.totalPecas}</p>
          <p className="stat-label">Peças em estoque</p>
        </div>
        <div className="stat-card">
          <DollarSign className="h-4 w-4 text-muted-foreground mb-3" />
          <p className="stat-value">{fmt(k.valorEstoque)}</p>
          <p className="stat-label">Valor do estoque</p>
        </div>
      </div>

      {/* KPI Cards — row 2 */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="stat-card">
          <TrendingUp className="h-4 w-4 text-success mb-3" />
          <p className="stat-value">{fmt(k.entradas)}</p>
          <p className="stat-label">Entradas do mês</p>
        </div>
        <div className="stat-card">
          <TrendingDown className="h-4 w-4 text-destructive mb-3" />
          <p className="stat-value">{fmt(k.saidas)}</p>
          <p className="stat-label">Saídas do mês</p>
        </div>
        <div className="stat-card border-success/20 bg-success-muted">
          <DollarSign className="h-4 w-4 text-success mb-3" />
          <p className="stat-value text-success">{fmt(k.lucro)}</p>
          <p className="stat-label">Lucro líquido do mês</p>
        </div>
      </div>

      {/* Alertas */}
      {allAlertas.length > 0 && (
        <div>
          <h2 className="section-title mb-3">Alertas ({allAlertas.length})</h2>
          <AlertsBanner alertas={allAlertas} max={8} onClickAlert={setSelectedOrderId} />
        </div>
      )}

      <OrdemDetalheSheet orderId={selectedOrderId} onClose={() => setSelectedOrderId(null)} />
    </div>
  );
}
