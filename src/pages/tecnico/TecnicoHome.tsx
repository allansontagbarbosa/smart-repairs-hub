import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import {
  ChevronRight, ClipboardList, CheckCircle2, Clock, DollarSign,
  Wrench, AlertTriangle, Trophy, Target, TrendingUp, Flame,
  Medal, ShieldCheck, Pause, Play, History, ArrowLeftRight,
  Package, Coffee, BarChart3, RefreshCw
} from "lucide-react";
import {
  useTecnicoIdentidade, useMinhasOS,
} from "@/hooks/useTecnico";
import { useMinhasComissoesResumo } from "@/hooks/useMinhasComissoes";
import { useMeusServicosEmAndamento } from "@/hooks/useServicosDisponiveis";
import {
  useTecnicoKpisAvancado, useMinhaSessao,
  useTrocarMeuStatus, usePegarOS
} from "@/hooks/useTecnicoPainel";
import { statusLabels } from "@/lib/status";
import {
  calcularUrgencia, ordenarPorUrgencia,
  calcularConquistas, formatarTempoMin, type UrgenciaOS
} from "@/lib/tecnico-helpers";
import { startOfDay, differenceInCalendarDays, format } from "date-fns";
import { ptBR } from "date-fns/locale";

const LIMITE_SIMULTANEO = 5;

function CronometroVivo({ iniciadoEm }: { iniciadoEm: string | null | undefined }) {
  const [agora, setAgora] = useState(() => Date.now());
  useEffect(() => {
    if (!iniciadoEm) return;
    const id = setInterval(() => setAgora(Date.now()), 1000);
    return () => clearInterval(id);
  }, [iniciadoEm]);
  if (!iniciadoEm) return <span>agora</span>;
  const inicio = new Date(iniciadoEm).getTime();
  const diffSec = Math.max(0, Math.floor((agora - inicio) / 1000));
  const h = Math.floor(diffSec / 3600);
  const m = Math.floor((diffSec % 3600) / 60);
  const s = diffSec % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  if (h > 0) return <span>{pad(h)}:{pad(m)}:{pad(s)}</span>;
  return <span>{pad(m)}:{pad(s)}</span>;
}

