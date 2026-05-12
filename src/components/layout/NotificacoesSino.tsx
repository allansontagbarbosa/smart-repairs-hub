import { useNavigate } from "react-router-dom";
import {
  Bell,
  Archive,
  CheckCheck,
  RefreshCw,
  AlertTriangle,
  AlertCircle,
  CheckCircle2,
  Info,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  useNotificacoesCentral,
  useContagemNaoLidas,
  useMarcarNotificacao,
  useMarcarTodasLidas,
  useProcessarNotificacoes,
  type NotificacaoCentral,
} from "@/hooks/useNotificacoesCentral";
import { toast } from "sonner";

const SEVERIDADE_INFO = {
  critical: { color: "text-destructive", bg: "bg-destructive/10", icon: AlertCircle },
  warning: { color: "text-amber-600", bg: "bg-amber-500/10", icon: AlertTriangle },
  success: { color: "text-green-600", bg: "bg-green-500/10", icon: CheckCircle2 },
  info: { color: "text-blue-600", bg: "bg-blue-500/10", icon: Info },
} as const;

function tempoRelativo(date: string): string {
  const diff = Date.now() - new Date(date).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return "agora";
  if (min < 60) return `${min}min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d`;
  return new Date(date).toLocaleDateString("pt-BR");
}

export function NotificacoesSino() {
  const navigate = useNavigate();
  const { data: notificacoes = [], isLoading } = useNotificacoesCentral(20);
  const { data: contagem = 0 } = useContagemNaoLidas();
  const marcar = useMarcarNotificacao();
  const marcarTodas = useMarcarTodasLidas();
  const processar = useProcessarNotificacoes();

  const handleClick = async (notif: NotificacaoCentral) => {
    if (!notif.lida) {
      await marcar.mutateAsync({ id: notif.id, acao: "lida" });
    }
    if (notif.link) navigate(notif.link);
  };

  const handleAtualizar = async () => {
    try {
      const r = await processar.mutateAsync();
      if (r.notificacoes_criadas > 0) {
        toast.success(`${r.notificacoes_criadas} nova(s) notificação(ões)`);
      } else {
        toast.info("Nenhuma novidade");
      }
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative h-8 w-8">
          <Bell className="h-4 w-4" />
          {contagem > 0 && (
            <span className="absolute -top-0.5 -right-0.5 h-4 min-w-4 px-1 rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold flex items-center justify-center">
              {contagem > 99 ? "99+" : contagem}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[400px] p-0" align="end">
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <h4 className="font-semibold text-sm">Notificações</h4>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              className="text-xs h-7 gap-1"
              onClick={handleAtualizar}
              disabled={processar.isPending}
            >
              <RefreshCw className={`h-3 w-3 ${processar.isPending ? "animate-spin" : ""}`} />
              Atualizar
            </Button>
            {contagem > 0 && (
              <Button
                variant="ghost"
                size="sm"
                className="text-xs h-7 gap-1"
                onClick={() => marcarTodas.mutate()}
              >
                <CheckCheck className="h-3 w-3" />
                Tudo lido
              </Button>
            )}
          </div>
        </div>

        <ScrollArea className="max-h-[440px]">
          {isLoading ? (
            <div className="py-8 text-center text-sm text-muted-foreground">Carregando...</div>
          ) : notificacoes.length === 0 ? (
            <div className="py-10 text-center">
              <Bell className="h-8 w-8 mx-auto text-muted-foreground/40 mb-2" />
              <p className="text-sm text-muted-foreground">Sem notificações novas</p>
            </div>
          ) : (
            <div className="p-1 space-y-0.5">
              {notificacoes.map((n) => {
                const sev = SEVERIDADE_INFO[n.severidade] ?? SEVERIDADE_INFO.info;
                const Icon = sev.icon;
                return (
                  <div
                    key={n.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => handleClick(n)}
                    className={`group flex items-start gap-3 p-3 hover:bg-accent/50 rounded-lg transition-colors cursor-pointer ${n.lida ? "opacity-60" : ""}`}
                  >
                    <div className={`p-1.5 rounded-md shrink-0 ${sev.bg}`}>
                      <Icon className={`h-3.5 w-3.5 ${sev.color}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-sm font-medium leading-tight truncate">{n.titulo}</p>
                        <span className="text-[10px] text-muted-foreground shrink-0 mt-0.5">
                          {tempoRelativo(n.created_at)}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{n.mensagem}</p>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 opacity-0 group-hover:opacity-100"
                      onClick={(e) => {
                        e.stopPropagation();
                        marcar.mutate({ id: n.id, acao: "arquivar" });
                      }}
                      title="Arquivar"
                    >
                      <Archive className="h-3 w-3" />
                    </Button>
                  </div>
                );
              })}
            </div>
          )}
        </ScrollArea>

        <div className="border-t p-2">
          <Button
            variant="ghost"
            size="sm"
            className="w-full text-xs"
            onClick={() => navigate("/notificacoes")}
          >
            Ver todas
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
