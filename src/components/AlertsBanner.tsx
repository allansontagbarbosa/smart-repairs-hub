import { AlertTriangle, Clock, Info, MessageCircle, DollarSign, CheckCircle, Eye, Send } from "lucide-react";
import { Button } from "@/components/ui/button";

export type GenericAlert = {
  type: "danger" | "warning" | "info";
  message: string;
  orderId?: string;
  phone?: string;
  sugestao?: string;
  acoes?: string[];
  /** @deprecated use acoes instead */
  actions?: ("whatsapp" | "cobrar" | "entregar")[];
};

const styles = {
  danger: { bg: "bg-destructive/8", border: "border-destructive/30", Icon: AlertTriangle, iconColor: "text-destructive", accentBar: "bg-destructive" },
  warning: { bg: "bg-warning-muted", border: "border-warning/30", Icon: Clock, iconColor: "text-warning", accentBar: "bg-warning" },
  info: { bg: "bg-info-muted", border: "border-info/30", Icon: Info, iconColor: "text-info", accentBar: "bg-info" },
};

const acaoConfig: Record<string, { icon: typeof MessageCircle; label: string; color: string }> = {
  whatsapp_retirada: { icon: Send, label: "Avisar retirada", color: "text-success hover:text-success" },
  cobrar_aprovacao: { icon: DollarSign, label: "Cobrar", color: "text-warning hover:text-warning" },
  verificar_status: { icon: Eye, label: "Verificar", color: "text-info hover:text-info" },
  entregar: { icon: CheckCircle, label: "Entregar", color: "text-success hover:text-success" },
  // Legacy support
  whatsapp: { icon: MessageCircle, label: "WhatsApp", color: "text-success hover:text-success" },
  cobrar: { icon: DollarSign, label: "Cobrar", color: "text-warning hover:text-warning" },
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
        const allActions = alert.acoes ?? alert.actions ?? [];

        return (
          <div
            key={i}
            className={`flex items-start gap-0 rounded-lg border ${s.border} ${s.bg} overflow-hidden`}
          >
            <div className={`w-1 self-stretch shrink-0 ${s.accentBar}`} />
            <div className="flex-1 flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3 py-2.5 px-3">
              <div
                onClick={() => clickable && onClickAlert(alert.orderId!)}
                className={`flex items-start gap-2.5 flex-1 min-w-0 ${clickable ? "cursor-pointer hover:opacity-80 transition-opacity" : ""}`}
              >
                <s.Icon className={`h-4 w-4 shrink-0 mt-0.5 ${s.iconColor}`} />
                <div className="min-w-0">
                  <p className="text-sm leading-tight">{alert.message}</p>
                  {alert.sugestao && (
                    <p className="text-xs text-muted-foreground mt-0.5 font-medium italic">
                      💡 {alert.sugestao}
                    </p>
                  )}
                </div>
              </div>

              {allActions.length > 0 && onAction && (
                <div className="flex items-center gap-1 shrink-0 pl-6 sm:pl-0">
                  {allActions.map((action) => {
                    const cfg = acaoConfig[action];
                    if (!cfg) return null;
                    const ActionIcon = cfg.icon;
                    return (
                      <Button
                        key={action}
                        size="sm"
                        variant="ghost"
                        className={`h-7 px-2 text-xs gap-1 ${cfg.color}`}
                        onClick={(e) => { e.stopPropagation(); onAction(action, alert.orderId!, alert.phone); }}
                      >
                        <ActionIcon className="h-3.5 w-3.5" />
                        <span className="hidden sm:inline">{cfg.label}</span>
                      </Button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        );
      })}
      {remaining > 0 && (
        <p className="text-xs text-muted-foreground pl-1">+ {remaining} alerta{remaining > 1 ? "s" : ""}</p>
      )}
    </div>
  );
}
