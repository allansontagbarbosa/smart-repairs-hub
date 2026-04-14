import { useNavigate } from "react-router-dom";
import { Bell, AlertCircle, AlertTriangle, CheckCircle, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useNotificacoes, Notificacao } from "@/hooks/useNotificacoes";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

const tipoConfig: Record<string, { icon: typeof AlertCircle; color: string }> = {
  os_atrasada: { icon: AlertCircle, color: "text-destructive" },
  os_aguardando_aprovacao: { icon: Clock, color: "text-warning" },
  conta_vencida: { icon: AlertCircle, color: "text-destructive" },
  estoque_baixo: { icon: AlertTriangle, color: "text-warning" },
  os_aprovada: { icon: CheckCircle, color: "text-green-500" },
  os_recusada: { icon: AlertCircle, color: "text-destructive" },
};

function NotificacaoItem({ n, onClick }: { n: Notificacao; onClick: () => void }) {
  const cfg = tipoConfig[n.tipo] ?? { icon: Bell, color: "text-muted-foreground" };
  const Icon = cfg.icon;
  const tempo = formatDistanceToNow(new Date(n.created_at), { addSuffix: true, locale: ptBR });

  return (
    <button
      onClick={onClick}
      className={`w-full text-left flex items-start gap-3 p-3 hover:bg-accent/50 rounded-lg transition-colors ${n.lida ? "opacity-50" : ""}`}
    >
      <Icon className={`h-4 w-4 mt-0.5 shrink-0 ${cfg.color}`} />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium leading-tight">{n.titulo}</p>
        <p className="text-xs text-muted-foreground mt-0.5">{n.mensagem}</p>
      </div>
      <span className="text-[10px] text-muted-foreground shrink-0 mt-0.5">{tempo}</span>
    </button>
  );
}

export function NotificacoesBell() {
  const { notificacoes, totalNaoLidas, marcarLida, marcarTodasLidas } = useNotificacoes();
  const navigate = useNavigate();

  function handleClick(n: Notificacao) {
    marcarLida(n.id);
    if (n.referencia_tabela === "ordens_de_servico") {
      navigate("/assistencia");
    } else if (n.referencia_tabela === "contas_a_pagar") {
      navigate("/financeiro");
    } else if (n.referencia_tabela === "estoque_itens") {
      navigate("/pecas");
    }
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative h-8 w-8">
          <Bell className="h-4 w-4" />
          {totalNaoLidas > 0 && (
            <span className="absolute -top-0.5 -right-0.5 h-4 min-w-4 px-1 rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold flex items-center justify-center">
              {totalNaoLidas > 99 ? "99+" : totalNaoLidas}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[380px] p-0" align="end">
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <h4 className="font-semibold text-sm">Notificações</h4>
          {totalNaoLidas > 0 && (
            <Button variant="ghost" size="sm" className="text-xs h-7" onClick={marcarTodasLidas}>
              Marcar todas como lidas
            </Button>
          )}
        </div>
        <ScrollArea className="max-h-[400px]">
          {notificacoes.length > 0 ? (
            <div className="p-1 space-y-0.5">
              {notificacoes.map(n => (
                <NotificacaoItem key={n.id} n={n} onClick={() => handleClick(n)} />
              ))}
            </div>
          ) : (
            <div className="py-8 text-center text-sm text-muted-foreground">
              Nenhuma notificação
            </div>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
