import { Download, Calendar, Store, Wrench, Zap, TrendingUp, TrendingDown, ArrowRight, ShoppingBag, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useEmpresa } from "@/contexts/EmpresaContext";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { formatBRL } from "@/lib/utils";
import { Link } from "react-router-dom";
import {
  XAxis, YAxis, Tooltip, ResponsiveContainer, Legend, CartesianGrid, Area, AreaChart,
} from "recharts";

export default function ComboDashboard() {
  const { empresaId } = useEmpresa();
  const hoje = new Date();
  const inicio = new Date(hoje.getFullYear(), hoje.getMonth(), 1).toISOString().slice(0, 10);
  const fim = hoje.toISOString().slice(0, 10);

  const { data: kpis } = useQuery({
    queryKey: ["combo-dashboard-kpis", empresaId, inicio, fim],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("combo_dashboard_kpis", {
        p_empresa_id: empresaId!, p_inicio: inicio, p_fim: fim,
      });
      if (error) throw error;
      return data?.[0] ?? null;
    },
    enabled: !!empresaId,
  });

  const { data: serie = [] } = useQuery({
    queryKey: ["combo-serie", empresaId, inicio, fim],
    queryFn: async () => {
      const { data, error } = await (supabase as any).rpc("combo_serie_diaria", {
        p_empresa_id: empresaId!, p_inicio: inicio, p_fim: fim,
      });
      if (error) throw error;
      return (data ?? []).map((d: any) => ({
        dia: new Date(d.dia).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }),
        Loja: Number(d.faturamento_loja),
        Assistência: Number(d.faturamento_assist),
        total: Number(d.total),
      }));
    },
    enabled: !!empresaId,
  });

  const fatLoja = Number(kpis?.faturamento_loja ?? 0);
  const fatAssist = Number(kpis?.faturamento_assist ?? 0);
  const fatAtacado = Number(kpis?.faturamento_atacado ?? 0);
  const total = fatLoja + fatAssist + fatAtacado;
  const pctLoja = total > 0 ? (fatLoja / total) * 100 : 0;
  const pctAssist = total > 0 ? (fatAssist / total) * 100 : 0;
  const varLoja = 0;
  const varAssist = 0;
  const qtdOs = Number(kpis?.qtd_os ?? 0);
  const qtdVendasLoja = Number(kpis?.qtd_vendas_loja ?? 0);
  const qtdPedidosAtacado = Number(kpis?.qtd_pedidos_atacado ?? 0);
  const transacoesTotal = qtdOs + qtdVendasLoja + qtdPedidosAtacado;
  const ticketMedio = Number(kpis?.ticket_medio_consolidado ?? 0);

  return (
    <div className="container mx-auto px-4 py-6 sm:py-8 max-w-7xl space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="text-xs uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
            <Sparkles className="h-3 w-3" />
            Dashboard Combo
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight mt-1">Operação unificada</h1>
          <p className="text-sm text-muted-foreground mt-1 capitalize">
            Loja + Assistência · {hoje.toLocaleDateString("pt-BR", { month: "long", year: "numeric" })}
          </p>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline"><Calendar className="h-3.5 w-3.5 mr-1.5" /> Período</Button>
          <Button size="sm" variant="outline"><Download className="h-3.5 w-3.5 mr-1.5" /> Exportar</Button>
        </div>
      </div>

      {/* Faturamento principal */}
      <div className="rounded-2xl bg-gradient-to-br from-primary to-primary/70 text-primary-foreground p-6 space-y-5">
        <div>
          <div className="text-xs uppercase tracking-wider opacity-80">Faturamento total do mês</div>
          <div className="text-4xl md:text-5xl font-bold mt-2">{formatBRL(total)}</div>
          <div className="text-xs opacity-80 mt-1">{transacoesTotal} transações totais</div>
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          <Quebra icon={<Store className="h-4 w-4" />} label="Loja (varejo)" valor={fatLoja} pct={pctLoja}
            qtdLabel={`${qtdVendasLoja} vendas`} variacao={varLoja} />
          <Quebra icon={<Wrench className="h-4 w-4" />} label="Assistência técnica" valor={fatAssist} pct={pctAssist}
            qtdLabel={`${qtdOs} OSs`} variacao={varAssist} />
        </div>
      </div>

      {/* KPIs secundários */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiMini label="Ticket médio consolidado" valor={formatBRL(ticketMedio)} />
        <KpiMini label="Faturamento Atacado" valor={formatBRL(fatAtacado)} />
        <KpiMini label="Vendas Loja" valor={String(qtdVendasLoja)} />
        <KpiMini label="OSs concluídas" valor={String(qtdOs)} />
      </div>

      {/* Gráfico */}
      <div className="rounded-xl border bg-card p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold">Evolução diária do mês</h2>
          <div className="flex items-center gap-3 text-xs">
            <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-primary" /> Loja</span>
            <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-info" /> Assistência</span>
          </div>
        </div>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={serie}>
              <defs>
                <linearGradient id="gradLoja" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.7} />
                  <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0.05} />
                </linearGradient>
                <linearGradient id="gradAssist" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(var(--info))" stopOpacity={0.7} />
                  <stop offset="95%" stopColor="hsl(var(--info))" stopOpacity={0.05} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="dia" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
              <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} tickFormatter={(v) => `R$ ${(v / 1000).toFixed(0)}k`} />
              <Tooltip
                contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }}
                formatter={(v: any) => formatBRL(Number(v))}
              />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Area type="monotone" dataKey="Loja" stackId="1" stroke="hsl(var(--primary))" fill="url(#gradLoja)" />
              <Area type="monotone" dataKey="Assistência" stackId="1" stroke="hsl(var(--info))" fill="url(#gradAssist)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Atalhos */}
      <div className="grid sm:grid-cols-3 gap-4">
        <Atalho to="/loja/pdv" icon={<Zap className="h-5 w-5" />} title="Nova venda (Loja)" desc="Abrir PDV — F1" />
        <Atalho to="/assistencia/nova" icon={<Wrench className="h-5 w-5" />} title="Nova OS (Assistência)" desc="Abrir fluxo de assistência" />
        <Atalho to="/combo/painel-socio" icon={<ShoppingBag className="h-5 w-5" />} title="Painel Sócio Combo" desc="Visão executiva unificada" />
      </div>
    </div>
  );
}