function tempoDesde(iso: string | null | undefined) {
  if (!iso) return "agora";
  const min = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 60000));
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h}h ${min % 60}min`;
  return `${Math.floor(h / 24)}d ${h % 24}h`;
}

function saudacao(): string {
  const h = new Date().getHours();
  if (h < 12) return "Bom dia";
  if (h < 18) return "Boa tarde";
  return "Boa noite";
}

const ICONES_CONQUISTA: Record<string, any> = { Flame, Trophy, Medal, ShieldCheck, TrendingUp };

export default function TecnicoHome() {
  const { data: identidade } = useTecnicoIdentidade();
  const { data: ordens = [] } = useMinhasOS(identidade?.funcionario_id);
  const { data: kpis } = useTecnicoKpisAvancado(identidade?.funcionario_id);
  const { data: comissoesResumo } = useMinhasComissoesResumo(identidade?.funcionario_id);
  const { data: emAndamento = [] } = useMeusServicosEmAndamento(identidade?.funcionario_id);
  const { data: sessao } = useMinhaSessao();
  const trocarStatus = useTrocarMeuStatus();
  const pegarOS = usePegarOS();

  const now = new Date();
  const servicoAtual: any = emAndamento[0];

  const { data: ranking = [] } = useQuery<Array<{ tecnico_id: string; nome: string; qtd: number }>>({
    queryKey: ["ranking-equipe-mes", identidade?.empresa_id, now.getFullYear(), now.getMonth() + 1],
    enabled: !!identidade?.empresa_id,
    queryFn: async () => {
      const inicio = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
      const fim = new Date(now.getFullYear(), now.getMonth() + 1, 1).toISOString();
      const { data } = await supabase
        .from("os_servicos")
        .select("tecnico_id, funcionarios!inner(nome)")
        .eq("empresa_id", identidade!.empresa_id!)
        .eq("status", "concluido")
        .not("tecnico_id", "is", null)
        .gte("concluido_em", inicio)
        .lt("concluido_em", fim);

      const contagem = new Map<string, { nome: string; qtd: number }>();
      (data ?? []).forEach((s: any) => {
        const cur = contagem.get(s.tecnico_id) ?? { nome: s.funcionarios?.nome ?? "—", qtd: 0 };
        cur.qtd += 1;
        contagem.set(s.tecnico_id, cur);
      });
      return Array.from(contagem.entries())
        .map(([id, v]) => ({ tecnico_id: id, ...v }))
        .sort((a, b) => b.qtd - a.qtd);
    },
  });

  const minhaPosicao = ranking.findIndex(r => r.tecnico_id === identidade?.funcionario_id) + 1;
  const proximoNaFrente = minhaPosicao > 1 ? ranking[minhaPosicao - 2] : null;
  const minhaQtd = ranking.find(r => r.tecnico_id === identidade?.funcionario_id)?.qtd ?? 0;

  const proximas = ordenarPorUrgencia(
    ordens.filter(o => !["entregue", "cancelado"].includes(o.status))
  ).slice(0, 6);

  const conquistas = kpis ? calcularConquistas(kpis) : [];

  const metaQtd = kpis?.meta?.meta_qtd_os ?? 0;
  const pctMeta = metaQtd > 0 ? Math.min(100, Math.round(((kpis?.qtd_concluidas ?? 0) / metaQtd) * 100)) : 0;

  const statusAtual = sessao?.status ?? "encerrado";
  const trabalhando = statusAtual === "trabalhando";

  const onTrocar = (s: "trabalhando" | "pausa" | "almoco" | "encerrado") => {
    trocarStatus.mutate(s, {
      onSuccess: () => toast.success(`Status atualizado: ${s}`),
      onError: (e: any) => toast.error(e.message),
    });
  };

  const onPegar = (osId: string) => {
    pegarOS.mutate(osId, {
      onSuccess: () => toast.success("OS atribuída a você"),
      onError: (e: any) => toast.error(e.message),
    });
  };

  return (
    <div className="space-y-5">
      {/* HEADER PESSOAL */}
      <Card>
        <CardContent className="p-4 space-y-4">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div>
              <p className="text-xs text-muted-foreground capitalize">
                {format(now, "EEEE, d 'de' MMMM", { locale: ptBR })}
              </p>
              <h1 className="text-xl font-semibold tracking-tight">
                {saudacao()}, {identidade?.nome?.split(" ")[0] || "Técnico"}
              </h1>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              {trabalhando ? (
                <>
                  <Button size="sm" variant="outline" onClick={() => onTrocar("pausa")}>
                    <Pause className="h-4 w-4 mr-1" /> Pausar
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => onTrocar("almoco")}>
                    <Coffee className="h-4 w-4 mr-1" /> Almoço
                  </Button>
                </>
              ) : (
                <Button size="sm" onClick={() => onTrocar("trabalhando")}>
                  <Play className="h-4 w-4 mr-1" />
                  {statusAtual === "encerrado" ? "Começar" : "Voltar"}
                </Button>
              )}
              <Badge variant={trabalhando ? "default" : "outline"} className="capitalize">
                {statusAtual}
              </Badge>
            </div>
          </div>

          {servicoAtual && (
            <Link to={`/tecnico/ordens/${servicoAtual.ordens_de_servico?.id}`} className="block">
              <div className="rounded-md border border-primary/30 bg-primary/5 p-3 flex items-center gap-3 hover:bg-primary/10 transition-colors">
                <div className="h-10 w-10 rounded-md bg-primary text-primary-foreground grid place-items-center shrink-0">
                  <Wrench className="h-5 w-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[11px] font-medium text-primary uppercase tracking-wide">Em andamento</p>
                  <p className="text-sm font-semibold truncate">{servicoAtual.nome}</p>
                  <p className="text-xs text-muted-foreground truncate">
                    #{servicoAtual.ordens_de_servico?.numero_formatado || servicoAtual.ordens_de_servico?.numero}
                    {" · há "}<CronometroVivo iniciadoEm={servicoAtual.iniciado_em} />
                    {emAndamento.length > 1 ? ` · +${emAndamento.length - 1} outros` : ""}
                  </p>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </div>
            </Link>
          )}
        </CardContent>
      </Card>

      {emAndamento.length > LIMITE_SIMULTANEO && (
        <Card className="border-destructive/30 bg-destructive/5">
          <CardContent className="p-3 flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
            <div className="min-w-0">
              <p className="text-sm font-semibold">Você tem {emAndamento.length} serviços em andamento</p>
              <p className="text-xs text-muted-foreground">Considere concluir alguns antes de pegar novos.</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* KPIs DO MÊS */}
      <section className="space-y-2">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground capitalize">
          {format(now, "MMMM yyyy", { locale: ptBR })}
        </h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <KpiCard
            icon={CheckCircle2}
            label="Concluídas"
            value={kpis?.qtd_concluidas ?? 0}
            sub={
              kpis?.variacao_pct_vs_mes_passado != null
                ? `${kpis.variacao_pct_vs_mes_passado > 0 ? "+" : ""}${Math.round(kpis.variacao_pct_vs_mes_passado)}% vs mês passado`
                : `${kpis?.qtd_concluidas_hoje ?? 0} hoje`
            }
            subPositive={kpis?.variacao_pct_vs_mes_passado != null && kpis.variacao_pct_vs_mes_passado > 0}
          />
          <KpiCard
            icon={Clock}
            label="Tempo médio"
            value={formatarTempoMin(kpis?.tempo_medio_min ?? 0)}
            sub="por serviço"
          />
          <KpiCard
            icon={RefreshCw}
            label="Retrabalho"
            value={`${kpis?.taxa_retrabalho_pct ?? 0}%`}
            sub="OS reabertas"
          />
          <Link to="/tecnico/comissoes" className="block">
            <KpiCard
              icon={DollarSign}
              label="A receber"
              value={(comissoesResumo?.totalReceber ?? 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
              sub={`Pago: ${(comissoesResumo?.totalPaga ?? 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}`}
              small
              interactive
            />
          </Link>
        </div>
      </section>

      {/* META + RANKING */}
      <div className="grid md:grid-cols-2 gap-3">
        {metaQtd > 0 && (
          <Card>
            <CardContent className="p-4 space-y-3">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 text-sm font-semibold">
                  <Target className="h-4 w-4 text-primary" /> Meta do mês
                </div>
                <span className="text-xs text-muted-foreground">
                  {kpis?.qtd_concluidas ?? 0} / {metaQtd} OS
                </span>
              </div>
              <Progress value={pctMeta} className="h-2" />
              <p className="text-xs text-muted-foreground">
                {pctMeta}% atingido · faltam {Math.max(0, metaQtd - (kpis?.qtd_concluidas ?? 0))} OS
              </p>
            </CardContent>
          </Card>
        )}

        {minhaPosicao > 0 && ranking.length > 1 && (
          <Card className="border-warning/30 bg-warning/5">
            <CardContent className="p-4 space-y-2">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 text-sm font-semibold">
                  <Trophy className="h-4 w-4 text-warning" /> Sua posição
                </div>
                <Badge variant="outline">{minhaPosicao}º de {ranking.length}</Badge>
              </div>
              <p className="text-2xl font-semibold leading-none">{minhaPosicao}º <span className="text-sm font-normal text-muted-foreground">no ranking</span></p>
              <p className="text-xs text-muted-foreground">
                {minhaPosicao === 1
                  ? `Liderando com ${minhaQtd} serviços!`
                  : proximoNaFrente
                  ? `Faltam ${proximoNaFrente.qtd - minhaQtd + 1} pra ultrapassar ${proximoNaFrente.nome.split(" ")[0]}`
                  : `${minhaQtd} serviços`}
              </p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* FILA DE OS PRIORIZADA */}
      <section className="space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold flex items-center gap-2">
            <ClipboardList className="h-4 w-4" /> Próximas OS · priorizadas
          </h2>
          <Link to="/tecnico/ordens" className="text-xs text-primary">Ver todas</Link>
        </div>

        {proximas.length === 0 ? (
          <Card><CardContent className="py-8 text-center text-sm text-muted-foreground">
            <ClipboardList className="h-8 w-8 mx-auto mb-2 opacity-50" />
            Nenhuma OS pendente. Bom trabalho!
          </CardContent></Card>
        ) : (
          <div className="space-y-2">
            {proximas.map((os: any) => {
              const urgencia = calcularUrgencia(os);
              const atraso = os.previsao_entrega
                ? differenceInCalendarDays(startOfDay(new Date()), new Date(os.previsao_entrega))
                : 0;
              return (
                <Card key={os.id} className="hover:bg-accent/50 transition-colors">
                  <CardContent className="p-3 flex items-center gap-3">
                    <Link to={`/tecnico/ordens/${os.id}`} className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-mono text-muted-foreground">
                          #{os.numero_formatado || os.numero}
                        </span>
                        <Badge variant="outline" className="text-[10px]">
                          {statusLabels[os.status as keyof typeof statusLabels] ?? os.status}
                        </Badge>
                        <UrgenciaBadge urgencia={urgencia} atraso={atraso} />
                      </div>
                      <p className="text-sm font-medium truncate mt-1">
                        {os.aparelhos?.marca} {os.aparelhos?.modelo}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">
                        {os.clientes?.nome} · {os.defeito_relatado || "Sem defeito relatado"}
                      </p>
                    </Link>
                    {urgencia !== "aguardando_peca" && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={(e) => { e.preventDefault(); onPegar(os.id); }}
                        disabled={pegarOS.isPending}
                      >
                        Pegar
                      </Button>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </section>

      {/* CONQUISTAS + ATALHOS */}
      <div className="grid md:grid-cols-2 gap-3">
        <Card>
          <CardContent className="p-4 space-y-3">
            <h3 className="text-sm font-semibold flex items-center gap-2">
              <Trophy className="h-4 w-4 text-warning" /> Conquistas recentes
            </h3>
            {conquistas.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                Continue trabalhando — conquistas aparecem aqui quando você bate marcos.
              </p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {conquistas.map((c, i) => {
                  const Icone = ICONES_CONQUISTA[c.icone] ?? Trophy;
                  return (
                    <div key={i} className="flex items-center gap-1.5 rounded-full border bg-accent/40 px-3 py-1 text-xs">
                      <Icone className="h-3.5 w-3.5" />
                      {c.label}
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 space-y-3">
            <h3 className="text-sm font-semibold">Atalhos</h3>
            <div className="grid grid-cols-2 gap-2">
              <Link to="/tecnico/comissoes" className="flex items-center gap-2 rounded-md border p-2 text-xs hover:bg-accent/50">
                <DollarSign className="h-4 w-4" /> Comissões
              </Link>
              <Link to="/tecnico/historico" className="flex items-center gap-2 rounded-md border p-2 text-xs hover:bg-accent/50">
                <History className="h-4 w-4" /> Histórico
              </Link>
              <Link to="/tecnico/transferencias" className="flex items-center gap-2 rounded-md border p-2 text-xs hover:bg-accent/50">
                <ArrowLeftRight className="h-4 w-4" /> Transferências
              </Link>
              <Link to="/tecnico/metas" className="flex items-center gap-2 rounded-md border p-2 text-xs hover:bg-accent/50">
                <BarChart3 className="h-4 w-4" /> Minha meta
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function KpiCard({
  icon: Icon, label, value, sub, subPositive, small, interactive
}: {
  icon: any; label: string; value: any; sub?: string;
  subPositive?: boolean; small?: boolean; interactive?: boolean;
}) {
  return (
    <Card className={interactive ? "transition-colors hover:bg-accent/50" : undefined}>
      <CardContent className="p-3">
        <Icon className="h-4 w-4 text-muted-foreground mb-1" />
        <p className={small ? "text-sm font-semibold leading-tight" : "text-xl font-semibold leading-tight"}>
          {value}
        </p>
        <p className="text-[11px] text-muted-foreground leading-tight">{label}</p>
        {sub && (
          <p className={`text-[10px] leading-tight mt-1 ${subPositive ? "text-success" : "text-muted-foreground"}`}>
            {sub}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function UrgenciaBadge({ urgencia, atraso }: { urgencia: UrgenciaOS; atraso: number }) {
  if (urgencia === "atrasada") {
    return (
      <Badge variant="destructive" className="text-[10px]">
        Atrasada {atraso}d
      </Badge>
    );
  }
  if (urgencia === "vence_hoje") {
    return (
      <Badge className="text-[10px] bg-warning text-warning-foreground hover:bg-warning/90">
        Hoje
      </Badge>
    );
  }
  if (urgencia === "aguardando_peca") {
    return (
      <Badge variant="outline" className="text-[10px]">
        <Package className="h-3 w-3 mr-1" /> Aguarda peça
      </Badge>
    );
  }
  return <Badge variant="outline" className="text-[10px]">Normal</Badge>;
}
