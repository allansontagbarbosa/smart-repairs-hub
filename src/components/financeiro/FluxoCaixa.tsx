import { useState, useMemo } from "react";
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import { TrendingUp, TrendingDown, ArrowUpDown, BarChart3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  startOfDay, endOfDay, subDays, differenceInCalendarWeeks,
  startOfWeek, endOfWeek, format, isWithinInterval,
} from "date-fns";
import { ptBR } from "date-fns/locale";
import type { ContaPagar, Comissao } from "@/hooks/useFinanceiro";
import type { Recebimento } from "./Recebimentos";

const fmtCurrency = (v: number) =>
  `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;

type OrdemFinanceiro = {
  id: string;
  numero: number;
  valor: number | null;
  custo_pecas: number | null;
  status: string;
  data_entrada: string;
};

interface Props {
  contas: ContaPagar[];
  comissoes: Comissao[];
  recebimentos: Recebimento[];
  ordens: OrdemFinanceiro[];
}

const PERIODS = [
  { label: "7 dias", days: 7 },
  { label: "30 dias", days: 30 },
  { label: "90 dias", days: 90 },
] as const;

export function FluxoCaixa({ contas, comissoes, recebimentos, ordens }: Props) {
  const [days, setDays] = useState<number>(30);

  const { chartData, totalEntradas, totalSaidas, saldo, mediaSemanal } = useMemo(() => {
    const now = new Date();
    const periodStart = startOfDay(subDays(now, days));
    const periodEnd = endOfDay(now);

    // Group by week
    const weekCount = Math.max(1, differenceInCalendarWeeks(periodEnd, periodStart, { locale: ptBR }) + 1);

    const weeks: { start: Date; end: Date; label: string }[] = [];
    for (let i = 0; i < weekCount; i++) {
      const ws = i === 0 ? periodStart : startOfWeek(subDays(now, days - i * 7), { locale: ptBR });
      const actualStart = i === 0 ? periodStart : ws;
      const actualEnd = i === weekCount - 1 ? periodEnd : endOfWeek(actualStart, { locale: ptBR });
      weeks.push({
        start: actualStart,
        end: actualEnd,
        label: `${format(actualStart, "dd/MM")}`,
      });
    }

    // Deduplicate overlapping weeks
    const dedupedWeeks: typeof weeks = [];
    for (let i = 0; i < weekCount; i++) {
      const ws = startOfWeek(subDays(now, days - (days / weekCount) * i), { locale: ptBR });
      const we = endOfWeek(ws, { locale: ptBR });
      const clampedStart = ws < periodStart ? periodStart : ws;
      const clampedEnd = we > periodEnd ? periodEnd : we;
      if (clampedStart <= clampedEnd) {
        const label = `${format(clampedStart, "dd/MM")}`;
        // Avoid duplicates
        if (!dedupedWeeks.find(w => w.label === label)) {
          dedupedWeeks.push({ start: clampedStart, end: clampedEnd, label });
        }
      }
    }

    // Simpler approach: generate weeks from periodStart
    const finalWeeks: { start: Date; end: Date; label: string }[] = [];
    let cursor = periodStart;
    let weekIdx = 1;
    while (cursor <= periodEnd) {
      const weekEnd = endOfWeek(cursor, { locale: ptBR });
      const clampedEnd = weekEnd > periodEnd ? periodEnd : weekEnd;
      finalWeeks.push({
        start: cursor,
        end: clampedEnd,
        label: days <= 7 ? format(cursor, "EEE", { locale: ptBR }) : `Sem ${weekIdx}`,
      });
      cursor = startOfDay(new Date(clampedEnd.getTime() + 86400000));
      weekIdx++;
    }

    const inRange = (dateStr: string, ws: Date, we: Date) => {
      const d = new Date(dateStr.includes("T") ? dateStr : dateStr + "T12:00:00");
      return isWithinInterval(d, { start: ws, end: we });
    };

    let acumulado = 0;
    let totalEnt = 0;
    let totalSai = 0;

    const data = finalWeeks.map(w => {
      // Entradas: recebimentos + OS entregues
      const recebimentosSemana = recebimentos
        .filter(r => inRange(r.data_recebimento, w.start, w.end))
        .reduce((s, r) => s + Number(r.valor), 0);

      const osEntregues = ordens
        .filter(o => o.status === "entregue" && inRange(o.data_entrada, w.start, w.end))
        .reduce((s, o) => s + Number(o.valor ?? 0), 0);

      const entradas = recebimentosSemana + osEntregues;

      // Saídas: contas pagas + comissões pagas
      const contasPagas = contas
        .filter(c => c.status === "paga" && c.data_pagamento && inRange(c.data_pagamento, w.start, w.end))
        .reduce((s, c) => s + Number(c.valor), 0);

      const comissoesPagas = comissoes
        .filter(c => c.status === "paga" && c.data_pagamento && inRange(c.data_pagamento, w.start, w.end))
        .reduce((s, c) => s + Number(c.valor), 0);

      const saidas = contasPagas + comissoesPagas;

      acumulado += entradas - saidas;
      totalEnt += entradas;
      totalSai += saidas;

      return {
        name: w.label,
        entradas,
        saidas,
        saldo: acumulado,
      };
    });

    return {
      chartData: data,
      totalEntradas: totalEnt,
      totalSaidas: totalSai,
      saldo: totalEnt - totalSai,
      mediaSemanal: finalWeeks.length > 0 ? (totalEnt - totalSai) / finalWeeks.length : 0,
    };
  }, [contas, comissoes, recebimentos, ordens, days]);

  return (
    <div className="space-y-5">
      {/* Period filter */}
      <div className="flex gap-2">
        {PERIODS.map(p => (
          <Button
            key={p.days}
            variant={days === p.days ? "default" : "outline"}
            size="sm"
            onClick={() => setDays(p.days)}
          >
            {p.label}
          </Button>
        ))}
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className={`stat-card ${saldo >= 0 ? "border-success/20 bg-success-muted" : "border-destructive/20 bg-destructive/5"}`}>
          <ArrowUpDown className={`h-4 w-4 mb-3 ${saldo >= 0 ? "text-success" : "text-destructive"}`} />
          <p className={`stat-value ${saldo >= 0 ? "text-success" : "text-destructive"}`}>{fmtCurrency(saldo)}</p>
          <p className="stat-label">Saldo do período</p>
        </div>
        <div className="stat-card border-success/20 bg-success-muted">
          <TrendingUp className="h-4 w-4 text-success mb-3" />
          <p className="stat-value text-success">{fmtCurrency(totalEntradas)}</p>
          <p className="stat-label">Total entradas</p>
        </div>
        <div className="stat-card border-destructive/20 bg-destructive/5">
          <TrendingDown className="h-4 w-4 text-destructive mb-3" />
          <p className="stat-value text-destructive">{fmtCurrency(totalSaidas)}</p>
          <p className="stat-label">Total saídas</p>
        </div>
        <div className="stat-card">
          <BarChart3 className="h-4 w-4 text-muted-foreground mb-3" />
          <p className={`stat-value ${mediaSemanal >= 0 ? "text-success" : "text-destructive"}`}>{fmtCurrency(mediaSemanal)}</p>
          <p className="stat-label">Média semanal</p>
        </div>
      </div>

      {/* Chart */}
      <div className="section-card">
        <div className="section-header">
          <h3 className="section-title">Fluxo de Caixa — Últimos {days} dias</h3>
        </div>
        <div className="p-4 h-80">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
              <defs>
                <linearGradient id="gradEntradas" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(var(--success))" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="hsl(var(--success))" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="gradSaidas" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(var(--destructive))" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="hsl(var(--destructive))" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `${(v / 1000).toFixed(0)}k`} />
              <Tooltip
                formatter={(value: number, name: string) => {
                  const labels: Record<string, string> = { entradas: "Entradas", saidas: "Saídas", saldo: "Saldo acumulado" };
                  return [fmtCurrency(value), labels[name] ?? name];
                }}
                contentStyle={{ fontSize: 12, borderRadius: 8 }}
              />
              <Legend
                formatter={(value: string) => {
                  const labels: Record<string, string> = { entradas: "Entradas", saidas: "Saídas", saldo: "Saldo acumulado" };
                  return labels[value] ?? value;
                }}
              />
              <Area
                type="monotone"
                dataKey="entradas"
                stroke="hsl(var(--success))"
                strokeWidth={2}
                fill="url(#gradEntradas)"
              />
              <Area
                type="monotone"
                dataKey="saidas"
                stroke="hsl(var(--destructive))"
                strokeWidth={2}
                fill="url(#gradSaidas)"
              />
              <Area
                type="monotone"
                dataKey="saldo"
                stroke="hsl(var(--info))"
                strokeWidth={2}
                strokeDasharray="5 5"
                fill="none"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
