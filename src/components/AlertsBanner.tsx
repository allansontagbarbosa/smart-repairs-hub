import { AlertTriangle, Clock, Info } from "lucide-react";

export type GenericAlert = {
  type: "danger" | "warning" | "info";
  message: string;
  orderId?: string;
};

const styles = {
  danger: { bg: "bg-destructive/8", border: "border-destructive/20", Icon: AlertTriangle, iconColor: "text-destructive" },
  warning: { bg: "bg-warning-muted", border: "border-warning/20", Icon: Clock, iconColor: "text-warning" },
  info: { bg: "bg-info-muted", border: "border-info/20", Icon: Info, iconColor: "text-info" },
};

interface Props {
  alertas: GenericAlert[];
  max?: number;
  onClickAlert?: (orderId: string) => void;
}

export function AlertsBanner({ alertas, max = 5, onClickAlert }: Props) {
  if (alertas.length === 0) return null;

  const shown = alertas.slice(0, max);
  const remaining = alertas.length - shown.length;

  return (
    <div className="space-y-2">
      {shown.map((alert, i) => {
        const s = styles[alert.type];
        const clickable = onClickAlert && alert.orderId;
        return (
          <div
            key={i}
            onClick={() => clickable && onClickAlert(alert.orderId!)}
            className={`flex items-start gap-3 rounded-lg border ${s.border} ${s.bg} px-4 py-3 ${clickable ? "cursor-pointer hover:opacity-80 transition-opacity" : ""}`}
          >
            <s.Icon className={`h-4 w-4 shrink-0 mt-0.5 ${s.iconColor}`} />
            <p className="text-sm">{alert.message}</p>
          </div>
        );
      })}
      {remaining > 0 && (
        <p className="text-xs text-muted-foreground pl-1">+ {remaining} alerta{remaining > 1 ? "s" : ""}</p>
      )}
    </div>
  );
}
