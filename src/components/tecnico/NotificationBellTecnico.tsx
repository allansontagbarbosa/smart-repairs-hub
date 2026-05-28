import { useNavigate } from "react-router-dom";
import { Bell, CheckCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  useNotificacoesTecnico,
  useMarcarNotificacaoTecnicoLida,
  type NotificacaoTecnico,
} from "@/hooks/useNotificacoesTecnico";

function tempoRelativo(iso: string) {
  const ms = Date.now() - new Date(iso).getTime();
  const min = Math.floor(ms / 60000);
  if (min < 1) return "agora";
  if (min < 60) return `há ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `há ${h}h`;
  const d = Math.floor(h / 24);
  return `há ${d}d`;
}

export function NotificationBellTecnico() {
  const navigate = useNavigate();
  const { data } = useNotificacoesTecnico();
  const marcar = useMarcarNotificacaoTecnicoLida();
  const naoLidas = data?.nao_lidas ?? 0;
  const lista = data?.notificacoes ?? [];

  const onClick = (n: NotificacaoTecnico) => {
    if (!n.lida) marcar.mutate(n.id);
    if (n.link_interno) navigate(n.link_interno);
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Notificações" className="relative">
          <Bell className="h-4 w-4" />
          {naoLidas > 0 && (
            <span className="absolute top-0.5 right-0.5 h-4 min-w-[16px] px-1 rounded-full bg-destructive text-destructive-foreground text-[9px] font-semibold grid place-items-center">
              {naoLidas > 9 ? "9+" : naoLidas}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between px-3 py-2 border-b">
          <p className="text-sm font-semibold">Notificações</p>
          {naoLidas > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs"
              onClick={() => marcar.mutate(null)}
            >
              <CheckCheck className="h-3 w-3 mr-1" /> Marcar todas
            </Button>
          )}
        </div>
        <ScrollArea className="max-h-80">
          {lista.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-8">Sem notificações</p>
          ) : (
            <ul className="divide-y">
              {lista.map((n) => (
                <li key={n.id}>
                  <button
                    type="button"
                    onClick={() => onClick(n)}
                    className={cn(
                      "w-full text-left px-3 py-2.5 hover:bg-accent transition-colors",
                      !n.lida && "bg-primary/5"
                    )}
                  >
                    <div className="flex items-start gap-2">
                      {!n.lida && (
                        <span className="mt-1.5 h-2 w-2 rounded-full bg-primary shrink-0" />
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-semibold truncate">{n.titulo}</p>
                        <p className="text-xs text-muted-foreground line-clamp-2">{n.mensagem}</p>
                        <p className="text-[10px] text-muted-foreground mt-0.5">
                          {tempoRelativo(n.created_at)}
                        </p>
                      </div>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
