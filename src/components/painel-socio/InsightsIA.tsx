import { useInsightsSocio } from "@/hooks/useInsightsSocio";
import { Card, CardContent } from "@/components/ui/card";
import { Sparkles, AlertTriangle, TrendingUp, Bell, Loader2 } from "lucide-react";

const brl = (cents: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);

const TIPO_CONFIG = {
  risco: {
    Icon: AlertTriangle,
    border: "border-l-red-500",
    iconBg: "bg-red-500/15 text-red-600 dark:text-red-400",
    valor: "text-red-600 dark:text-red-400",
  },
  oportunidade: {
    Icon: TrendingUp,
    border: "border-l-emerald-500",
    iconBg: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
    valor: "text-emerald-600 dark:text-emerald-400",
  },
  alerta: {
    Icon: Bell,
    border: "border-l-amber-500",
    iconBg: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
    valor: "text-amber-600 dark:text-amber-400",
  },
} as const;

const safeStr = (v: any): string => {
  if (v == null) return "";
  if (typeof v === "string" || typeof v === "number") return String(v);
  try { return JSON.stringify(v); } catch { return ""; }
};

export function InsightsIA() {
  const { data, isLoading, error } = useInsightsSocio();

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6 flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          IA analisando seus números…
        </CardContent>
      </Card>
    );
  }

  if (error || !data?.insights?.insights) return null;
  const insights = data.insights.insights;

  return (
    <Card>
      <CardContent className="p-5 space-y-4">
        <div className="flex items-end justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            <h3 className="text-sm font-semibold uppercase tracking-wider">
              3 decisões que vão impactar seu bolso
            </h3>
          </div>
          <span className="text-xs text-muted-foreground">
            {data.cached ? "Cache" : "Recém-gerado"} ·{" "}
            {new Date(data.gerado_em).toLocaleTimeString("pt-BR", {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </span>
        </div>

        <div className="space-y-3">
          {insights.map((ins, i) => {
            const cfg = TIPO_CONFIG[ins.tipo] || TIPO_CONFIG.alerta;
            const Icon = cfg.Icon;
            return (
              <div
                key={i}
                className={`flex gap-3 rounded-lg border border-l-4 ${cfg.border} p-3 bg-muted/30`}
              >
                <div className={`h-9 w-9 rounded-md flex items-center justify-center shrink-0 ${cfg.iconBg}`}>
                  <Icon className="h-4 w-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <div className="font-semibold text-sm">{safeStr(ins.titulo)}</div>
                    <div className={`text-sm font-bold whitespace-nowrap ${cfg.valor}`}>
                      {brl(Number(ins.valor_impacto_centavos) || 0)}
                    </div>
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">{safeStr(ins.descricao)}</p>
                  <p className="text-xs font-medium mt-2">👉 {safeStr(ins.acao_sugerida)}</p>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
