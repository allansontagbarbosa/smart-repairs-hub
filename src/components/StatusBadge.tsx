import { cn } from "@/lib/utils";

type Status = "aguardando" | "em_reparo" | "pronto" | "entregue" | "cancelado";

const statusConfig: Record<Status, { label: string; className: string }> = {
  aguardando: { label: "Aguardando", className: "bg-warning/15 text-warning" },
  em_reparo: { label: "Em Reparo", className: "bg-info/15 text-info" },
  pronto: { label: "Pronto", className: "bg-success/15 text-success" },
  entregue: { label: "Entregue", className: "bg-muted text-muted-foreground" },
  cancelado: { label: "Cancelado", className: "bg-destructive/15 text-destructive" },
};

export function StatusBadge({ status }: { status: Status }) {
  const config = statusConfig[status];
  return (
    <span className={cn("inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium", config.className)}>
      {config.label}
    </span>
  );
}
