import { cn } from "@/lib/utils";

type Status = "aguardando" | "em_reparo" | "pronto" | "entregue" | "cancelado";

const statusConfig: Record<Status, { label: string; dot: string; text: string; bg: string }> = {
  aguardando: { label: "Aguardando", dot: "bg-warning", text: "text-warning", bg: "bg-warning-muted" },
  em_reparo: { label: "Em Reparo", dot: "bg-info", text: "text-info", bg: "bg-info-muted" },
  pronto: { label: "Pronto", dot: "bg-success", text: "text-success", bg: "bg-success-muted" },
  entregue: { label: "Entregue", dot: "bg-muted-foreground", text: "text-muted-foreground", bg: "bg-muted" },
  cancelado: { label: "Cancelado", dot: "bg-destructive", text: "text-destructive", bg: "bg-destructive/10" },
};

export function StatusBadge({ status }: { status: Status }) {
  const config = statusConfig[status];
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium", config.bg, config.text)}>
      <span className={cn("h-1.5 w-1.5 rounded-full", config.dot)} />
      {config.label}
    </span>
  );
}
