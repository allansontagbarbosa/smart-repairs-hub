import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  useDraggable,
  useDroppable,
  type DragEndEvent,
} from "@dnd-kit/core";
import { supabase } from "@/integrations/supabase/client";
import { useEmpresa } from "@/contexts/EmpresaContext";
import {
  useAtualizarTecnicoServico,
  atribuirTodaOSAoTecnico,
} from "@/hooks/useAtualizarTecnicoServico";
import { cn } from "@/lib/utils";
import { statusLabels, type Status } from "@/lib/status";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { AlertTriangle, CheckCircle2, Clock, Loader2, MoreVertical, ExternalLink } from "lucide-react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { OrdemDetalheSheet } from "@/components/OrdemDetalheSheet";

const STATUS_ABERTOS: Status[] = [
  "recebido",
  "em_analise",
  "aguardando_aprovacao",
  "aprovado",
  "em_reparo",
  "aguardando_peca",
  "pronto",
];

const TECH_COLORS = [
  "bg-blue-100 dark:bg-blue-900/30 border-blue-300 dark:border-blue-700",
  "bg-emerald-100 dark:bg-emerald-900/30 border-emerald-300 dark:border-emerald-700",
  "bg-purple-100 dark:bg-purple-900/30 border-purple-300 dark:border-purple-700",
  "bg-amber-100 dark:bg-amber-900/30 border-amber-300 dark:border-amber-700",
  "bg-pink-100 dark:bg-pink-900/30 border-pink-300 dark:border-pink-700",
  "bg-cyan-100 dark:bg-cyan-900/30 border-cyan-300 dark:border-cyan-700",
  "bg-indigo-100 dark:bg-indigo-900/30 border-indigo-300 dark:border-indigo-700",
  "bg-teal-100 dark:bg-teal-900/30 border-teal-300 dark:border-teal-700",
];

const AVATAR_COLORS = [
  "bg-blue-500",
  "bg-emerald-500",
  "bg-purple-500",
  "bg-amber-500",
  "bg-pink-500",
  "bg-cyan-500",
  "bg-indigo-500",
  "bg-teal-500",
];

function hashIdx(name: string, mod: number) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return h % mod;
}

function daysBetween(from: string | null | undefined, to = new Date()) {
  if (!from) return null;
  return Math.floor((to.getTime() - new Date(from).getTime()) / 86400000);
}

function fmtBRL(n: number) {
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 0 });
}

interface Tecnico { id: string; nome: string; }
interface ServicoCard {
  servico_id: string;
  ordem_id: string;
  tecnico_id: string | null;
  servico_status: string | null;
  servico_nome: string | null;
  servico_valor: number;
  iniciado_em: string | null;
  concluido_em: string | null;
  updated_at: string | null;
  os_numero: number;
  os_status: Status;
  defeito_relatado: string | null;
  previsao_entrega: string | null;
  prioridade: string | null;
  data_entrada: string | null;
  os_valor_total: number;
  cliente_nome: string | null;
  aparelho_modelo: string | null;
  aparelho_marca: string | null;
  total_servicos_na_os: number;
}

function scoreUrgencia(s: ServicoCard): number {
  // menor score = mais urgente = topo
  const agora = Date.now();
  const prazo = s.previsao_entrega ? new Date(s.previsao_entrega).getTime() : null;

  // Faixa 0: atrasados — quanto mais atrasado, mais negativo
  if (prazo !== null && prazo < agora) {
    const diasAtraso = Math.floor((agora - prazo) / 86400000);
    return -100000 - diasAtraso;
  }

  // Faixa 1: vence em <= 1 dia
  if (prazo !== null && (prazo - agora) <= 86400000) {
    return 0;
  }

  // Faixa 2: por prioridade, desempate por idade na fila (FIFO)
  const prioridadeRank: Record<string, number> = {
    urgente: 10, alta: 20, normal: 30, baixa: 40,
  };
  const pr = prioridadeRank[(s.prioridade ?? "normal").toLowerCase()] ?? 30;
  const entrada = s.data_entrada ? new Date(s.data_entrada).getTime() : agora;
  const idadeDias = Math.floor((agora - entrada) / 86400000);
  return 1000 + pr * 100 - idadeDias;
}


