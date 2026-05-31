import { Download, Calendar, Zap, LayoutDashboard } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useEmpresa } from "@/contexts/EmpresaContext";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { formatBRL } from "@/lib/utils";
import { Link } from "react-router-dom";
import { ComboWidget } from "@/components/ComboWidget";

export default function LojaDashboard() {
  const { empresaId } = useEmpresa();
  const hoje = new Date();
  const inicio = new Date(hoje.getFullYear(), hoje.getMonth(), 1).toISOString().slice(0, 10);
  const fim = hoje.toISOString().slice(0, 10);

  const { data: kpis, isLoading } = useQuery({
    queryKey: ["loja-dashboard-kpis", empresaId, inicio, fim],
    queryFn: async () => {
      const { data, error } = await (supabase.rpc as any)("loja_dashboard_kpis", {
        p_empresa_id: empresaId,
        p_inicio: inicio,
        p_fim: fim,
      });
      if (error) throw error;
      return (data as any[])?.[0] ?? null;
    },
    enabled: !!empresaId,
  });

  const semDados = !isLoading && (!kpis || Number(kpis?.vendas_qtd ?? 0) === 0);

  return (
    <div className="container mx-auto px-4 py-6 sm:py-8 max-w-7xl">
      <div className="mb-8 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Dashboard Loja</h1>
          <p className="text-sm text-muted-foreground mt-1 capitalize">
            {new Date().toLocaleDateString("pt-BR", { month: "long", year: "numeric" })} · operação de varejo
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm"><Download className="h-4 w-4 mr-2" /> Exportar</Button>
          <Button variant="outline" size="sm"><Calendar className="h-4 w-4 mr-2" /> Período</Button>
          <Button asChild size="sm">
            <Link to="/loja/pdv"><Zap className="h-4 w-4 mr-2" /> Nova venda (F1)</Link>
          </Button>
        </div>
      </div>

      <ComboWidget compact />

      {semDados && (
        <div className="rounded-xl border border-dashed border-border bg-card/50 p-12 flex flex-col items-center justify-center text-center">
          <div className="h-14 w-14 rounded-2xl bg-primary/10 text-primary flex items-center justify-center mb-4">
            <LayoutDashboard className="h-7 w-7" />
          </div>
          <h2 className="text-lg font-semibold mb-2">Nenhuma venda registrada ainda</h2>
          <p className="text-sm text-muted-foreground max-w-md mb-6">
            Quando você fizer a primeira venda no PDV, os KPIs, gráficos e ranking de vendedores aparecem aqui.
          </p>
          <Button asChild>
            <Link to="/loja/pdv"><Zap className="h-4 w-4 mr-2" /> Fazer primeira venda</Link>
          </Button>
        </div>
      )}

      {!semDados && kpis && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiCard label="Faturamento" value={formatBRL(Number(kpis.faturamento ?? 0))} featured />
          <KpiCard label="Lucro líquido" value={formatBRL(Number(kpis.lucro ?? 0))} />
          <KpiCard label="Vendas" value={String(kpis.vendas_qtd ?? 0)} hint="no período" />
          <KpiCard label="Ticket médio" value={formatBRL(Number(kpis.ticket_medio ?? 0))} />
        </div>
      )}
    </div>
  );
}

function KpiCard({ label, value, hint, featured }: { label: string; value: string; hint?: string; featured?: boolean }) {
  return (
    <div className={`rounded-xl border p-4 ${featured ? "bg-primary/5 border-primary/30" : "bg-card border-border"}`}>
      <p className="text-xs uppercase tracking-wide text-muted-foreground font-semibold">{label}</p>
      <p className="text-2xl font-bold mt-2 tabular-nums">{value}</p>
      {hint && <p className="text-xs text-muted-foreground mt-1">{hint}</p>}
    </div>
  );
}