function KpiMini({ label, valor }: { label: string; valor: string }) {
  return (
    <div className="rounded-xl border bg-card p-4">
      <div className="text-xs text-muted-foreground uppercase tracking-wider">{label}</div>
      <div className="text-xl font-bold mt-1">{valor}</div>
    </div>
  );
}

function Quebra({
  icon, label, valor, pct, qtdLabel, variacao,
}: {
  icon: React.ReactNode; label: string; valor: number; pct: number; qtdLabel: string; variacao: number;
}) {
  const subiu = variacao > 0;
  return (
    <div className="rounded-lg bg-white/10 backdrop-blur p-4 space-y-2">
      <div className="flex items-center justify-between text-sm flex-wrap gap-2">
        <span className="flex items-center gap-2">
          {icon}
          <span className="font-medium">{label}</span>
          <span className="opacity-75 text-xs">· {qtdLabel}</span>
        </span>
        {variacao !== 0 && (
          <span className={`text-[11px] flex items-center gap-0.5 px-1.5 py-0.5 rounded ${subiu ? "bg-white/20" : "bg-destructive/30"}`}>
            {subiu ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
            {Math.abs(variacao).toFixed(1)}% vs mês anterior
          </span>
        )}
      </div>
      <div className="flex items-baseline justify-between">
        <div className="text-2xl font-bold">{formatBRL(valor)}</div>
        <div className="text-xs opacity-90">{pct.toFixed(1)}%</div>
      </div>
      <div className="h-1.5 w-full rounded-full bg-white/20 overflow-hidden">
        <div className="h-full bg-primary-foreground transition-all" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function Atalho({ to, icon, title, desc }: { to: string; icon: React.ReactNode; title: string; desc: string }) {
  return (
    <Link to={to} className="group rounded-xl border bg-card hover:bg-muted/40 hover:border-primary/40 transition-colors p-5 flex items-center gap-4">
      <div className="h-11 w-11 rounded-xl bg-primary/10 text-primary flex items-center justify-center">{icon}</div>
      <div className="flex-1 min-w-0">
        <div className="font-semibold">{title}</div>
        <div className="text-xs text-muted-foreground mt-0.5">{desc}</div>
      </div>
      <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
    </Link>
  );
}
