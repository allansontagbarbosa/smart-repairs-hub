import { useNavigate } from "react-router-dom";
import { Briefcase, CheckCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  useSocioNotificacoes,
  useMarcarSocioNotificacao,
  type SocioNotificacao,
} from "@/hooks/useSocioSolicitacoes";

const tempoRel = (iso: string) => {
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return "agora";
  if (min < 60) return `${min}min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `há ${h}h`;
  const d = Math.floor(h / 24);
  if (d === 1) return "ontem";
  if (d < 7) return `há ${d}d`;
  return new Date(iso).toLocaleDateString("pt-BR");
};

export function SocioNotificacoesSino() {
  const navigate = useNavigate();
  const { data, isError } = useSocioNotificacoes(false);
  const marcar = useMarcarSocioNotificacao();

  // Não é sócio? Sino some.
  if (isError || !data?.success) return null;

  const naoLidas = data.nao_lidas || 0;
  const notificacoes = data.notificacoes || [];

  const handleClick = async (n: SocioNotificacao) => {
    if (!n.lida) marcar.mutate(n.id);
    if (n.link_interno) navigate(n.link_interno);
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative h-8 w-8"
          title="Notificações do sócio"
        >
          <Briefcase className="h-4 w-4" />
          {naoLidas > 0 && (
            <span className="absolute -top-0.5 -right-0.5 h-4 min-w-4 px-1 rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold flex items-center justify-center">
              {naoLidas > 99 ? "99+" : naoLidas}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[380px] p-0" align="end">
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <h4 className="font-semibold text-sm">Sócio · Notificações</h4>
          {naoLidas > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="text-xs h-7 gap-1"
              onClick={() => marcar.mutate(null)}
            >
              <CheckCheck className="h-3 w-3" />
              Tudo lido
            </Button>
          )}
        </div>

        <ScrollArea className="max-h-[440px]">
          {notificacoes.length === 0 ? (
            <div className="py-10 text-center">
              <Briefcase className="h-8 w-8 mx-auto text-muted-foreground/40 mb-2" />
              <p className="text-sm text-muted-foreground">Sem notificações</p>
            </div>
          ) : (
            <div className="p-1">
              {notificacoes.map((n) => (
                <button
                  key={n.id}
                  onClick={() => handleClick(n)}
                  className={`w-full text-left flex items-start gap-3 p-3 hover:bg-accent/50 rounded-lg transition-colors ${
                    n.lida ? "opacity-60" : ""
                  }`}
                >
                  <div className={`h-2 w-2 mt-1.5 rounded-full shrink-0 ${n.lida ? "bg-transparent" : "bg-primary"}`} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-semibold leading-tight">{n.titulo}</p>
                      <span className="text-[10px] text-muted-foreground shrink-0 mt-0.5">
                        {tempoRel(n.created_at)}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5 line-clamp-3">{n.mensagem}</p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
