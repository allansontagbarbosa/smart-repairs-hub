import { useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { AlertTriangle, Clock, CheckCircle2, Wallet, DollarSign } from "lucide-react";

interface ContaItem {
  id: string;
  valor: number | string;
  status: string;
  categoria?: string | null;
  data_vencimento: string | null;
  data_pagamento?: string | null;
}

interface Props {
  contas: ContaItem[];
}

const fmt = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const CATEGORIA_CORES: Record<string, string> = {
  "Salários": "bg-blue-500",
  "Vale Transporte": "bg-cyan-500",
  "Vale Alimentação": "bg-teal-500",
  "Aluguel": "bg-purple-500",
  "Comissões": "bg-pink-500",
  "Energia": "bg-yellow-500",
  "Internet": "bg-indigo-500",
  "Impostos": "bg-red-500",
  "Outros": "bg-gray-500",
};

export function ContasDashboard({ contas }: Props) {
  const stats = useMemo(() => {
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    const em7dias = new Date(hoje);
    em7dias.setDate(hoje.getDate() + 7);

    let totalAtrasadas = 0, qtdAtrasadas = 0;
    let totalEstaSemana = 0, qtdEstaSemana = 0;
    let totalPagas = 0, qtdPagas = 0;
    let totalPendente = 0, qtdPendente = 0;
    const porCategoria: Record<string, number> = {};

    contas.forEach((c) => {
      const valor = typeof c.valor === "string" ? parseFloat(c.valor) : c.valor;
      if (isNaN(valor)) return;

      const venc = c.data_vencimento ? new Date(c.data_vencimento + "T00:00:00") : null;
      const isPaga = c.status === "paga";
      const isVencida = venc && venc < hoje && !isPaga;
      const isEstaSemana = venc && venc >= hoje && venc <= em7dias && !isPaga;

      if (isPaga) {
        totalPagas += valor;
        qtdPagas++;
      } else {
        totalPendente += valor;
        qtdPendente++;
        if (isVencida) {
          totalAtrasadas += valor;
          qtdAtrasadas++;
        } else if (isEstaSemana) {
          totalEstaSemana += valor;
          qtdEstaSemana++;
        }
      }

      const cat = c.categoria || "Outros";
      porCategoria[cat] = (porCategoria[cat] || 0) + valor;
    });

    const totalGeral = Object.values(porCategoria).reduce((s, v) => s + v, 0);
    const categoriasOrdenadas = Object.entries(porCategoria)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6);

    return {
      totalAtrasadas, qtdAtrasadas,
      totalEstaSemana, qtdEstaSemana,
      totalPagas, qtdPagas,
      totalPendente, qtdPendente,
      qtdTotal: contas.length,
      categoriasOrdenadas,
      totalGeral,
    };
  }, [contas]);

  const kpis = [
    {
      label: "Atrasadas",
      icon: AlertTriangle,
      iconClass: "text-destructive",
      valor: stats.totalAtrasadas,
      qtd: stats.qtdAtrasadas,
      valorClass: "text-destructive",
    },
    {
      label: "Esta semana",
      icon: Clock,
      iconClass: "text-warning",
      valor: stats.totalEstaSemana,
      qtd: stats.qtdEstaSemana,
      valorClass: "text-warning",
    },
    {
      label: "Pagas no período",
      icon: CheckCircle2,
      iconClass: "text-success",
      valor: stats.totalPagas,
      qtd: stats.qtdPagas,
      valorClass: "text-success",
    },
    {
      label: "Total pendente",
      icon: Wallet,
      iconClass: "text-muted-foreground",
      valor: stats.totalPendente,
      qtd: stats.qtdPendente,
      valorClass: "text-foreground",
    },
  ];

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        {kpis.map((k) => {
          const Icon = k.icon;
          return (
            <Card key={k.label}>
              <CardContent className="p-3">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[11px] uppercase tracking-wide font-semibold text-muted-foreground">
                    {k.label}
                  </span>
                  <Icon className={`h-4 w-4 ${k.iconClass}`} />
                </div>
                <div className={`text-lg font-bold tabular-nums ${k.valorClass}`}>
                  {fmt(k.valor)}
                </div>
                <div className="text-[11px] text-muted-foreground">
                  {k.qtd} conta{k.qtd !== 1 ? "s" : ""}
                </div>
              </CardContent>
            </Card>
          );
        })}
        <Card className="border-l-4 border-l-foreground bg-foreground/5">
          <CardContent className="p-3">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[11px] uppercase tracking-wide font-semibold text-muted-foreground">
                Total do período
              </span>
              <DollarSign className="h-4 w-4 text-foreground" />
            </div>
            <div className="text-lg font-bold tabular-nums text-foreground">
              {fmt(stats.totalGeral)}
            </div>
            <div className="text-[11px] text-muted-foreground">
              {stats.qtdTotal} conta{stats.qtdTotal !== 1 ? "s" : ""} no total
            </div>
          </CardContent>
        </Card>
      </div>

      {stats.categoriasOrdenadas.length > 0 && (
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-3">
              <span className="text-[11px] uppercase tracking-wide font-semibold text-muted-foreground">
                Distribuição por categoria
              </span>
              <span className="text-[11px] text-muted-foreground">
                Total: {fmt(stats.totalGeral)}
              </span>
            </div>
            <div className="space-y-1.5">
              {stats.categoriasOrdenadas.map(([cat, valor]) => {
                const pct = stats.totalGeral > 0 ? (valor / stats.totalGeral) * 100 : 0;
                const cor = CATEGORIA_CORES[cat] || "bg-gray-400";
                return (
                  <div key={cat} className="grid grid-cols-[120px_1fr_auto_36px] items-center gap-2 text-xs">
                    <span className="truncate text-foreground">{cat}</span>
                    <div className="h-2 rounded-full bg-muted overflow-hidden">
                      <div
                        className={`h-full ${cor} rounded-full transition-all`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <span className="tabular-nums text-muted-foreground">{fmt(valor)}</span>
                    <span className="tabular-nums text-right text-muted-foreground">{pct.toFixed(0)}%</span>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
