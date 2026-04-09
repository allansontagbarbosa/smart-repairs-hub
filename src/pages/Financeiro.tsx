import { useMemo, useState } from "react";
import { TrendingUp, TrendingDown, DollarSign, ArrowUpRight, ArrowDownRight, Loader2, ChevronLeft, ChevronRight } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { OrdemDetalheSheet } from "@/components/OrdemDetalheSheet";

const fmtCurrency = (v: number) => `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;
const fmtDate = (d: string) => new Date(d).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
const monthLabel = (y: number, m: number) => {
  const d = new Date(y, m);
  return d.toLocaleDateString("pt-BR", { month: "long", year: "numeric" }).replace(/^\w/, c => c.toUpperCase());
};

async function fetchOrdens() {
  const { data, error } = await supabase
    .from("ordens_de_servico")
    .select("id, numero, valor, custo_pecas, status, data_entrada, data_entrega, aparelhos ( marca, modelo, clientes ( nome ) )")
    .order("data_entrada", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

async function fetchMovimentacoes() {
  const { data, error } = await supabase
    .from("movimentacoes_financeiras")
    .select("*")
    .order("data", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export default function Financeiro() {
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth());
  const [year, setYear] = useState(now.getFullYear());
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);

  const { data: ordens = [], isLoading: l1 } = useQuery({ queryKey: ["ordens-fin"], queryFn: fetchOrdens });
  const { data: movs = [], isLoading: l2 } = useQuery({ queryKey: ["movimentacoes"], queryFn: fetchMovimentacoes });

  const isLoading = l1 || l2;

  // Orders for selected month (by data_entrada)
  const ordensMes = useMemo(() => ordens.filter(o => {
    const d = new Date(o.data_entrada);
    return d.getMonth() === month && d.getFullYear() === year;
  }), [ordens, month, year]);

  // Movimentações for selected month
  const movsMes = useMemo(() => movs.filter(m => {
    const d = new Date(m.data);
    return d.getMonth() === month && d.getFullYear() === year;
  }), [movs, month, year]);

  // KPIs from OS
  const receitaOS = useMemo(() => ordensMes.reduce((s, o) => s + Number(o.valor ?? 0), 0), [ordensMes]);
  const custoOS = useMemo(() => ordensMes.reduce((s, o) => s + Number(o.custo_pecas ?? 0), 0), [ordensMes]);
  const lucroOS = receitaOS - custoOS;
  const margem = receitaOS > 0 ? ((lucroOS / receitaOS) * 100).toFixed(0) : "0";

  // Extra costs from movimentações (saidas not linked to OS)
  const outrasEntradas = useMemo(() => movsMes.filter(m => m.tipo === "entrada").reduce((s, m) => s + Number(m.valor), 0), [movsMes]);
  const outrasSaidas = useMemo(() => movsMes.filter(m => m.tipo === "saida" && !m.ordem_id).reduce((s, m) => s + Number(m.valor), 0), [movsMes]);

  // Monthly summary (last 6 months)
  const resumoMensal = useMemo(() => {
    const months: { label: string; receita: number; custo: number; lucro: number }[] = [];
    for (let i = 0; i < 6; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const m = d.getMonth();
      const y = d.getFullYear();
      const ordM = ordens.filter(o => {
        const od = new Date(o.data_entrada);
        return od.getMonth() === m && od.getFullYear() === y;
      });
      const rec = ordM.reduce((s, o) => s + Number(o.valor ?? 0), 0);
      const cst = ordM.reduce((s, o) => s + Number(o.custo_pecas ?? 0), 0);
      months.push({ label: monthLabel(y, m), receita: rec, custo: cst, lucro: rec - cst });
    }
    return months;
  }, [ordens]);

  const prevMonth = () => {
    if (month === 0) { setMonth(11); setYear(y => y - 1); }
    else setMonth(m => m - 1);
  };
  const nextMonth = () => {
    if (month === 11) { setMonth(0); setYear(y => y + 1); }
    else setMonth(m => m + 1);
  };

  if (isLoading) {
    return <div className="flex justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div className="space-y-5 md:space-y-6">
      <div className="page-header">
        <h1 className="page-title">Financeiro</h1>
        <p className="page-subtitle">Receitas, custos e lucro por ordem de serviço</p>
      </div>

      {/* Month navigation */}
      <div className="flex items-center justify-center gap-3">
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={prevMonth}><ChevronLeft className="h-4 w-4" /></Button>
        <span className="text-sm font-medium w-40 text-center">{monthLabel(year, month)}</span>
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={nextMonth}><ChevronRight className="h-4 w-4" /></Button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="stat-card">
          <TrendingUp className="h-4 w-4 text-success mb-3" />
          <p className="stat-value">{fmtCurrency(receitaOS + outrasEntradas)}</p>
          <p className="stat-label">Receita total</p>
        </div>
        <div className="stat-card">
          <TrendingDown className="h-4 w-4 text-destructive mb-3" />
          <p className="stat-value">{fmtCurrency(custoOS + outrasSaidas)}</p>
          <p className="stat-label">Custos totais</p>
        </div>
        <div className="stat-card border-success/20 bg-success-muted">
          <DollarSign className="h-4 w-4 text-success mb-3" />
          <p className="stat-value text-success">{fmtCurrency(lucroOS + outrasEntradas - outrasSaidas)}</p>
          <p className="stat-label">Lucro líquido · Margem {margem}%</p>
        </div>
      </div>

      {/* OS Profit breakdown */}
      <div className="section-card">
        <div className="section-header">
          <h2 className="section-title">Lucro por Ordem de Serviço</h2>
          <span className="text-xs text-muted-foreground">{ordensMes.length} ordens</span>
        </div>
        {ordensMes.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">Nenhuma ordem neste mês</p>
        ) : (
          <div className="divide-y">
            {ordensMes.map(o => {
              const valor = Number(o.valor ?? 0);
              const custo = Number(o.custo_pecas ?? 0);
              const lucro = valor - custo;
              const aparelho = `${o.aparelhos?.marca ?? ""} ${o.aparelhos?.modelo ?? ""}`.trim();
              const cliente = o.aparelhos?.clientes?.nome ?? "";
              return (
                <button
                  key={o.id}
                  onClick={() => setSelectedOrderId(o.id)}
                  className="flex items-center justify-between w-full px-5 py-3 hover:bg-muted/30 transition-colors text-left"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`flex items-center justify-center h-7 w-7 rounded-full shrink-0 ${lucro >= 0 ? "bg-success-muted" : "bg-destructive/10"}`}>
                      {lucro >= 0 ? <ArrowUpRight className="h-3.5 w-3.5 text-success" /> : <ArrowDownRight className="h-3.5 w-3.5 text-destructive" />}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">
                        OS #{String(o.numero).padStart(3, "0")} — {aparelho}
                      </p>
                      <p className="text-xs text-muted-foreground">{cliente} · {fmtDate(o.data_entrada)}</p>
                    </div>
                  </div>
                  <div className="text-right ml-4 shrink-0">
                    <p className={`text-sm font-semibold ${lucro >= 0 ? "text-success" : "text-destructive"}`}>
                      {lucro >= 0 ? "+" : ""}{fmtCurrency(lucro)}
                    </p>
                    <p className="text-xs text-muted-foreground">{fmtCurrency(valor)} − {fmtCurrency(custo)}</p>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Monthly summary */}
      <div className="section-card">
        <div className="section-header">
          <h2 className="section-title">Resumo Mensal</h2>
        </div>
        <div className="divide-y">
          {resumoMensal.map(m => (
            <div key={m.label} className="flex items-center justify-between px-5 py-3">
              <span className="text-sm font-medium">{m.label}</span>
              <div className="flex items-center gap-5 text-sm">
                <span className="text-muted-foreground hidden sm:inline">{fmtCurrency(m.receita)}</span>
                <span className="text-muted-foreground hidden sm:inline">− {fmtCurrency(m.custo)}</span>
                <span className={`font-semibold ${m.lucro >= 0 ? "text-success" : "text-destructive"}`}>{fmtCurrency(m.lucro)}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      <OrdemDetalheSheet orderId={selectedOrderId} onClose={() => setSelectedOrderId(null)} />
    </div>
  );
}