export default function KanbanTecnicos() {
  const { empresaId } = useEmpresa();
  const queryClient = useQueryClient();
  const atualizar = useAtualizarTecnicoServico();
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const { data: tecnicos = [], isLoading: loadingTec } = useQuery<Tecnico[]>({
    queryKey: ["kanban-tecnicos", "tecnicos-ativos", empresaId],
    enabled: !!empresaId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("funcionarios")
        .select("id, nome, cargo")
        .eq("empresa_id", empresaId!)
        .eq("ativo", true)
        .is("deleted_at", null)
        .order("nome");
      if (error) throw error;
      return (data ?? [])
        .filter((f: any) => {
          const c = String(f.cargo ?? "").toLowerCase();
          const n = String(f.nome ?? "").toLowerCase();
          return (c.includes("tecnico") || c.includes("técnico")) && !n.includes("teste");
        })
        .map((f: any) => ({ id: f.id, nome: f.nome }));
    },
  });

  const { data: servicos = [], isLoading: loadingSrv } = useQuery<ServicoCard[]>({
    queryKey: ["kanban-tecnicos", "servicos", empresaId],
    enabled: !!empresaId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("os_servicos")
        .select(`
          id, ordem_id, tecnico_id, status, nome, valor, iniciado_em, concluido_em, updated_at,
          ordens_de_servico!inner (
            numero, status, defeito_relatado, previsao_entrega, prioridade, data_entrada, valor, deleted_at, empresa_id,
            clientes ( nome ),
            aparelhos ( marca, modelo )
          )
        `)
        .eq("empresa_id", empresaId!);
      if (error) throw error;

      const rows = (data ?? []).filter((r: any) => {
        const o = r.ordens_de_servico;
        return o && !o.deleted_at && (
          STATUS_ABERTOS.includes(o.status) ||
          (r.concluido_em && new Date(r.concluido_em).getMonth() === new Date().getMonth()
            && new Date(r.concluido_em).getFullYear() === new Date().getFullYear())
        );
      });

      const countByOrdem: Record<string, number> = {};
      rows.forEach((r: any) => { countByOrdem[r.ordem_id] = (countByOrdem[r.ordem_id] ?? 0) + 1; });

      return rows.map((r: any) => {
        const o = r.ordens_de_servico;
        return {
          servico_id: r.id,
          ordem_id: r.ordem_id,
          tecnico_id: r.tecnico_id,
          servico_status: r.status,
          servico_nome: r.nome,
          servico_valor: Number(r.valor) || 0,
          iniciado_em: r.iniciado_em,
          concluido_em: r.concluido_em,
          updated_at: r.updated_at,
          os_numero: o.numero,
          os_status: o.status,
          defeito_relatado: o.defeito_relatado,
          previsao_entrega: o.previsao_entrega,
          prioridade: o.prioridade,
          data_entrada: o.data_entrada,
          os_valor_total: Number(o.valor) || 0,
          cliente_nome: o.clientes?.nome ?? null,
          aparelho_modelo: o.aparelhos?.modelo ?? null,
          aparelho_marca: o.aparelhos?.marca ?? null,
          total_servicos_na_os: countByOrdem[r.ordem_id] ?? 1,
        } as ServicoCard;
      });
    },
  });

  // Realtime
  useEffect(() => {
    if (!empresaId) return;
    const channelName = `kanban-tecnicos-${Date.now()}`;
    const ch = supabase
      .channel(channelName)
      .on("postgres_changes", { event: "*", schema: "public", table: "os_servicos" }, () => {
        queryClient.invalidateQueries({ queryKey: ["kanban-tecnicos"] });
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [empresaId, queryClient]);

  const { abertosPorCol, concluidasMes } = useMemo(() => {
    const ab: Record<string, ServicoCard[]> = { __sem__: [] };
    tecnicos.forEach(t => { ab[t.id] = []; });
    const concl: ServicoCard[] = [];
    const now = new Date();
    servicos.forEach(s => {
      if (s.concluido_em) {
        const d = new Date(s.concluido_em);
        if (d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear() && s.tecnico_id) {
          concl.push(s);
          return;
        }
      }
      if (!STATUS_ABERTOS.includes(s.os_status)) return;
      if (!s.tecnico_id) ab.__sem__.push(s);
      else if (ab[s.tecnico_id]) ab[s.tecnico_id].push(s);
      else ab.__sem__.push(s); // técnico inativo
    });
    concl.sort((a, b) => (b.concluido_em ?? "").localeCompare(a.concluido_em ?? ""));
    // Ordenar colunas de trabalho ativo por urgência
    Object.keys(ab).forEach(col => {
      ab[col].sort((a, b) => scoreUrgencia(a) - scoreUrgencia(b));
    });
    return { abertosPorCol: ab, concluidasMes: concl.slice(0, 20) };
  }, [servicos, tecnicos]);

  const handleDragEnd = (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over) return;
    const servicoId = String(active.id);
    const targetCol = String(over.id); // "__sem__" or tecnico.id
    const srv = servicos.find(s => s.servico_id === servicoId);
    if (!srv) return;
    const currentCol = srv.tecnico_id ?? "__sem__";
    if (currentCol === targetCol) return;
    const novoTecId = targetCol === "__sem__" ? null : targetCol;
    const nomeAlvo = novoTecId ? (tecnicos.find(t => t.id === novoTecId)?.nome ?? "técnico") : "";
    atualizar.mutate({ servicoId, tecnicoId: novoTecId, nomeAlvo });
  };

  if (loadingTec || loadingSrv) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <>
      <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
        <div
          className="flex gap-2.5 overflow-x-auto pb-4 -mx-4 px-4 md:-mx-6 md:px-6 lg:-mx-8 lg:px-8 snap-x"
          style={{ minHeight: "calc(100vh - 240px)" }}
        >
          <ColumnSem
            servicos={abertosPorCol.__sem__}
            tecnicos={tecnicos}
            onSelect={setSelectedOrderId}
          />

          {tecnicos.map(t => (
            <ColumnTecnico
              key={t.id}
              tecnico={t}
              servicos={abertosPorCol[t.id] ?? []}
              tecnicos={tecnicos}
              onSelect={setSelectedOrderId}
            />
          ))}

          <ColumnConcluidas servicos={concluidasMes} tecnicos={tecnicos} onSelect={setSelectedOrderId} />
        </div>
      </DndContext>
      <OrdemDetalheSheet orderId={selectedOrderId} onClose={() => setSelectedOrderId(null)} />
    </>
  );
}

