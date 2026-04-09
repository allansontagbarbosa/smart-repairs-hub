import { AlertTriangle, Clock, Info, MessageCircle, DollarSign, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

export type GenericAlert = {
  type: "danger" | "warning" | "info";
  message: string;
  orderId?: string;
  phone?: string;
  actions?: ("whatsapp" | "cobrar" | "entregar")[];
};

const styles = {
  danger: { bg: "bg-destructive/8", border: "border-destructive/30", Icon: AlertTriangle, iconColor: "text-destructive", accentBar: "bg-destructive" },
  warning: { bg: "bg-warning-muted", border: "border-warning/30", Icon: Clock, iconColor: "text-warning", accentBar: "bg-warning" },
  info: { bg: "bg-info-muted", border: "border-info/30", Icon: Info, iconColor: "text-info", accentBar: "bg-info" },
};

interface Props {
  alertas: GenericAlert[];
  max?: number;
  onClickAlert?: (orderId: string) => void;
  onAction?: (action: string, orderId: string, phone?: string) => void;
}

export function AlertsBanner({ alertas, max = 5, onClickAlert, onAction }: Props) {
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
            className={`flex items-center gap-3 rounded-lg border ${s.border} ${s.bg} overflow-hidden`}
          >
            <div className={`w-1 self-stretch shrink-0 ${s.accentBar}`} />
            <div
              onClick={() => clickable && onClickAlert(alert.orderId!)}
              className={`flex-1 flex items-center gap-3 py-3 pr-2 ${clickable ? "cursor-pointer hover:opacity-80 transition-opacity" : ""}`}
            >
              <s.Icon className={`h-4 w-4 shrink-0 ${s.iconColor}`} />
              <p className="text-sm flex-1">{alert.message}</p>
            </div>
            {alert.actions && alert.actions.length > 0 && onAction && (
              <div className="flex items-center gap-1.5 pr-3 shrink-0">
                {alert.actions.includes("whatsapp") && (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 px-2 text-xs gap-1 text-success hover:text-success"
                    onClick={(e) => { e.stopPropagation(); onAction("whatsapp", alert.orderId!, alert.phone); }}
                  >
                    <MessageCircle className="h-3.5 w-3.5" />
                    <span className="hidden sm:inline">WhatsApp</span>
                  </Button>
                )}
                {alert.actions.includes("cobrar") && (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 px-2 text-xs gap-1 text-warning hover:text-warning"
                    onClick={(e) => { e.stopPropagation(); onAction("cobrar", alert.orderId!, alert.phone); }}
                  >
                    <DollarSign className="h-3.5 w-3.5" />
                    <span className="hidden sm:inline">Cobrar</span>
                  </Button>
                )}
                {alert.actions.includes("entregar") && (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 px-2 text-xs gap-1 text-info hover:text-info"
                    onClick={(e) => { e.stopPropagation(); onAction("entregar", alert.orderId!); }}
                  >
                    <CheckCircle className="h-3.5 w-3.5" />
                    <span className="hidden sm:inline">Entregar</span>
                  </Button>
                )}
              </div>
            )}
          </div>
        );
      })}
      {remaining > 0 && (
        <p className="text-xs text-muted-foreground pl-1">+ {remaining} alerta{remaining > 1 ? "s" : ""}</p>
      )}
    </div>
  );
}
