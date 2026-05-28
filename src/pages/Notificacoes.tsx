import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Bell,
  Archive,
  Check,
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Info,
  RefreshCw,
  CheckCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  useNotificacoesCentral,
  useMarcarNotificacao,
  useMarcarTodasLidas,
  useProcessarNotificacoes,
  type NotificacaoCentral,
} from "@/hooks/useNotificacoesCentral";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { toast } from "sonner";

const SEVERIDADE_INFO = {
  critical: { color: "text-destructive", bg: "bg-destructive/10", icon: AlertCircle, label: "Crítico" },
  warning: { color: "text-amber-600", bg: "bg-amber-500/10", icon: AlertTriangle, label: "Atenção" },
  success: { color: "text-green-600", bg: "bg-green-500/10", icon: CheckCircle2, label: "Sucesso" },
  info: { color: "text-blue-600", bg: "bg-blue-500/10", icon: Info, label: "Info" },
} as const;

type SevFilter = "all" | "critical" | "warning" | "info" | "success";
type LidaFilter = "all" | "nao_lidas" | "lidas";

export default function NotificacoesPage() {
  const navigate = useNavigate();
  const [filterSev, setFilterSev] = useState<SevFilter>("all");
  const [filterLida, setFilterLida] = useState<LidaFilter>("all");

  const { data: notificacoes = [], isLoading } = useNotificacoesCentral(200);
  const marcar = useMarcarNotificacao();
  const marcarTodas = useMarcarTodasLidas();
  const processar = useProcessarNotificacoes();

  const filtradas = notificacoes.filter((n) => {
    if (filterSev !== "all" && n.severidade !== filterSev) return false;
    if (filterLida === "nao_lidas" && n.lida) return false;
    if (filterLida === "lidas" && !n.lida) return false;
    return true;
  });

  const handleClick = async (n: NotificacaoCentral) => {
    if (!n.lida) await marcar.mutateAsync({ id: n.id, acao: "lida" });
    if (n.link) navigate(n.link);
  };

  const handleAtualizar = async () => {
    try {
      const r = await processar.mutateAsync();
      toast.success(`${r.notificacoes_criadas} nova(s) notificação(ões)`);
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  return (
    <div className="container mx-auto p-4 md:p-6 space-y-4 max-w-4xl">
      <div className="space-y-3 sm:space-y-0 sm:flex sm:items-center sm:gap-3">
        <div className="flex items-center gap-2">
          <SidebarTrigger className="md:hidden" />
          <div className="flex-1 min-w-0">
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight">Notificações</h1>
            <p className="text-xs sm:text-sm text-muted-foreground">Alertas e eventos do sistema</p>
          </div>
        </div>
        <div className="flex gap-2 sm:ml-auto">
          <Button variant="outline" size="sm" onClick={handleAtualizar} disabled={processar.isPending}
                  className="flex-1 sm:flex-initial h-10 sm:h-9">
            <RefreshCw className={`h-4 w-4 sm:mr-2 ${processar.isPending ? "animate-spin" : ""}`} />
            <span className="hidden sm:inline">Atualizar</span>
          </Button>
          <Button variant="outline" size="sm" onClick={() => marcarTodas.mutate()}
                  className="flex-1 sm:flex-initial h-10 sm:h-9">
            <CheckCheck className="h-4 w-4 sm:mr-2" />
            <span className="hidden sm:inline">Tudo lido</span>
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:flex sm:flex-wrap gap-2">
        <Select value={filterSev} onValueChange={(v) => setFilterSev(v as SevFilter)}>
          <SelectTrigger className="w-full sm:w-[180px] h-10 sm:h-9">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas severidades</SelectItem>
            <SelectItem value="critical">Crítico</SelectItem>
            <SelectItem value="warning">Atenção</SelectItem>
            <SelectItem value="info">Info</SelectItem>
            <SelectItem value="success">Sucesso</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filterLida} onValueChange={(v) => setFilterLida(v as LidaFilter)}>
          <SelectTrigger className="w-full sm:w-[160px] h-10 sm:h-9">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas</SelectItem>
            <SelectItem value="nao_lidas">Não lidas</SelectItem>
            <SelectItem value="lidas">Lidas</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="py-12 text-center text-muted-foreground">Carregando...</div>
      ) : filtradas.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Bell className="h-10 w-10 mx-auto text-muted-foreground/40 mb-3" />
            <p className="text-muted-foreground">Nenhuma notificação</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {filtradas.map((n) => {
            const sev = SEVERIDADE_INFO[n.severidade] ?? SEVERIDADE_INFO.info;
            const Icon = sev.icon;
            return (
              <Card
                key={n.id}
                className={`cursor-pointer hover:bg-accent/30 transition-colors ${n.lida ? "opacity-60" : ""}`}
                onClick={() => handleClick(n)}
              >
                <CardContent className="p-4 flex items-start gap-3">
                  <div className={`p-2 rounded-md shrink-0 ${sev.bg}`}>
                    <Icon className={`h-4 w-4 ${sev.color}`} />
                  </div>
                  <div className="flex-1 min-w-0 space-y-1">
                    <div className="flex items-start justify-between gap-2">
                      <p className="font-medium text-sm break-words flex-1 min-w-0">{n.titulo}</p>
                      <span className="text-[11px] text-muted-foreground shrink-0 tabular-nums">
                        {new Date(n.created_at).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })}
                        {" "}
                        {new Date(n.created_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground break-words leading-relaxed">{n.mensagem}</p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {!n.lida && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={(e) => {
                          e.stopPropagation();
                          marcar.mutate({ id: n.id, acao: "lida" });
                        }}
                        title="Marcar como lida"
                      >
                        <Check className="h-4 w-4" />
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={(e) => {
                        e.stopPropagation();
                        marcar.mutate({ id: n.id, acao: "arquivar" });
                      }}
                      title="Arquivar"
                    >
                      <Archive className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
