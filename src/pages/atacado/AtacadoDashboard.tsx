import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEmpresa } from "@/contexts/EmpresaContext";
import { ComboWidget } from "@/components/ComboWidget";
import {
  Building2,
  ClipboardList,
  Zap,
  Users,
  AlertTriangle,
  TrendingUp,
  DollarSign,
  Plus,
  ArrowRight,
  Trophy,
  Wallet,
  Package,
  Clock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { formatBRL } from "@/lib/utils";
import { cn } from "@/lib/utils";

type Periodo = "hoje" | "este_mes" | "ultimos_30" | "este_ano";

export default function AtacadoDashboard() {
  const { empresaId } = useEmpresa();
  const [periodo, setPeriodo] = useState<Periodo>("este_mes");

  const hoje = new Date();
  const { inicio, fim } = (() => {
    const hojeStr = hoje.toISOString().slice(0, 10);
    if (periodo === "hoje") return { inicio: hojeStr, fim: hojeStr };
    if (periodo === "ultimos_30") {
      const d = new Date();
      d.setDate(d.getDate() - 30);
      return { inicio: d.toISOString().slice(0, 10), fim: hojeStr };
    }
    if (periodo === "este_ano") {
      return { inicio: `${hoje.getFullYear()}-01-01`, fim: hojeStr };
    }
    return {
      inicio: `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, "0")}-01`,
      fim: hojeStr,
    };
  })();

  const { data: kpis, isLoading: kpisLoading } = useQuery({
    queryKey: ["atacado-kpis", empresaId, inicio, fim],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("atacado_dashboard_kpis" as any, {
        p_empresa_id: empresaId,
        p_inicio: inicio,
        p_fim: fim,
      });
      if (error) throw error;
      return (data as any)?.[0];
    },
    enabled: !!empresaId,
  });

  const { data: topClientes = [] } = useQuery({
    queryKey: ["atacado-top-clientes", empresaId, inicio, fim],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("atacado_top_clientes" as any, {
        p_empresa_id: empresaId,
        p_inicio: inicio,
        p_fim: fim,
        p_limit: 5,
      });
      if (error) throw error;
      return (data as any) ?? [];
    },
    enabled: !!empresaId,
  });

  // Estoque (independente de vendas)
  const { data: estoqueAparelhos = [] } = useQuery({
    queryKey: ["atacado-dashboard-estoque", empresaId],
    queryFn: async () => {
      const { data } = await supabase
        .from("atacado_aparelhos" as any)
        .select("id, modelo, capacidade, custo, preco_sugerido, quantidade, status, data_entrada, data_compra")
        .eq("empresa_id", empresaId!)
        .is("deleted_at", null)
        .gt("quantidade", 0);
      return (data as any[]) ?? [];
    },
    enabled: !!empresaId,
  });

  const estoque = (() => {
    const aps = estoqueAparelhos.filter((a: any) =>
      ["estoque", "em_estoque", "disponivel", "STOQUE", "ESTOQUE", "DISPONIVEL"].some(
        (s) => String(a.status ?? "").toLowerCase() === s.toLowerCase(),
      ),
    );
    const unidades = aps.reduce((s, a: any) => s + Number(a.quantidade || 0), 0);
    const custoTotal = aps.reduce((s, a: any) => s + Number(a.custo || 0) * Number(a.quantidade || 0), 0);
    const vendaTotal = aps.reduce(
      (s, a: any) => s + Number(a.preco_sugerido || a.custo || 0) * Number(a.quantidade || 0),
      0,
    );
    const lucroPotencial = vendaTotal - custoTotal;
    const agora = Date.now();
    const diasOf = (a: any) =>
      a.data_entrada ? Math.floor((agora - new Date(a.data_entrada).getTime()) / 86400000) : 0;
    const lentos = aps.filter((a: any) => diasOf(a) > 60).length;
    const idadeMedia = aps.length
      ? Math.round(aps.reduce((s, a: any) => s + diasOf(a), 0) / aps.length)
      : 0;

    // Top modelos
    const map = new Map<string, { modelo: string; qtd: number; venda: number }>();
    for (const a of aps as any[]) {
      const k = `${a.modelo}${a.capacidade ? " · " + a.capacidade : ""}`;
      const cur = map.get(k) ?? { modelo: k, qtd: 0, venda: 0 };
      cur.qtd += Number(a.quantidade || 0);
      cur.venda += Number(a.preco_sugerido || a.custo || 0) * Number(a.quantidade || 0);
      map.set(k, cur);
    }
    const topModelos = Array.from(map.values()).sort((a, b) => b.venda - a.venda).slice(0, 5);
    return { unidades, custoTotal, vendaTotal, lucroPotencial, lentos, idadeMedia, topModelos };
  })();

  const fat = Number(kpis?.faturamento ?? 0);
  const qtd = Number(kpis?.qtd_pedidos ?? 0);
  const ticket = Number(kpis?.ticket_medio ?? 0);
  const aguardando = Number(kpis?.pedidos_aguardando ?? 0);
  const boletos = Number(kpis?.boletos_vencidos ?? 0);
  const inadimplencia = Number(kpis?.valor_inadimplencia ?? 0);
  const clientesAtivos = Number(kpis?.clientes_ativos ?? 0);
  const clientesBloqueados = Number(kpis?.clientes_bloqueados ?? 0);
  const novosClientes = Number(kpis?.novos_clientes_mes ?? 0);

  const semDados = qtd === 0 && clientesAtivos === 0;

  const periodLabels: Record<Periodo, string> = {
    hoje: "Hoje",
    este_mes: "Este mês",
    ultimos_30: "Últimos 30 dias",
    este_ano: "Este ano",
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Building2 className="h-6 w-6 text-primary" />
            Dashboard Atacado
          </h1>
          <p className="text-sm text-muted-foreground">Visão geral do módulo B2B/distribuidora</p>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {(Object.keys(periodLabels) as Periodo[]).map((p) => (
            <Button
              key={p}
              size="sm"
              variant={periodo === p ? "default" : "outline"}
              onClick={() => setPeriodo(p)}
            >
              {periodLabels[p]}
            </Button>
          ))}
        </div>
      </div>

      <ComboWidget compact />

      {/* Atalhos rápidos */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <ShortcutCard
          icon={<Zap className="h-5 w-5 text-primary" />}
          title="Novo Pedido"
          subtitle="Atendimento rápido B2B"
          to="/atacado/novo-pedido"
        />
        <ShortcutCard
          icon={<Plus className="h-5 w-5 text-primary" />}
          title="Cadastrar Cliente"
          subtitle="Novo lojista B2B"
          to="/atacado/clientes"
        />
        <ShortcutCard
          icon={<Wallet className="h-5 w-5 text-primary" />}
          title="Cobrança"
          subtitle={
            boletos > 0
              ? `${boletos} boleto${boletos > 1 ? "s" : ""} vencido${boletos > 1 ? "s" : ""}`
              : "Nenhum atraso"
          }
          to="/atacado/cobranca"
          highlight={boletos > 0}
        />
      </div>

      {/* KPIs principais */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Kpi
          label="Faturamento"
          valor={formatBRL(fat)}
          icon={<TrendingUp className="h-4 w-4" />}
          loading={kpisLoading}
        />
        <Kpi
          label="Pedidos"
          valor={qtd.toString()}
          icon={<ClipboardList className="h-4 w-4" />}
          loading={kpisLoading}
        />
        <Kpi
          label="Ticket Médio"
          valor={formatBRL(ticket)}
          icon={<DollarSign className="h-4 w-4" />}
          loading={kpisLoading}
        />
        <Kpi
          label="Inadimplência"
          valor={formatBRL(inadimplencia)}
          icon={<AlertTriangle className="h-4 w-4" />}
          danger={inadimplencia > 0}
          loading={kpisLoading}
        />
      </div>

      {/* Alertas operacionais */}
      {(aguardando > 0 || boletos > 0) && (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-4 space-y-3">
          <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400">
            <AlertTriangle className="h-4 w-4" />
            <h3 className="text-sm font-semibold">Alertas operacionais</h3>
          </div>
          <div className="space-y-2">
            {aguardando > 0 && (
              <Link
                to="/atacado/pedidos?status=aguardando_aprovacao"
                className="flex items-center justify-between gap-3 rounded-md bg-background/60 hover:bg-background px-3 py-2 text-sm transition-colors"
              >
                <span className="flex items-center gap-2 text-foreground">
                  <Badge variant="secondary">{aguardando}</Badge>
                  pedido{aguardando > 1 ? "s" : ""} aguardando aprovação
                </span>
                <ArrowRight className="h-4 w-4 text-muted-foreground" />
              </Link>
            )}
            {boletos > 0 && (
              <Link
                to="/atacado/cobranca"
                className="flex items-center justify-between gap-3 rounded-md bg-background/60 hover:bg-background px-3 py-2 text-sm transition-colors"
              >
                <span className="flex items-center gap-2 text-foreground">
                  <Badge variant="destructive">{boletos}</Badge>
                  boleto{boletos > 1 ? "s" : ""} vencido{boletos > 1 ? "s" : ""} —{" "}
                  {formatBRL(inadimplencia)} em atraso
                </span>
                <ArrowRight className="h-4 w-4 text-muted-foreground" />
              </Link>
            )}
          </div>
        </div>
      )}

      {/* Top 5 Clientes */}
      <div className="rounded-lg border border-border bg-card p-4 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <Trophy className="h-4 w-4 text-amber-500" />
            Top 5 Clientes do mês
          </h3>
          <Button asChild variant="ghost" size="sm">
            <Link to="/atacado/clientes">
              Ver todos <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        </div>

        {topClientes.length === 0 ? (
          <div className="text-center py-8 space-y-3">
            <Users className="h-8 w-8 text-muted-foreground mx-auto" />
            <p className="text-sm text-muted-foreground">
              {semDados
                ? "Nenhum cliente B2B cadastrado ainda. Cadastre o primeiro pra começar."
                : "Sem pedidos no período selecionado."}
            </p>
            {semDados && (
              <Button asChild size="sm">
                <Link to="/atacado/clientes">
                  <Plus className="h-4 w-4" /> Cadastrar cliente
                </Link>
              </Button>
            )}
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {topClientes.map((c: any, i: number) => {
              const medal = i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `#${i + 1}`;
              return (
                <li
                  key={c.cliente_id}
                  className="flex items-center justify-between py-2.5"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="text-lg w-6 text-center shrink-0">{medal}</span>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">
                        {c.nome_fantasia || c.razao_social}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {c.qtd_pedidos} pedido{Number(c.qtd_pedidos) > 1 ? "s" : ""}
                      </p>
                    </div>
                  </div>
                  <span className="text-sm font-semibold text-foreground tabular-nums">
                    {formatBRL(Number(c.faturamento))}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* Stats de clientes (rodapé) */}
      {clientesAtivos > 0 && (
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <Badge variant="outline">{clientesAtivos} clientes ativos</Badge>
          {novosClientes > 0 && (
            <Badge variant="outline" className="text-primary border-primary/30">
              +{novosClientes} novo{novosClientes > 1 ? "s" : ""} no mês
            </Badge>
          )}
          {clientesBloqueados > 0 && (
            <Badge variant="outline" className="text-destructive border-destructive/30">
              {clientesBloqueados} bloqueado{clientesBloqueados > 1 ? "s" : ""}
            </Badge>
          )}
        </div>
      )}
    </div>
  );
}

function ShortcutCard({
  icon,
  title,
  subtitle,
  to,
  highlight,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  to: string;
  highlight?: boolean;
}) {
  return (
    <Link
      to={to}
      className={cn(
        "rounded-lg border bg-card p-4 hover:border-primary/50 hover:shadow-sm transition-all group",
        highlight ? "border-amber-500/40" : "border-border"
      )}
    >
      <div className="flex items-center gap-2 mb-1">
        {icon}
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
      </div>
      <p className="text-xs text-muted-foreground">{subtitle}</p>
      <span className="mt-2 inline-flex items-center text-xs text-primary group-hover:gap-1.5 gap-1 transition-all">
        Abrir <ArrowRight className="h-3 w-3" />
      </span>
    </Link>
  );
}

function Kpi({
  label,
  valor,
  icon,
  loading,
  danger,
}: {
  label: string;
  valor: string;
  icon: React.ReactNode;
  loading?: boolean;
  danger?: boolean;
}) {
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1.5">
        {icon}
        {label}
      </div>
      <div
        className={cn(
          "text-xl font-bold tabular-nums",
          danger ? "text-destructive" : "text-foreground"
        )}
      >
        {loading ? <span className="text-muted-foreground">—</span> : valor}
      </div>
    </div>
  );
}
