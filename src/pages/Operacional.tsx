import { useMemo, useRef, useState, useEffect, DragEvent } from "react";
import { useQuery, useMutation, useQueryClient, useInfiniteQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Search, Loader2, Clock, AlertTriangle, MoreVertical,
  Inbox, Stethoscope, FileCheck2, Wrench, PackageSearch, Truck,
  ShieldCheck, CheckCircle2, PackageCheck, Smartphone, Laptop, Tablet,
  Gamepad2, Plus, Users, TrendingUp, Star, Timer,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { OrdemDetalheSheet } from "@/components/OrdemDetalheSheet";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { calcularPrioridade } from "@/lib/prioridade";
import { statusLabels, type Status } from "@/lib/status";
import { invalidateOrdensDependentes } from "@/lib/cacheInvalidation";
import { DittLogo } from "@/components/DittLogo";
import { atribuirTodaOSAoTecnico } from "@/hooks/useAtualizarTecnicoServico";
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent,
  DropdownMenuItem, DropdownMenuSub, DropdownMenuSubTrigger,
  DropdownMenuSubContent, DropdownMenuPortal, DropdownMenuSeparator,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import { useNavigate } from "react-router-dom";

// ============================================================
// Coluna do painel (etapa) -> 1+ status reais
// ============================================================
type ColunaDef = {
  key: string;
  nome: string;
  subtitulo: string;
  icon: React.ReactNode;
  statuses: Status[];
  /** Status alvo quando o card é solto/movido para esta etapa */
  alvo: Status;
  /** Acento HSL (header + dot + ring) */
  accent: { header: string; dot: string; ring: string; text: string };
};

const ACCENTS = {
  blue:   { header: "bg-[hsl(210_85%_56%/0.18)]", dot: "bg-[hsl(210_85%_56%)]", ring: "ring-[hsl(210_85%_56%/0.45)]", text: "text-[hsl(210_85%_70%)]" },
  amber:  { header: "bg-[hsl(34_92%_56%/0.18)]",  dot: "bg-[hsl(34_92%_56%)]",  ring: "ring-[hsl(34_92%_56%/0.45)]",  text: "text-[hsl(34_92%_66%)]"  },
  violet: { header: "bg-[hsl(270_72%_64%/0.18)]", dot: "bg-[hsl(270_72%_64%)]", ring: "ring-[hsl(270_72%_64%/0.45)]", text: "text-[hsl(270_72%_75%)]" },
  green:  { header: "bg-[hsl(165_100%_39%/0.18)]",dot: "bg-[hsl(165_100%_39%)]",ring: "ring-[hsl(165_100%_39%/0.45)]",text: "text-[hsl(165_100%_50%)]" },
  cyan:   { header: "bg-[hsl(190_85%_50%/0.18)]", dot: "bg-[hsl(190_85%_50%)]", ring: "ring-[hsl(190_85%_50%/0.45)]", text: "text-[hsl(190_85%_60%)]" },
  gray:   { header: "bg-muted/60",                 dot: "bg-muted-foreground",   ring: "ring-muted-foreground/40",     text: "text-muted-foreground"   },
};

const COLUNAS: ColunaDef[] = [
  { key: "recebido",     nome: "Recebido",            subtitulo: "Aguardando triagem",  icon: <Inbox className="h-3.5 w-3.5" />,       statuses: ["recebido"],                          alvo: "recebido",            accent: ACCENTS.blue   },
  { key: "em_analise",   nome: "Em análise",          subtitulo: "Diagnosticando",      icon: <Stethoscope className="h-3.5 w-3.5" />, statuses: ["em_analise"],                        alvo: "em_analise",          accent: ACCENTS.blue   },
  { key: "aprovacao",    nome: "Orçamento/Aprovação", subtitulo: "Aguardando aprovação",icon: <FileCheck2 className="h-3.5 w-3.5" />,  statuses: ["aguardando_aprovacao", "aprovado"],  alvo: "aguardando_aprovacao",accent: ACCENTS.amber  },
  { key: "em_reparo",    nome: "Em reparo",           subtitulo: "Trabalho ativo",      icon: <Wrench className="h-3.5 w-3.5" />,      statuses: ["em_reparo"],                         alvo: "em_reparo",           accent: ACCENTS.amber  },
  { key: "aguardando_peca", nome: "Aguardando peça",  subtitulo: "Peça a caminho",      icon: <PackageSearch className="h-3.5 w-3.5"/>,statuses: ["aguardando_peca"],                   alvo: "aguardando_peca",     accent: ACCENTS.green  },
  { key: "terceirizado", nome: "Terceiro / Na rua",   subtitulo: "No técnico externo",  icon: <Truck className="h-3.5 w-3.5" />,       statuses: ["terceirizado"],                      alvo: "terceirizado",        accent: ACCENTS.violet },
  { key: "garantia",     nome: "Garantia",            subtitulo: "Em garantia",         icon: <ShieldCheck className="h-3.5 w-3.5" />, statuses: ["garantia"],                          alvo: "garantia",            accent: ACCENTS.cyan   },
  { key: "pronto",       nome: "Pronto",              subtitulo: "Aguardando retirada", icon: <CheckCircle2 className="h-3.5 w-3.5" />,statuses: ["pronto"],                            alvo: "pronto",              accent: ACCENTS.green  },
  { key: "entregue",     nome: "Entregue",            subtitulo: "Finalizado",          icon: <PackageCheck className="h-3.5 w-3.5" />,statuses: ["entregue"],                          alvo: "entregue",            accent: ACCENTS.gray   },
];

const STATUS_MAPEADOS = new Set<Status>(COLUNAS.flatMap((c) => c.statuses));

// Cor estável por técnico (HSL — distribui no círculo). Usa style inline
// porque Tailwind JIT não compila classes dinâmicas com interpolação.
function colorForTec(id: string): { dot: React.CSSProperties; bg: React.CSSProperties; hue: number } {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  const hue = h % 360;
  return {
    dot: { backgroundColor: `hsl(${hue} 72% 55%)` },
    bg:  { backgroundColor: `hsl(${hue} 72% 55% / 0.18)` },
    hue,
  };
}

function iconAparelho(tipo?: string | null) {
  const t = (tipo ?? "").toLowerCase();
  if (t.includes("note") || t.includes("laptop")) return <Laptop className="h-3.5 w-3.5" />;
  if (t.includes("tablet") || t.includes("ipad")) return <Tablet className="h-3.5 w-3.5" />;
  if (t.includes("console") || t.includes("game") || t.includes("xbox") || t.includes("play")) return <Gamepad2 className="h-3.5 w-3.5" />;
  return <Smartphone className="h-3.5 w-3.5" />;
}

function daysBetween(a: string, b?: string | null) {
  const t1 = new Date(a).getTime();
  const t2 = b ? new Date(b).getTime() : Date.now();
  return Math.max(0, Math.floor((t2 - t1) / 86_400_000));
}

function iniciais(nome: string) {
  return nome
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

const ATIVOS: Status[] = [
  "recebido", "em_analise", "aguardando_aprovacao", "aprovado",
  "em_reparo", "aguardando_peca", "terceirizado", "garantia", "pronto",
];

const OS_SELECT = `*, aparelhos ( marca, modelo, tipo, clientes ( nome, telefone ) ), os_servicos ( id, tecnico_id, funcionarios ( id, nome ) )`;

async function fetchActiveOrders() {
  const { data, error } = await supabase
    .from("ordens_de_servico")
    .select(OS_SELECT)
    .in("status", ATIVOS)
    .order("data_entrada", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

const PAGE_ENTREGUES = 50;
async function fetchEntreguesPage(offset: number) {
  const { data, error } = await supabase
    .from("ordens_de_servico")
    .select(OS_SELECT)
    .eq("status", "entregue")
    .order("data_entrada", { ascending: false })
    .range(offset, offset + PAGE_ENTREGUES - 1);
  if (error) throw error;
  return data ?? [];
}

function tecsDe(order: any): { id: string; nome: string }[] {
  const out = new Map<string, string>();
  ((order.os_servicos ?? []) as any[]).forEach((s) => {
    if (s.funcionarios?.id) out.set(s.funcionarios.id, s.funcionarios.nome);
  });
  return Array.from(out, ([id, nome]) => ({ id, nome }));
}

export default function Operacional() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [busca, setBusca] = useState<Record<string, string>>({});
  const [dragOver, setDragOver] = useState<string | null>(null);
  const dragRef = useRef<{ id: string } | null>(null);

  // ============== OS ATIVAS (sem filtro de período) ==============
  const { data: activeOrders = [], isLoading } = useQuery({
    queryKey: ["ordens", "ativas"],
    queryFn: fetchActiveOrders,
  });

  useEffect(() => {
    if (!isLoading) console.debug("[Operacional] OS ativas pós-fetch:", (activeOrders as any[]).length);
  }, [activeOrders, isLoading]);

  // ============== OS ENTREGUES (scroll infinito, sem filtro de período) ==============
  const entreguesQuery = useInfiniteQuery({
    queryKey: ["ordens", "entregues", "infinite"],
    queryFn: ({ pageParam = 0 }) => fetchEntreguesPage(pageParam as number),
    initialPageParam: 0,
    getNextPageParam: (lastPage, allPages) => {
      if (!lastPage || lastPage.length < PAGE_ENTREGUES) return undefined;
      return allPages.reduce((acc, p) => acc + p.length, 0);
    },
  });
  const entreguesLoaded = useMemo(
    () => (entreguesQuery.data?.pages ?? []).flat() as any[],
    [entreguesQuery.data],
  );

  // Total real de entregues (para o contador do header da coluna)
  const { data: entreguesTotal = 0 } = useQuery({
    queryKey: ["ordens", "entregues", "count"],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("ordens_de_servico")
        .select("id", { count: "exact", head: true })
        .eq("status", "entregue");
      if (error) throw error;
      return count ?? 0;
    },
  });

  // Entregues do mês (para KPIs / resumo por técnico)
  const inicioMesIso = useMemo(() => {
    const d = new Date(); d.setDate(1); d.setHours(0, 0, 0, 0); return d.toISOString();
  }, []);
  const { data: entreguesMes = [] } = useQuery({
    queryKey: ["ordens", "entregues-mes", inicioMesIso],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ordens_de_servico")
        .select(`id, data_entrada, data_conclusao, status, os_servicos ( id, funcionarios ( id, nome ) )`)
        .eq("status", "entregue")
        .gte("data_conclusao", inicioMesIso);
      if (error) throw error;
      return data ?? [];
    },
  });

  // Combinado para reaproveitar lógica que precisa de ativas + entregues carregadas
  const orders = useMemo(
    () => [...(activeOrders as any[]), ...entreguesLoaded],
    [activeOrders, entreguesLoaded],
  );

  const { data: tecnicos = [] } = useQuery({
    queryKey: ["funcionarios", "tecnicos-operacional"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("funcionarios")
        .select("id, nome, cargo")
        .is("deleted_at", null)
        .eq("ativo", true)
        .order("nome");
      if (error) throw error;
      return (data ?? []).filter((f: any) => (f.cargo ?? "").toLowerCase().includes("tecnic"));
    },
  });

  // OS em 'aguardando_peca' sem peça em pecas_utilizadas (limbo)
  const { data: osSemPeca = [] } = useQuery({
    queryKey: ["os-aguardando-sem-peca"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("os_aguardando_sem_peca" as any);
      if (error) throw error;
      return ((data as any) ?? []) as Array<{ os_id: string }>;
    },
  });
  const osSemPecaSet = useMemo(
    () => new Set((osSemPeca as any[]).map((r) => r.os_id)),
    [osSemPeca],
  );

  const updateStatus = useMutation({
    mutationFn: async ({ id, newStatus }: { id: string; newStatus: Status }) => {
      const ordemAtual = (orders as any[]).find((o) => o.id === id);
      const now = new Date().toISOString();
      const updates: any = { status: newStatus };
      if (newStatus === "pronto" && !ordemAtual?.data_conclusao) updates.data_conclusao = now;
      if (newStatus === "aguardando_peca" && !ordemAtual?.pecas_pedido_em) {
        updates.pecas_pedido_em = now.slice(0, 10);
      }
      const { error } = await supabase.from("ordens_de_servico").update(updates).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      invalidateOrdensDependentes(queryClient);
      queryClient.invalidateQueries({ queryKey: ["os-aguardando-sem-peca"] });
      toast.success("Status atualizado");
    },
    onError: (err: any) => {
      const msg = err?.message || "Erro ao atualizar status";
      if (/peça/i.test(msg)) toast.error(msg, { duration: 6000 });
      else toast.error("Erro ao atualizar status");
    },
  });

  const atribuirTec = useMutation({
    mutationFn: async ({ ordemId, tecnicoId }: { ordemId: string; tecnicoId: string | null }) => {
      await atribuirTodaOSAoTecnico(ordemId, tecnicoId);
    },
    onSuccess: (_d, v) => {
      invalidateOrdensDependentes(queryClient);
      toast.success(v.tecnicoId ? "Técnico atribuído" : "Técnico removido");
    },
    onError: (err: any) => toast.error(err?.message || "Erro ao atribuir técnico"),
  });

  // ============== KPIs ==============
  const inicioMes = useMemo(() => new Date(inicioMesIso), [inicioMesIso]);

  const kpis = useMemo(() => {
    const ent = entreguesMes as any[];
    const tempos = ent
      .filter((o) => o.data_entrada && o.data_conclusao)
      .map((o) => daysBetween(o.data_entrada, o.data_conclusao));
    const tempoMedio = tempos.length
      ? Math.round((tempos.reduce((a, b) => a + b, 0) / tempos.length) * 10) / 10
      : null;

    // Taxa = entregues no mês / (entregues no mês + prontos do mês), aproximação sem cancelados
    const prontosMes = (activeOrders as any[]).filter(
      (o) => o.status === "pronto" && new Date(o.data_entrada) >= inicioMes,
    ).length;
    const concl = ent.length;
    const denom = concl + prontosMes;
    const taxa = denom > 0 ? Math.round((concl / denom) * 100) : null;

    return {
      tempoMedio,
      taxa,
      concluidasMes: concl,
    };
  }, [entreguesMes, activeOrders, inicioMes]);

  // ============== Drag & Drop (desktop) ==============
  const onDragStart = (e: DragEvent, id: string) => {
    dragRef.current = { id };
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", id);
    if (e.currentTarget instanceof HTMLElement) e.currentTarget.style.opacity = "0.5";
  };
  const onDragEnd = (e: DragEvent) => {
    if (e.currentTarget instanceof HTMLElement) e.currentTarget.style.opacity = "1";
    setDragOver(null);
    dragRef.current = null;
  };
  const onDragOver = (e: DragEvent, key: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDragOver(key);
  };
  const onDrop = (e: DragEvent, alvo: Status) => {
    e.preventDefault();
    setDragOver(null);
    if (!dragRef.current) return;
    const { id } = dragRef.current;
    const order = (orders as any[]).find((o) => o.id === id);
    if (!order || order.status === alvo) return;
    updateStatus.mutate({ id, newStatus: alvo });
  };

  const cardMatchesBusca = (o: any, q: string) => {
    if (!q) return true;
    const tnames = tecsDe(o).map((t) => t.nome).join(" ");
    const h = `${o.numero ?? ""} ${o.aparelhos?.clientes?.nome ?? ""} ${o.aparelhos?.marca ?? ""} ${o.aparelhos?.modelo ?? ""} ${o.defeito_relatado ?? ""} ${tnames}`.toLowerCase();
    return h.includes(q);
  };

  // ============== Agrupamento por coluna ==============
  // Sem filtro de período em nenhuma coluna.
  // - Ativas: vêm de activeOrders (todas, sem corte de data).
  // - Entregue: usa entreguesLoaded (paginado por scroll infinito), mas o contador
  //   do header mostra o TOTAL real (entreguesTotal).
  const colunasComDados = useMemo(() => {
    return COLUNAS.map((c) => {
      if (c.key === "entregue") {
        return { ...c, list: entreguesLoaded, total: entreguesTotal as number };
      }
      const list = (activeOrders as any[]).filter((o) => c.statuses.includes(o.status));
      return { ...c, list, total: list.length };
    });
  }, [activeOrders, entreguesLoaded, entreguesTotal]);

  const orfas = useMemo(() => {
    return (activeOrders as any[]).filter(
      (o) => !STATUS_MAPEADOS.has(o.status) && o.status !== "cancelado",
    );
  }, [activeOrders]);

  const ativas = useMemo(
    () => (activeOrders as any[]).filter((o) => o.status !== "entregue" && o.status !== "cancelado"),
    [activeOrders],
  );

  // OS ativas por técnico (para o chip do header)
  const ativasPorTec = useMemo(() => {
    const m = new Map<string, number>();
    ativas.forEach((o) => tecsDe(o).forEach((t) => m.set(t.id, (m.get(t.id) ?? 0) + 1)));
    return m;
  }, [ativas]);

  // Resumo por técnico no rodapé
  const resumoTecnicos = useMemo(() => {
    return (tecnicos as any[]).map((t) => {
      const minhasAtivas = (activeOrders as any[]).filter((o) =>
        tecsDe(o).some((x) => x.id === t.id),
      );
      const emAndamento = minhasAtivas.filter((o) =>
        ["em_reparo", "em_analise", "aguardando_aprovacao", "aprovado", "recebido"].includes(o.status),
      ).length;
      const aguardando = minhasAtivas.filter((o) =>
        ["aguardando_peca", "terceirizado", "garantia"].includes(o.status),
      ).length;
      const pronto = minhasAtivas.filter((o) => o.status === "pronto").length;
      const entregue = (entreguesMes as any[]).filter((o) =>
        tecsDe(o).some((x) => x.id === t.id),
      ).length;
      const ativasN = emAndamento + aguardando + pronto;
      return { ...t, emAndamento, aguardando, pronto, entregue, ativas: ativasN };
    }).sort((a, b) => b.ativas - a.ativas);
  }, [tecnicos, activeOrders, entreguesMes]);

  const maxAtivasTec = Math.max(1, ...resumoTecnicos.map((t) => t.ativas));

  // ============== Render do Card de OS ==============
  const renderCard = (order: any) => {
    const dias = daysBetween(order.data_entrada);
    const prio = calcularPrioridade(order.status, order.data_entrada, order.previsao_entrega);
    const isCritica = prio.nivel === "critica";
    const isAtencao = prio.nivel === "atencao";
    const tecs = tecsDe(order);
    const semPeca = order.status === "aguardando_peca" && osSemPecaSet.has(order.id);

    return (
      <div
        key={order.id}
        draggable
        onDragStart={(e) => onDragStart(e, order.id)}
        onDragEnd={onDragEnd}
        onClick={() => setSelectedOrderId(order.id)}
        className={cn(
          "group relative bg-card rounded-lg border p-2.5 space-y-1.5 transition-all hover:shadow-md select-none cursor-pointer",
          isCritica && "border-destructive/40 bg-destructive/5 ring-1 ring-destructive/20",
          isAtencao && !isCritica && "border-warning/40 ring-1 ring-warning/20",
        )}
      >
        {/* Linha topo: nº OS + ícone aparelho + menu */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="text-muted-foreground">{iconAparelho(order.aparelhos?.tipo)}</span>
            <span className="text-[10px] font-mono text-muted-foreground">
              #{String(order.numero).padStart(3, "0")}
            </span>
            {isCritica ? (
              <AlertTriangle className="h-3 w-3 text-destructive" />
            ) : isAtencao ? (
              <Clock className="h-3 w-3 text-warning" />
            ) : (
              <CheckCircle2 className="h-3 w-3 text-success/70" />
            )}
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger
              onClick={(e) => e.stopPropagation()}
              className="h-6 w-6 rounded hover:bg-accent inline-flex items-center justify-center text-muted-foreground opacity-60 group-hover:opacity-100 transition-opacity"
              aria-label="Ações da OS"
            >
              <MoreVertical className="h-4 w-4" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
              <DropdownMenuLabel className="text-[10px] uppercase tracking-wider text-muted-foreground">
                #{String(order.numero).padStart(3, "0")}
              </DropdownMenuLabel>
              <DropdownMenuItem onClick={() => setSelectedOrderId(order.id)}>
                Abrir detalhes
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuSub>
                <DropdownMenuSubTrigger>Mover para etapa</DropdownMenuSubTrigger>
                <DropdownMenuPortal>
                  <DropdownMenuSubContent>
                    {COLUNAS.map((c) => (
                      <DropdownMenuItem
                        key={c.key}
                        disabled={order.status === c.alvo}
                        onClick={() => updateStatus.mutate({ id: order.id, newStatus: c.alvo })}
                      >
                        <span className={cn("w-2 h-2 rounded-full mr-2", c.accent.dot)} />
                        {c.nome}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuSubContent>
                </DropdownMenuPortal>
              </DropdownMenuSub>
              <DropdownMenuSub>
                <DropdownMenuSubTrigger>Enviar para técnico</DropdownMenuSubTrigger>
                <DropdownMenuPortal>
                  <DropdownMenuSubContent>
                    {(tecnicos as any[]).map((t) => (
                      <DropdownMenuItem
                        key={t.id}
                        onClick={() => atribuirTec.mutate({ ordemId: order.id, tecnicoId: t.id })}
                      >
                        <span className="w-2 h-2 rounded-full mr-2 inline-block" style={colorForTec(t.id).dot} />
                        {t.nome}
                      </DropdownMenuItem>
                    ))}
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onClick={() => atribuirTec.mutate({ ordemId: order.id, tecnicoId: null })}
                      className="text-warning"
                    >
                      Remover técnico
                    </DropdownMenuItem>
                  </DropdownMenuSubContent>
                </DropdownMenuPortal>
              </DropdownMenuSub>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Aparelho + cliente */}
        <p className="text-sm font-medium leading-tight truncate">
          {order.aparelhos?.marca} {order.aparelhos?.modelo || "—"}
        </p>
        <p className="text-[11px] text-muted-foreground truncate">
          {order.aparelhos?.clientes?.nome ?? "—"}
        </p>
        <p className="text-[11px] text-muted-foreground line-clamp-1">
          {order.defeito_relatado || "—"}
        </p>

        {semPeca && (
          <div className="flex items-center gap-1 text-[10px] font-semibold text-warning">
            <AlertTriangle className="h-3 w-3" /> Peça não especificada
          </div>
        )}

        {/* Rodapé do card: técnico + tempo */}
        <div className="flex items-center justify-between pt-0.5">
          {tecs.length === 0 ? (
            <span className="inline-flex items-center gap-1 text-[10px] font-medium text-warning">
              <AlertTriangle className="h-2.5 w-2.5" /> sem técnico
            </span>
          ) : (
            <div className="flex items-center gap-1 min-w-0">
              <span className="w-2 h-2 rounded-full shrink-0" style={colorForTec(tecs[0].id).dot} />
              <span className="text-[10px] text-muted-foreground truncate" title={tecs.map((t) => t.nome).join(", ")}>
                {tecs[0].nome}{tecs.length > 1 ? ` +${tecs.length - 1}` : ""}
              </span>
            </div>
          )}
          <span className={cn(
            "inline-flex items-center gap-0.5 text-[10px]",
            isCritica ? "text-destructive font-medium" : isAtencao ? "text-warning font-medium" : "text-muted-foreground",
          )}>
            <Clock className="h-2.5 w-2.5" /> {dias}d
          </span>
        </div>
      </div>
    );
  };

  // ============== Render do painel ==============
  const colsRender: (ColunaDef & { list: any[] })[] = [
    ...colunasComDados,
    ...(orfas.length > 0
      ? [{
          key: "outros",
          nome: "Outros",
          subtitulo: "Status sem etapa",
          icon: <AlertTriangle className="h-3.5 w-3.5" />,
          statuses: [] as Status[],
          alvo: "recebido" as Status,
          accent: ACCENTS.gray,
          list: orfas,
        }]
      : []),
  ];

  return (
    <div className="space-y-4">
      {/* ============== CABEÇALHO ============== */}
      <div className="rounded-xl border bg-card/60 backdrop-blur p-3 md:p-4 flex flex-wrap items-center gap-3 md:gap-4">
        <div className="flex items-center gap-2 shrink-0">
          <DittLogo size="sm" iconOnly />
          <div className="leading-tight">
            <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Kanban</div>
            <div className="text-sm md:text-base font-semibold">Assistência Ditt</div>
          </div>
        </div>

        <div className="flex-1 min-w-0 overflow-x-auto">
          <div className="flex items-center gap-2">
            {(tecnicos as any[]).map((t) => {
              const c = colorForTec(t.id);
              const n = ativasPorTec.get(t.id) ?? 0;
              return (
                <div
                  key={t.id}
                  className="flex items-center gap-2 rounded-full pl-1 pr-3 py-1 border shrink-0"
                  style={c.bg}
                  title={`${t.nome} · ${n} OS ativas`}
                >
                  <span
                    className="inline-flex items-center justify-center h-6 w-6 rounded-full text-[10px] font-bold text-white"
                    style={c.dot}
                  >
                    {iniciais(t.nome)}
                  </span>
                  <div className="leading-tight">
                    <div className="text-[11px] font-semibold truncate max-w-[8rem]">{t.nome.split(" ")[0]}</div>
                    <div className="text-[10px] text-muted-foreground">{n} ativas</div>
                  </div>
                </div>
              );
            })}
            {(tecnicos as any[]).length === 0 && (
              <span className="text-xs text-muted-foreground italic">Nenhum técnico cadastrado</span>
            )}
          </div>
        </div>

        <div className="text-right shrink-0 hidden md:block">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Hoje</div>
          <div className="text-sm font-semibold tabular-nums">
            {new Date().toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit", month: "short" })}
          </div>
        </div>
      </div>

      {/* ============== COLUNAS ============== */}
      {isLoading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div
          className="flex gap-2.5 overflow-x-auto pb-4 -mx-4 px-4 md:-mx-6 md:px-6 lg:-mx-8 lg:px-8 snap-x"
          style={{ minHeight: "calc(100vh - 380px)" }}
        >
          {colsRender.map((col) => {
            const q = (busca[col.key] || "").toLowerCase().trim();
            const list = (col.list as any[]).filter((o) => cardMatchesBusca(o, q));
            const isDrop = dragOver === col.key;
            return (
              <div
                key={col.key}
                onDragOver={(e) => onDragOver(e, col.key)}
                onDragLeave={() => setDragOver(null)}
                onDrop={(e) => onDrop(e, col.alvo)}
                className={cn(
                  "flex-shrink-0 w-64 md:w-[17.5rem] rounded-xl border flex flex-col snap-start transition-all bg-muted/30",
                  isDrop && `ring-2 ${col.accent.ring} bg-primary/5`,
                )}
              >
                <div className={cn("px-3 py-2.5 rounded-t-xl", col.accent.header)}>
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className={cn("w-2 h-2 rounded-full shrink-0", col.accent.dot)} />
                      <span className="text-xs font-semibold truncate flex items-center gap-1.5">
                        {col.icon} {col.nome}
                      </span>
                    </div>
                    <span className="text-[11px] text-foreground/80 bg-background/80 rounded-full px-2 py-0.5 font-semibold tabular-nums">
                      {(col as any).total ?? col.list.length}
                    </span>
                  </div>
                  <div className="text-[10px] text-muted-foreground mt-0.5">{col.subtitulo}</div>
                </div>

                <div className="px-2 pt-2 flex items-center gap-1">
                  <div className="relative flex-1">
                    <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                    <Input
                      value={busca[col.key] ?? ""}
                      onChange={(e) => setBusca((p) => ({ ...p, [col.key]: e.target.value }))}
                      placeholder="Buscar…"
                      className="h-8 pl-7 text-xs"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => navigate("/assistencia?novo=1")}
                    className="h-8 w-8 inline-flex items-center justify-center rounded-md border bg-background hover:bg-accent shrink-0"
                    title="Adicionar OS"
                  >
                    <Plus className="h-3.5 w-3.5" />
                  </button>
                </div>

                <div className="flex-1 px-2 py-2 space-y-2 min-h-[120px] overflow-y-auto max-h-[calc(100vh-460px)]">
                  {list.length === 0 ? (
                    <div className="flex items-center justify-center h-20 text-[11px] text-muted-foreground/60 italic">
                      Nenhum item
                    </div>
                  ) : (
                    list.map(renderCard)
                  )}
                  {col.key === "entregue" && list.length > 0 && (
                    <EntreguesSentinel
                      hasNext={!!entreguesQuery.hasNextPage}
                      isFetching={entreguesQuery.isFetchingNextPage}
                      onLoadMore={() => entreguesQuery.fetchNextPage()}
                    />
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ============== RODAPÉ ============== */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        {/* Total */}
        <div className="rounded-xl border bg-card p-4">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Total de ordens (ativas)</div>
          <div className="text-4xl font-bold tabular-nums mt-1">{ativas.length}</div>
          <div className="text-xs text-muted-foreground mt-1">
            distribuídas em {colsRender.filter((c) => c.list.length > 0 && c.key !== "entregue").length} etapas ativas
          </div>
          <div className="mt-3 flex flex-wrap gap-1">
            {colsRender.filter((c) => c.list.length > 0 && c.key !== "entregue").map((c) => {
              const pct = ativas.length ? (c.list.length / ativas.length) * 100 : 0;
              return (
                <div key={c.key} className="flex items-center gap-1 text-[10px]" title={`${c.nome}: ${c.list.length}`}>
                  <span className={cn("w-2 h-2 rounded-full", c.accent.dot)} />
                  <span className="text-muted-foreground">{c.nome}</span>
                  <span className="font-semibold tabular-nums">{Math.round(pct)}%</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Por técnico */}
        <div className="rounded-xl border bg-card p-4">
          <div className="flex items-center gap-2 mb-3">
            <Users className="h-3.5 w-3.5 text-muted-foreground" />
            <div className="text-xs font-semibold uppercase tracking-wider">Por técnico</div>
          </div>
          <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
            {resumoTecnicos.length === 0 && (
              <div className="text-xs text-muted-foreground italic">sem técnicos cadastrados</div>
            )}
            {resumoTecnicos.map((t) => {
              const c = colorForTec(t.id);
              const pct = (t.ativas / maxAtivasTec) * 100;
              return (
                <div key={t.id} className="space-y-1">
                  <div className="flex items-center justify-between text-[11px]">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span className="w-2 h-2 rounded-full" style={c.dot} />
                      <span className="font-medium truncate">{t.nome}</span>
                    </div>
                    <span className="tabular-nums font-semibold">{t.ativas}</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                    <div className="h-full" style={{ ...c.dot, width: `${pct}%` }} />
                  </div>
                  <div className="text-[10px] text-muted-foreground flex gap-2">
                    <span>{t.emAndamento} em andamento</span>
                    <span>·</span>
                    <span>{t.aguardando} aguardando</span>
                    <span>·</span>
                    <span>{t.pronto} pronto</span>
                    <span>·</span>
                    <span>{t.entregue} entregues/mês</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Indicadores */}
        <div className="rounded-xl border bg-card p-4">
          <div className="text-xs font-semibold uppercase tracking-wider mb-3">Indicadores (mês)</div>
          <div className="grid grid-cols-2 gap-2">
            <Indicador
              icon={<Timer className="h-3.5 w-3.5" />}
              label="Tempo médio"
              valor={kpis.tempoMedio !== null ? `${kpis.tempoMedio}d` : "—"}
              sub={kpis.tempoMedio === null ? "sem dado ainda" : "entrada → pronto"}
            />
            <Indicador
              icon={<TrendingUp className="h-3.5 w-3.5" />}
              label="Taxa conclusão"
              valor={kpis.taxa !== null ? `${kpis.taxa}%` : "—"}
              sub={kpis.taxa === null ? "sem dado ainda" : "concluídas / canceladas"}
            />
            <Indicador
              icon={<CheckCircle2 className="h-3.5 w-3.5" />}
              label="Concluídas"
              valor={String(kpis.concluidasMes)}
              sub="no mês"
            />
            <Indicador
              icon={<Star className="h-3.5 w-3.5" />}
              label="Satisfação"
              valor="—"
              sub="sem dado ainda"
            />
          </div>
        </div>
      </div>

      <ErrorBoundary
        key={selectedOrderId ?? "sem-os"}
        fallback={
          <div className="fixed bottom-4 right-4 z-50 rounded-lg border bg-card px-3 py-2 text-xs shadow-lg">
            Erro ao abrir detalhe
          </div>
        }
      >
        <OrdemDetalheSheet orderId={selectedOrderId} onClose={() => setSelectedOrderId(null)} />
      </ErrorBoundary>
    </div>
  );
}

function Indicador({
  icon, label, valor, sub,
}: {
  icon: React.ReactNode; label: string; valor: string; sub?: string;
}) {
  return (
    <div className="rounded-lg border bg-muted/30 p-2.5">
      <div className="flex items-center gap-1 text-[10px] uppercase tracking-wider text-muted-foreground">
        {icon}
        <span>{label}</span>
      </div>
      <div className="text-xl font-bold tabular-nums mt-1">{valor}</div>
      {sub && <div className="text-[10px] text-muted-foreground">{sub}</div>}
    </div>
  );
}

function EntreguesSentinel({
  hasNext,
  isFetching,
  onLoadMore,
}: {
  hasNext: boolean;
  isFetching: boolean;
  onLoadMore: () => void;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!hasNext) return;
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting) && !isFetching) onLoadMore();
      },
      { root: null, rootMargin: "120px", threshold: 0 },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [hasNext, isFetching, onLoadMore]);

  return (
    <div ref={ref} className="py-3 flex items-center justify-center">
      {isFetching ? (
        <span className="inline-flex items-center gap-1.5 text-[10px] text-muted-foreground">
          <Loader2 className="h-3 w-3 animate-spin" /> carregando…
        </span>
      ) : hasNext ? (
        <button
          type="button"
          onClick={onLoadMore}
          className="text-[10px] text-muted-foreground hover:text-foreground underline underline-offset-2"
        >
          carregar mais
        </button>
      ) : (
        <span className="text-[10px] text-muted-foreground/60 italic">— fim —</span>
      )}
    </div>
  );
}
