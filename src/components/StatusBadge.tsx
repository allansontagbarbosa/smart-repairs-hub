import { cn } from "@/lib/utils";
import type { Database } from "@/integrations/supabase/types";

type Status = Database["public"]["Enums"]["status_ordem"];

const statusConfig: Record<Status, { label: string; dot: string; text: string; bg: string }> = {
  recebido: { label: "Recebido", dot: "bg-muted-foreground", text: "text-muted-foreground", bg: "bg-muted" },
  em_analise: { label: "Em Análise", dot: "bg-info", text: "text-info", bg: "bg-info-muted" },
  aguardando_aprovacao: { label: "Aguard. Aprovação", dot: "bg-warning", text: "text-warning", bg: "bg-warning-muted" },
  em_reparo: { label: "Em Reparo", dot: "bg-info", text: "text-info", bg: "bg-info-muted" },
  pronto: { label: "Pronto", dot: "bg-success", text: "text-success", bg: "bg-success-muted" },
  entregue: { label: "Entregue", dot: "bg-foreground/30", text: "text-muted-foreground", bg: "bg-muted" },
};

export function StatusBadge({ status }: { status: Status }) {
  const config = statusConfig[status];
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium whitespace-nowrap", config.bg, config.text)}>
      <span className={cn("h-1.5 w-1.5 rounded-full", config.dot)} />
      {config.label}
    </span>
  );
}

export const allStatuses: { value: Status | "todos"; label: string }[] = [
  { value: "todos", label: "Todos" },
  { value: "recebido", label: "Recebido" },
  { value: "em_analise", label: "Em Análise" },
  { value: "aguardando_aprovacao", label: "Aguard. Aprovação" },
  { value: "em_reparo", label: "Em Reparo" },
  { value: "pronto", label: "Pronto" },
  { value: "entregue", label: "Entregue" },
];
