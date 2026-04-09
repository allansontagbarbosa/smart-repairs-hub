import { DollarSign, TrendingUp, TrendingDown, ArrowUpRight, ArrowDownRight } from "lucide-react";

const months = [
  { month: "Abril 2026", receita: 4280, custos: 2140, lucro: 2140 },
  { month: "Março 2026", receita: 3890, custos: 1950, lucro: 1940 },
  { month: "Fevereiro 2026", receita: 3200, custos: 1700, lucro: 1500 },
];

const transactions = [
  { id: 1, desc: "OS #004 — Troca de tela iPhone 13", type: "receita" as const, value: 420, date: "03/04" },
  { id: 2, desc: "Compra: Tela iPhone 14 (2x)", type: "custo" as const, value: 360, date: "05/04" },
  { id: 3, desc: "OS #001 — Tela iPhone 14", type: "receita" as const, value: 350, date: "07/04" },
  { id: 4, desc: "Compra: Bateria Samsung S23", type: "custo" as const, value: 60, date: "07/04" },
  { id: 5, desc: "OS #002 — Bateria Samsung S23", type: "receita" as const, value: 180, date: "06/04" },
  { id: 6, desc: "OS #005 — Conector de carga Xiaomi", type: "receita" as const, value: 120, date: "08/04" },
];

export default function Financeiro() {
  const current = months[0];
  const margin = ((current.lucro / current.receita) * 100).toFixed(0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Financeiro</h1>
        <p className="text-muted-foreground text-sm mt-1">Controle de receitas e custos</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="stat-card">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="h-4 w-4 text-success" />
            <span className="text-xs text-muted-foreground">Receita</span>
          </div>
          <p className="text-2xl font-bold">R$ {current.receita.toLocaleString()}</p>
        </div>
        <div className="stat-card">
          <div className="flex items-center gap-2 mb-2">
            <TrendingDown className="h-4 w-4 text-destructive" />
            <span className="text-xs text-muted-foreground">Custos</span>
          </div>
          <p className="text-2xl font-bold">R$ {current.custos.toLocaleString()}</p>
        </div>
        <div className="stat-card border-success/30 bg-success/5">
          <div className="flex items-center gap-2 mb-2">
            <DollarSign className="h-4 w-4 text-success" />
            <span className="text-xs text-muted-foreground">Lucro Líquido</span>
          </div>
          <p className="text-2xl font-bold text-success">R$ {current.lucro.toLocaleString()}</p>
          <p className="text-xs text-muted-foreground mt-1">Margem: {margin}%</p>
        </div>
      </div>

      <div className="bg-card rounded-xl border">
        <div className="p-5 border-b">
          <h2 className="font-semibold">Últimas Movimentações</h2>
        </div>
        <div className="divide-y">
          {transactions.map((t) => (
            <div key={t.id} className="flex items-center justify-between px-5 py-3.5 hover:bg-muted/20 transition-colors">
              <div className="flex items-center gap-3 min-w-0">
                {t.type === "receita" ? (
                  <ArrowUpRight className="h-4 w-4 text-success shrink-0" />
                ) : (
                  <ArrowDownRight className="h-4 w-4 text-destructive shrink-0" />
                )}
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{t.desc}</p>
                  <p className="text-xs text-muted-foreground">{t.date}</p>
                </div>
              </div>
              <span className={`text-sm font-semibold whitespace-nowrap ${t.type === "receita" ? "text-success" : "text-destructive"}`}>
                {t.type === "receita" ? "+" : "-"} R$ {t.value}
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-card rounded-xl border">
        <div className="p-5 border-b">
          <h2 className="font-semibold">Resumo Mensal</h2>
        </div>
        <div className="divide-y">
          {months.map((m) => (
            <div key={m.month} className="flex items-center justify-between px-5 py-3.5">
              <span className="text-sm font-medium">{m.month}</span>
              <div className="flex items-center gap-6 text-sm">
                <span className="text-muted-foreground hidden sm:inline">Receita: R$ {m.receita.toLocaleString()}</span>
                <span className="text-muted-foreground hidden sm:inline">Custos: R$ {m.custos.toLocaleString()}</span>
                <span className="font-semibold text-success">R$ {m.lucro.toLocaleString()}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