// ============ Columns ============

function ColumnSem({ servicos, tecnicos, onSelect }: { servicos: ServicoCard[]; tecnicos: Tecnico[]; onSelect: (id: string) => void }) {
  const { setNodeRef, isOver } = useDroppable({ id: "__sem__" });
  const total = servicos.reduce((s, c) => s + c.servico_valor, 0);
  return (
    <div
      ref={setNodeRef}
      className={cn(
        "flex-shrink-0 w-64 md:w-72 rounded-xl border-2 border-dashed border-orange-400/60 flex flex-col snap-start transition-all bg-orange-50/40 dark:bg-orange-950/10",
        isOver && "ring-2 ring-orange-400 bg-orange-100/60 dark:bg-orange-900/20",
      )}
    >
      <div className="px-3 py-2.5 border-b border-orange-400/30 rounded-t-xl">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 min-w-0">
            <AlertTriangle className="h-4 w-4 text-orange-500 shrink-0" />
            <span className="text-xs font-semibold truncate">Sem técnico</span>
          </div>
          <span className="text-[11px] bg-orange-500/20 text-orange-700 dark:text-orange-300 rounded-full px-2 py-0.5 font-semibold tabular-nums">
            {servicos.length}
          </span>
        </div>
        <p className="text-[10px] text-muted-foreground mt-0.5">{fmtBRL(total)} em aberto</p>
      </div>
      <div className="flex-1 px-2 py-2 space-y-2 overflow-y-auto max-h-[calc(100vh-320px)]">
        {servicos.length === 0 && (
          <div className="flex items-center justify-center h-20 text-[11px] text-muted-foreground/60 italic">Tudo distribuído ✨</div>
        )}
        {servicos.map(s => <ServicoCardView key={s.servico_id} srv={s} tecnicos={tecnicos} onSelect={onSelect} />)}
      </div>
    </div>
  );
}

