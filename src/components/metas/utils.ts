import { MetricaMeta } from "@/hooks/useMetas";

export const formatValorMeta = (v: number, m: MetricaMeta): string => {
  if (m === "faturamento" || m === "ticket_medio" || m === "comissao_paga" || m === "margem_os")
    return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  if (m === "tempo_medio_horas") {
    if (v < 1) return `${Math.round(v * 60)} min`;
    if (v < 24) return `${v.toFixed(1)}h`;
    return `${(v / 24).toFixed(1)}d`;
  }
  if (m === "retrabalho_taxa" || m === "aprovacao_orcamento_taxa" || m === "retorno_cliente_30d")
    return `${v.toFixed(1)}%`;
  return Math.round(v).toLocaleString("pt-BR");
};

export const corStatus: Record<string, { bar: string; pillBg: string; pillText: string }> = {
  verde:    { bar: "bg-primary",          pillBg: "bg-primary/12", pillText: "text-primary" },
  amarelo:  { bar: "bg-amber-500",        pillBg: "bg-amber-100",  pillText: "text-amber-800" },
  cinza:    { bar: "bg-muted-foreground", pillBg: "bg-muted",      pillText: "text-muted-foreground" },
  vermelho: { bar: "bg-red-500",          pillBg: "bg-red-100",    pillText: "text-red-800" },
};
