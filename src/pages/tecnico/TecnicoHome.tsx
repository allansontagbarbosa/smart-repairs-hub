import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useTecnicoIdentidade, useMinhasOS, useTecnicoMetricas } from "@/hooks/useTecnico";
import { useMinhasComissoesResumo } from "@/hooks/useMinhasComissoes";
import { useMeusServicosEmAndamento } from "@/hooks/useServicosDisponiveis";
import { ChevronRight, ClipboardList, CheckCircle2, Clock, DollarSign, Wrench, AlertTriangle, Trophy } from "lucide-react";
import { statusLabels } from "@/lib/status";
import { startOfDay, differenceInCalendarDays } from "date-fns";

const LIMITE_SIMULTANEO = 5;

function tempoDesde(iso: string | null | undefined) {
  if (!iso) return "agora";
  const min = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 60000));
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h}h ${min % 60}min`;
  return `${Math.floor(h / 24)}d ${h % 24}h`;
}

function diasAtraso(previsao: string | null | undefined) {
  if (!previsao) return 0;
  const d = new Date(previsao);
  const hoje = startOfDay(new Date());
  if (d.getTime() >= hoje.getTime()) return 0;
  return differenceInCalendarDays(hoje, d);
}

export default function TecnicoHome() {
  const { data: identidade } = useTecnicoIdentidade();
  const { data: ordens = [] } = useMinhasOS(identidade?.funcionario_id);
  const now = new Date();
  const { data: metricas } = useTecnicoMetricas(identidade?.funcionario_id, now.getFullYear(), now.getMonth() + 1);
  const { data: comissoesResumo } = useMinhasComissoesResumo(identidade?.funcionario_id);
  const { data: emAndamento = [] } = useMeusServicosEmAndamento(identidade?.funcionario_id);
  const servicoAtual: any = emAndamento[0];

  const proximas = ordens
    .filter(o => !["entregue", "cancelado"].includes(o.status))
    .slice(0, 5);

  return (
    <div className="space-y-5">
      <div>
        <p className="text-sm text-muted-foreground">Olá,</p>
        <h1 className="text-2xl font-semibold tracking-tight">{identidade?.nome?.split(" ")[0] || "Técnico"} 👋</h1>
      </div>

      {servicoAtual && (
        <Link to={`/tecnico/ordens/${servicoAtual.ordens_de_servico?.id}`} className="block">
          <Card className="border-primary/30 bg-primary/5 transition-colors hover:bg-primary/10">
            <CardContent className="p-3 flex items-center gap-3">
              <div className="h-10 w-10 rounded-md bg-primary text-primary-foreground grid place-items-center shrink-0">
                <Wrench className="h-5 w-5" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[11px] font-medium text-primary uppercase tracking-wide">Em andamento</p>
                <p className="text-sm font-semibold truncate">{servicoAtual.nome}</p>
                <p className="text-xs text-muted-foreground truncate">
                  #{servicoAtual.ordens_de_servico?.numero_formatado || servicoAtual.ordens_de_servico?.numero}
                  {" · há "}{tempoDesde(servicoAtual.iniciado_em)}
                  {emAndamento.length > 1 ? ` · +${emAndamento.length - 1} outros` : ""}
                </p>
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </CardContent>
          </Card>
        </Link>
      )}

      {emAndamento.length > LIMITE_SIMULTANEO && (
        <Card className="border-destructive/30 bg-destructive/5">
          <CardContent className="p-3 flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
            <div className="min-w-0">
              <p className="text-sm font-semibold">Você tem {emAndamento.length} serviços em andamento</p>
              <p className="text-xs text-muted-foreground">
                Considere concluir alguns antes de pegar novos.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-2 gap-3">
        <KpiCard icon={CheckCircle2} label="Concluídos hoje" value={metricas?.servicos_concluidos_hoje ?? 0} />
        <KpiCard icon={Wrench} label="Concluídos/mês" value={metricas?.servicos_no_mes ?? 0} />
        <KpiCard icon={Clock} label="Em andamento" value={metricas?.os_em_aberto ?? 0} />
        <Link to="/tecnico/comissoes" className="block">
          <KpiCard
            icon={DollarSign}
            label="Total a receber"
            value={(comissoesResumo?.totalReceber ?? 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
            helper={`Pago: ${(comissoesResumo?.totalPaga ?? 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}`}
            small
            interactive
          />
        </Link>
      </div>

      <section className="space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold">Próximas OS</h2>
          <Link to="/tecnico/ordens" className="text-xs text-primary">Ver todas</Link>
        </div>

        {proximas.length === 0 ? (
          <Card><CardContent className="py-8 text-center text-sm text-muted-foreground">
            <ClipboardList className="h-8 w-8 mx-auto mb-2 opacity-50" />
            Nenhuma OS pendente. Bom trabalho!
          </CardContent></Card>
        ) : (
          <div className="space-y-2">
            {proximas.map(os => {
              const atraso = diasAtraso(os.previsao_entrega);
              return (
                <Link key={os.id} to={`/tecnico/ordens/${os.id}`}>
                  <Card className="hover:bg-accent/50 transition-colors">
                    <CardContent className="p-3 flex items-center gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs font-mono text-muted-foreground">
                            #{os.numero_formatado || os.numero}
                          </span>
                          <Badge variant="outline" className="text-[10px]">{statusLabels[os.status as keyof typeof statusLabels] ?? os.status}</Badge>
                          {atraso > 0 && (
                            <Badge variant="destructive" className="text-[10px]">
                              Atrasado há {atraso} {atraso === 1 ? "dia" : "dias"}
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm font-medium truncate">
                          {os.aparelhos?.marca} {os.aparelhos?.modelo}
                        </p>
                        <p className="text-xs text-muted-foreground truncate">
                          {os.clientes?.nome} · {os.defeito_relatado || "Sem defeito relatado"}
                        </p>
                      </div>
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    </CardContent>
                  </Card>
                </Link>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}

function KpiCard({ icon: Icon, label, value, helper, small, interactive }: { icon: any; label: string; value: any; helper?: string; small?: boolean; interactive?: boolean }) {
  return (
    <Card className={interactive ? "transition-colors hover:bg-accent/50" : undefined}>
      <CardContent className="p-3">
        <Icon className="h-4 w-4 text-muted-foreground mb-1" />
        <p className={small ? "text-sm font-semibold leading-tight" : "text-xl font-semibold leading-tight"}>{value}</p>
        <p className="text-[11px] text-muted-foreground leading-tight">{label}</p>
        {helper && <p className="text-[10px] text-muted-foreground leading-tight mt-1">{helper}</p>}
      </CardContent>
    </Card>
  );
}