function ColumnTecnico({ tecnico, servicos, tecnicos, onSelect }: { tecnico: Tecnico; servicos: ServicoCard[]; tecnicos: Tecnico[]; onSelect: (id: string) => void }) {
  const { setNodeRef, isOver } = useDroppable({ id: tecnico.id });
  const colorBg = TECH_COLORS[hashIdx(tecnico.nome, TECH_COLORS.length)];
  const avatarColor = AVATAR_COLORS[hashIdx(tecnico.nome, AVATAR_COLORS.length)];
  const total = servicos.reduce((s, c) => s + c.servico_valor, 0);
  return (
    <div
      ref={setNodeRef}
      className={cn(
        "flex-shrink-0 w-64 md:w-72 rounded-xl border flex flex-col snap-start transition-all bg-muted/30",
        isOver && "ring-2 ring-primary/40 bg-primary/5",
      )}
    >
      <div className={cn("px-3 py-2.5 rounded-t-xl border-b", colorBg)}>
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <Avatar className="h-7 w-7">
              <AvatarFallback className={cn("text-[11px] text-white font-semibold", avatarColor)}>
                {tecnico.nome.slice(0, 1).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <span className="text-xs font-semibold truncate">{tecnico.nome}</span>
          </div>
          <span className="text-[11px] bg-background/80 rounded-full px-2 py-0.5 font-semibold tabular-nums shrink-0">
            {servicos.length}
          </span>
        </div>
        <p className="text-[10px] text-muted-foreground mt-1">{fmtBRL(total)} em aberto</p>
      </div>
      <div className="flex-1 px-2 py-2 space-y-2 overflow-y-auto max-h-[calc(100vh-320px)] min-h-[100px]">
        {servicos.length === 0 && (
          <div className="flex items-center justify-center h-20 text-[11px] text-muted-foreground/60 italic">Solte um card aqui</div>
        )}
        {servicos.map(s => <ServicoCardView key={s.servico_id} srv={s} tecnicos={tecnicos} onSelect={onSelect} />)}
      </div>
    </div>
  );
}

function ColumnConcluidas({ servicos, tecnicos, onSelect }: { servicos: ServicoCard[]; tecnicos: Tecnico[]; onSelect: (id: string) => void }) {
  // Not droppable
  const total = servicos.reduce((s, c) => s + c.servico_valor, 0);
  return (
    <div className="flex-shrink-0 w-64 md:w-72 rounded-xl border flex flex-col snap-start bg-muted/40">
      <div className="px-3 py-2.5 rounded-t-xl border-b bg-emerald-100/60 dark:bg-emerald-900/20">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 min-w-0">
            <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
            <span className="text-xs font-semibold truncate">Concluídas no mês</span>
          </div>
          <span className="text-[11px] bg-background/80 rounded-full px-2 py-0.5 font-semibold tabular-nums">
            {servicos.length}
          </span>
        </div>
        <p className="text-[10px] text-muted-foreground mt-0.5">{fmtBRL(total)} entregue</p>
      </div>
      <div className="flex-1 px-2 py-2 space-y-1.5 overflow-y-auto max-h-[calc(100vh-320px)]">
        {servicos.length === 0 && (
          <div className="flex items-center justify-center h-20 text-[11px] text-muted-foreground/60 italic">Nenhuma esse mês</div>
        )}
        {servicos.map(s => {
          const tec = tecnicos.find(t => t.id === s.tecnico_id);
          const avatarColor = tec ? AVATAR_COLORS[hashIdx(tec.nome, AVATAR_COLORS.length)] : "bg-muted-foreground";
          return (
            <button
              key={s.servico_id}
              onClick={() => onSelect(s.ordem_id)}
              className="w-full flex items-center gap-2 p-1.5 rounded bg-card border hover:shadow-sm text-left"
            >
              <Avatar className="h-5 w-5">
                <AvatarFallback className={cn("text-[9px] text-white", avatarColor)}>
                  {(tec?.nome ?? "?").slice(0, 1).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <span className="text-[10px] font-mono text-muted-foreground">#{String(s.os_numero).padStart(3, "0")}</span>
              <span className="text-[10px] text-muted-foreground truncate flex-1">{s.servico_nome}</span>
              <span className="text-[10px] font-medium">{fmtBRL(s.servico_valor)}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ============ Card ============

function ServicoCardView({ srv, tecnicos, onSelect }: { srv: ServicoCard; tecnicos: Tecnico[]; onSelect: (id: string) => void }) {
  const { attributes, listeners, setNodeRef, isDragging, transform } = useDraggable({ id: srv.servico_id });
  const atualizar = useAtualizarTecnicoServico();

  const diasPrazo = srv.previsao_entrega
    ? Math.ceil((new Date(srv.previsao_entrega).getTime() - Date.now()) / 86400000)
    : null;
  const prazoAtrasado = diasPrazo !== null && diasPrazo < 0;
  const naColunaDesde = srv.iniciado_em ?? srv.updated_at ?? srv.data_entrada ?? null;
  const diasColuna = daysBetween(naColunaDesde);
  const tecAtual = tecnicos.find(t => t.id === srv.tecnico_id);
  const defeitoLinha = (srv.defeito_relatado ?? "").split("\n")[0]?.trim();

  const style: React.CSSProperties = transform
    ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`, zIndex: 50 }
    : {};

  const paradoMuito = diasColuna !== null && diasColuna >= 5;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "bg-card rounded-lg border p-2.5 space-y-1.5 transition-shadow hover:shadow-md select-none touch-none",
        isDragging && "opacity-50 shadow-lg",
        paradoMuito && "border-l-2 border-l-amber-400",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div
          {...listeners}
          {...attributes}
          className="flex-1 min-w-0 cursor-grab active:cursor-grabbing"
        >
          <div className="flex items-center gap-1.5 mb-0.5">
            <span className="text-sm font-medium leading-tight truncate">{srv.cliente_nome ?? "—"}</span>
            <span className="text-[10px] font-mono text-muted-foreground shrink-0">#{String(srv.os_numero).padStart(3, "0")}</span>
          </div>
          <p className="text-[11px] text-muted-foreground truncate">{srv.aparelho_marca} {srv.aparelho_modelo}</p>
        </div>
        <CardMenu srv={srv} tecnicos={tecnicos} onSelect={onSelect} mutate={atualizar.mutate} />
      </div>

      <p className="text-[11px] font-semibold uppercase tracking-wide text-foreground/80 truncate">
        {srv.servico_nome ?? "Serviço"}
      </p>

      {defeitoLinha && (
        <p className="text-[11px] text-muted-foreground line-clamp-1">{defeitoLinha}</p>
      )}

      <div className="flex items-center gap-1.5 flex-wrap">
        <Badge variant="outline" className="text-[10px] py-0 h-4">
          {statusLabels[srv.os_status]}
        </Badge>
        {srv.previsao_entrega && (
          <span className={cn(
            "inline-flex items-center gap-0.5 text-[10px]",
            prazoAtrasado ? "text-destructive font-semibold" : (diasPrazo ?? 0) <= 1 ? "text-warning font-medium" : "text-muted-foreground"
          )}>
            <Clock className="h-2.5 w-2.5" />
            {prazoAtrasado ? `Atrasado ${Math.abs(diasPrazo ?? 0)}d` : `Prazo ${diasPrazo}d`}
          </span>
        )}
        {srv.total_servicos_na_os > 1 && (
          <span
            className="text-[10px] text-muted-foreground italic"
            title={`Esta OS tem ${srv.total_servicos_na_os} serviços`}
          >
            ({srv.total_servicos_na_os} serviços)
          </span>
        )}
      </div>

      <div className="flex items-center justify-between pt-0.5">
        <span className="text-[10px] text-muted-foreground">
          {tecAtual && diasColuna !== null ? `com ${tecAtual.nome.split(" ")[0]} há ${diasColuna}d` : naColunaDesde ? `há ${diasColuna}d` : ""}
        </span>
        {srv.servico_valor > 0 && (
          <span className="text-[11px] font-semibold">{fmtBRL(srv.servico_valor)}</span>
        )}
      </div>
    </div>
  );
}

function CardMenu({ srv, tecnicos, onSelect, mutate }: { srv: ServicoCard; tecnicos: Tecnico[]; onSelect: (id: string) => void; mutate: ReturnType<typeof useAtualizarTecnicoServico>["mutate"] }) {
  const handleAtribuirOS = async (tecId: string | null, nome: string) => {
    try {
      await atribuirTodaOSAoTecnico(srv.ordem_id, tecId);
      toast.success(tecId ? `OS inteira atribuída a ${nome}` : "OS inteira sem técnico");
    } catch (e: any) {
      toast.error("Erro: " + (e?.message ?? "desconhecido"));
    }
  };
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0" onPointerDown={(e) => e.stopPropagation()}>
          <MoreVertical className="h-3.5 w-3.5" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56 max-h-80 overflow-y-auto">
        <DropdownMenuLabel>Atribuir serviço a</DropdownMenuLabel>
        {tecnicos.map(t => (
          <DropdownMenuItem
            key={t.id}
            disabled={t.id === srv.tecnico_id}
            onClick={() => mutate({ servicoId: srv.servico_id, tecnicoId: t.id, nomeAlvo: t.nome })}
          >
            {t.nome}
          </DropdownMenuItem>
        ))}
        <DropdownMenuItem
          disabled={!srv.tecnico_id}
          onClick={() => mutate({ servicoId: srv.servico_id, tecnicoId: null, nomeAlvo: "" })}
        >
          Remover técnico
        </DropdownMenuItem>
        {srv.total_servicos_na_os > 1 && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuLabel>Atribuir TODA a OS</DropdownMenuLabel>
            {tecnicos.map(t => (
              <DropdownMenuItem key={"all-" + t.id} onClick={() => handleAtribuirOS(t.id, t.nome)}>
                Toda OS → {t.nome}
              </DropdownMenuItem>
            ))}
          </>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => onSelect(srv.ordem_id)}>
          <ExternalLink className="h-3.5 w-3.5 mr-2" /> Abrir OS completa
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link to={`/assistencia?os=${srv.os_numero}`}>Ver na lista</Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
