import {
  DollarSign, TrendingUp, TrendingDown, AlertTriangle,
  Calendar, CalendarDays, CalendarRange, CreditCard, Users,
} from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";

const fmtCurrency = (v: number) =>
  `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;

const COLORS = [
  "hsl(var(--primary))",
  "hsl(var(--destructive))",
  "hsl(var(--warning))",
  "hsl(var(--info))",
  "hsl(var(--success))",
  "#8b5cf6",
  "#ec4899",
  "#f97316",
  "#14b8a6",
  "#6366f1",
  "#a3a3a3",
];

interface Props {
  kpis: {
    pagarHoje: number;
    pagarSemana: number;
    pagarMes: number;
    pagoMes: number;
    totalComissoesPendentes: number;
    lucroEstimado: number;
    despesasPorCategoria: Record<string, number>;
    evolucaoMensal: { mes: string; despesas: number; receita: number }[];
    contasVencidas: number;
    comissoesPendentesCount: number;
  };
}

export function FinanceiroDashboard({ kpis }: Props) {
  const categoriasData = Object.entries(kpis.despesasPorCategoria)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);

  return (
    <div className="space-y-5">
      {/* Alerts */}
      {(kpis.contasVencidas > 0 || kpis.comissoesPendentesCount > 0) && (
        <div className="flex flex-wrap gap-2">
          {kpis.contasVencidas > 0 && (
            <div className="inline-flex items-center gap-1.5 rounded-lg border border-destructive/30 bg-destructive/8 px-3 py-1.5 text-xs font-semibold text-destructive">
              <AlertTriangle className="h-3.5 w-3.5" />
              {kpis.contasVencidas} conta{kpis.contasVencidas > 1 ? "s" : ""} vencida{kpis.contasVencidas > 1 ? "s" : ""}
            </div>
          )}
          {kpis.comissoesPendentesCount > 0 && (
            <div className="inline-flex items-center gap-1.5 rounded-lg border border-warning/30 bg-warning-muted px-3 py-1.5 text-xs font-semibold text-warning">
              <Users className="h-3.5 w-3.5" />
              {kpis.comissoesPendentesCount} comiss{kpis.comissoesPendentesCount > 1 ? "ões pendentes" : "ão pendente"}
            </div>
          )}
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
        <div className={`stat-card ${kpis.pagarHoje > 0 ? "border-destructive/20 bg-destructive/5" : ""}`}>
          <Calendar className={`h-4 w-4 mb-3 ${kpis.pagarHoje > 0 ? "text-destructive" : "text-muted-foreground"}`} />
          <p className={`stat-value ${kpis.pagarHoje > 0 ? "text-destructive" : ""}`}>{fmtCurrency(kpis.pagarHoje)}</p>
          <p className="stat-label">A pagar hoje</p>
        </div>
        <div className="stat-card">
          <CalendarDays className="h-4 w-4 text-warning mb-3" />
          <p className="stat-value">{fmtCurrency(kpis.pagarSemana)}</p>
          <p className="stat-label">A pagar na semana</p>
        </div>
        <div className="stat-card">
          <CalendarRange className="h-4 w-4 text-info mb-3" />
          <p className="stat-value">{fmtCurrency(kpis.pagarMes)}</p>
          <p className="stat-label">A pagar no mês</p>
        </div>
        <div className="stat-card border-success/20 bg-success-muted">
          <CreditCard className="h-4 w-4 text-success mb-3" />
          <p className="stat-value text-success">{fmtCurrency(kpis.pagoMes)}</p>
          <p className="stat-label">Pago no mês</p>
        </div>
        <div className="stat-card">
          <Users className="h-4 w-4 text-warning mb-3" />
          <p className="stat-value">{fmtCurrency(kpis.totalComissoesPendentes)}</p>
          <p className="stat-label">Comissões a pagar</p>
        </div>
        <div className={`stat-card ${kpis.lucroEstimado >= 0 ? "border-success/20 bg-success-muted" : "border-destructive/20 bg-destructive/5"}`}>
          <TrendingUp className={`h-4 w-4 mb-3 ${kpis.lucroEstimado >= 0 ? "text-success" : "text-destructive"}`} />
          <p className={`stat-value ${kpis.lucroEstimado >= 0 ? "text-success" : "text-destructive"}`}>{fmtCurrency(kpis.lucroEstimado)}</p>
          <p className="stat-label">Lucro estimado do mês</p>
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Evolução mensal */}
        <div className="section-card">
          <div className="section-header">
            <h3 className="section-title">Evolução Mensal</h3>
          </div>
          <div className="p-4 h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={kpis.evolucaoMensal}>
                <XAxis dataKey="mes" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                <Tooltip
                  formatter={(value: number, name: string) => [fmtCurrency(value), name === "receita" ? "Receita" : "Despesas"]}
                  contentStyle={{ fontSize: 12, borderRadius: 8 }}
                />
                <Bar dataKey="receita" fill="hsl(var(--success))" radius={[4, 4, 0, 0]} />
                <Bar dataKey="despesas" fill="hsl(var(--destructive))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Despesas por categoria */}
        <div className="section-card">
          <div className="section-header">
            <h3 className="section-title">Despesas por Categoria</h3>
          </div>
          <div className="p-4">
            {categoriasData.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">Nenhuma despesa no mês</p>
            ) : (
              <div className="flex items-center gap-4">
                <div className="w-36 h-36 shrink-0">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={categoriasData} dataKey="value" cx="50%" cy="50%" innerRadius={30} outerRadius={55} paddingAngle={2}>
                        {categoriasData.map((_, i) => (
                          <Cell key={i} fill={COLORS[i % COLORS.length]} />
                        ))}
                      </Pie>
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="flex-1 space-y-1.5 max-h-36 overflow-y-auto">
                  {categoriasData.slice(0, 8).map((c, i) => (
                    <div key={c.name} className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                        <span className="truncate max-w-28">{c.name}</span>
                      </div>
                      <span className="font-medium">{fmtCurrency(c.value)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
