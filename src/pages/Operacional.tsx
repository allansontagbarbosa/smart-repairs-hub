import { useMemo, useRef, useState, DragEvent } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Search, LayoutGrid, Users, Loader2, Clock, AlertTriangle, MessageCircle } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { OrdemDetalheSheet } from "@/components/OrdemDetalheSheet";
import { calcularPrioridade } from "@/lib/prioridade";
import { statusFlow, statusLabels, type Status } from "@/lib/status";
import { abrirWhatsApp } from "@/lib/whatsapp";
import { invalidateOrdensDependentes } from "@/lib/cacheInvalidation";

type Modo = "status" | "mesa";

const statusHeaderColors: Record<Status, string> = {
  recebido: "bg-muted-foreground/20",
  em_analise: "bg-info/20",
  aguardando_aprovacao: "bg-warning/20",
  aprovado: "bg-success/20",
  em_reparo: "bg-info/20",
  aguardando_peca: "bg-warning/20",
  pronto: "bg-success/20",
  entregue: "bg-muted/40",
  cancelado: "bg-destructive/20",
};
const statusDotColors: Record<Status, string> = {
  recebido: "bg-muted-foreground",
  em_analise: "bg-info",
  aguardando_aprovacao: "bg-warning",
  aprovado: "bg-success",
  em_reparo: "bg-info",
  aguardando_peca: "bg-warning",
  pronto: "bg-success",
  entregue: "bg-muted-foreground/50",
  cancelado: "bg-destructive",
};

async function fetchOrders() {
  const ninetyDaysAgo = new Date();
  ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
  const { data, error } = await supabase
    .from("ordens_de_servico")
    .select(`*, aparelhos ( marca, modelo, clientes ( nome, telefone ) ), os_servicos ( tecnico_id, funcionarios ( nome ) )`)
    .gte("data_entrada", ninetyDaysAgo.toISOString())
    .order("data_entrada", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

function daysAgo(dateStr: string) {
  return Math.floor((Date.now() - new Date(dateStr).getTime()) / 86_400_000);
}

function tecnicosNomes(order: any): string[] {
  return Array.from(
    new Set(((order.os_servicos ?? []) as any[]).map((s) => s.funcionarios?.nome).filter(Boolean))
  );
}

export default function Operacional() {
  const queryClient = useQueryClient();
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [modo, setModo] = useState<Modo>(() =>
    (typeof window !== "undefined" && localStorage.getItem("operacional-modo") === "mesa") ? "mesa" : "status"
  );
  const [busca, setBusca] = useState<Record<string, string>>({});
  const [dragOver, setDragOver] = useState<string | null>(null);
  const dragRef = useRef<{ id: string } | null>(null);

  const { data: orders = [], isLoading } = useQuery({
    queryKey: ["ordens", "ultimos-90"],
    queryFn: fetchOrders,
  });

  const updateStatus = useMutation({
    mutationFn: async ({ id, newStatus }: { id: string; newStatus: Status }) => {
      const ordemAtual = orders.find((o: any) => o.id === id);
      const now = new Date().toISOString();
      const updates: any = { status: newStatus };
      if (newStatus === "pronto" && !ordemAtual?.data_conclusao) updates.data_conclusao = now;
      if (newStatus === "entregue") {
        if (!ordemAtual?.data_entrega) updates.data_entrega = now;
        if (!ordemAtual?.data_conclusao) updates.data_conclusao = ordemAtual?.data_entrega || now;
      }
      const { error } = await supabase.from("ordens_de_servico").update(updates).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      invalidateOrdensDependentes(queryClient);
      toast.success("Status atualizado!");
    },
    onError: () => toast.error("Erro ao atualizar status"),
  });

  const ativas = useMemo(
    () => (orders as any[]).filter((o) => o.status !== "entregue" && o.status !== "cancelado"),
    [orders]
  );

  const colunas = useMemo(() => {
    if (modo === "status") {
      return statusFlow.map((s) => ({
        key: s as string,
        nome: statusLabels[s],
        statusKey: s as Status,
        filtro: (o: any) => o.status === s,
      }));
    }
    const tecs = Array.from(
      new Set(
        (ativas as any[]).flatMap(tecnicosNomes)
      )
    ).sort();
    const cols = tecs.map((t) => ({
      key: `mesa-${t}`,
      nome: `Mesa ${t}`,
      statusKey: null as Status | null,
      filtro: (o: any) => tecnicosNomes(o).includes(t),
    }));
    // Coluna para OS sem técnico atribuído
    cols.unshift({
      key: "mesa-sem",
      nome: "Sem técnico",
      statusKey: null,
      filtro: (o: any) => tecnicosNomes(o).length === 0,
    });
    return cols;
  }, [modo, ativas]);

  const dataFonte = modo === "status" ? (orders as any[]) : ativas;

  const cardsDe = (col: typeof colunas[number]) => {
    const q = (busca[col.key] || "").toLowerCase().trim();
    return dataFonte.filter(col.filtro).filter((o: any) => {
      if (!q) return true;
      const tecs = tecnicosNomes(o).join(" ");
      const haystack = `${o.numero ?? ""} ${o.aparelhos?.clientes?.nome ?? ""} ${o.aparelhos?.marca ?? ""} ${o.aparelhos?.modelo ?? ""} ${tecs}`.toLowerCase();
      return haystack.includes(q);
    });
  };

  const setModoPersist = (m: Modo) => {
    setModo(m);
    if (typeof window !== "undefined") localStorage.setItem("operacional-modo", m);
  };

  // Drag handlers (somente modo status)
  const onDragStart = (e: DragEvent, id: string) => {
    if (modo !== "status") return;
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
    if (modo !== "status") return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDragOver(key);
  };
  const onDrop = (e: DragEvent, statusKey: Status | null) => {
    e.preventDefault();
    setDragOver(null);
    if (modo !== "status" || !statusKey || !dragRef.current) return;
    const { id } = dragRef.current;
    const order = (orders as any[]).find((o) => o.id === id);
    if (!order || order.status === statusKey) return;
    updateStatus.mutate({ id, newStatus: statusKey });
  };

  const renderCard = (order: any) => {
    const days = daysAgo(order.data_entrada);
    const prio = calcularPrioridade(order.status, order.data_entrada, order.previsao_entrega);
    const isCritica = prio.nivel === "critica";
    const isAtencao = prio.nivel === "atencao";
    const phone = order.aparelhos?.clientes?.telefone;
    const tecs = tecnicosNomes(order);

    return (
      <div
        key={order.id}
        draggable={modo === "status"}
        onDragStart={(e) => onDragStart(e, order.id)}
        onDragEnd={onDragEnd}
        onClick={() => setSelectedOrderId(order.id)}
        className={cn(
          "bg-card rounded-lg border p-2.5 space-y-1.5 transition-all hover:shadow-md select-none",
          modo === "status" ? "cursor-grab active:cursor-grabbing" : "cursor-pointer",
          isCritica && "border-destructive/40 bg-destructive/5 ring-1 ring-destructive/20",
          isAtencao && !isCritica && "border-warning/40 ring-1 ring-warning/20"
        )}
      >
        {isCritica && (
          <div className="flex items-center gap-1 text-[10px] font-semibold text-destructive">
            <AlertTriangle className="h-3 w-3" /> {prio.motivo}
          </div>
        )}
        {isAtencao && !isCritica && (
          <div className="flex items-center gap-1 text-[10px] font-semibold text-warning">
            <Clock className="h-3 w-3" /> {prio.motivo}
          </div>
        )}
        <p className="text-sm font-medium leading-tight truncate">
          {order.aparelhos?.clientes?.nome ?? "—"}
        </p>
        <p className="text-[11px] text-muted-foreground truncate">
          {order.aparelhos?.marca} {order.aparelhos?.modelo}
        </p>
        <p className="text-[11px] text-muted-foreground line-clamp-1">{order.defeito_relatado}</p>
        {modo === "mesa" && (
          <Badge variant="outline" className="text-[10px]">
            <span className={cn("w-1.5 h-1.5 rounded-full mr-1", statusDotColors[order.status as Status])} />
            {statusLabels[order.status as Status]}
          </Badge>
        )}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-mono text-muted-foreground">
              #{String(order.numero).padStart(3, "0")}
            </span>
            <span className={cn(
              "inline-flex items-center gap-0.5 text-[10px]",
              isCritica ? "text-destructive font-medium" : isAtencao ? "text-warning font-medium" : "text-muted-foreground"
            )}>
              <Clock className="h-2.5 w-2.5" /> {days}d
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            {Number(order.valor ?? 0) > 0 && (
              <span className="text-[10px] font-medium text-muted-foreground">
                R$ {Number(order.valor).toLocaleString("pt-BR", { minimumFractionDigits: 0 })}
              </span>
            )}
            {phone && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  abrirWhatsApp(phone, `Olá! Informamos sobre a OS #${String(order.numero).padStart(3, "0")}.`);
                }}
                className="text-success hover:text-success/80 transition-colors"
                title="WhatsApp"
              >
                <MessageCircle className="h-3 w-3" />
              </button>
            )}
          </div>
        </div>
        {modo === "status" && tecs.length > 0 && (
          <p className="text-[10px] text-muted-foreground truncate" title={tecs.join(", ")}>
            👤 {tecs.join(", ")}
          </p>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="page-header !mb-0">
          <h1 className="page-title">Operacional</h1>
          <p className="page-subtitle">{ativas.length} ordens ativas</p>
        </div>
        <div className="inline-flex items-center rounded-md border bg-card p-0.5">
          <button
            type="button"
            onClick={() => setModoPersist("status")}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-md px-3 py-1 text-[12px] font-medium transition-colors",
              modo === "status" ? "bg-secondary text-foreground" : "text-muted-foreground hover:text-foreground",
            )}
          >
            <LayoutGrid className="h-3.5 w-3.5" /> Por status
          </button>
          <button
            type="button"
            onClick={() => setModoPersist("mesa")}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-md px-3 py-1 text-[12px] font-medium transition-colors",
              modo === "mesa" ? "bg-secondary text-foreground" : "text-muted-foreground hover:text-foreground",
            )}
          >
            <Users className="h-3.5 w-3.5" /> Por mesa/técnico
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div
          className="flex gap-2.5 overflow-x-auto pb-4 -mx-4 px-4 md:-mx-6 md:px-6 lg:-mx-8 lg:px-8 snap-x"
          style={{ minHeight: "calc(100vh - 200px)" }}
        >
          {colunas.map((col) => {
            const lista = cardsDe(col);
            const isDrop = dragOver === col.key;
            const headerCls = modo === "status" && col.statusKey
              ? statusHeaderColors[col.statusKey]
              : "bg-muted/40";
            const dotCls = modo === "status" && col.statusKey
              ? statusDotColors[col.statusKey]
              : "bg-primary";
            return (
              <div
                key={col.key}
                className={cn(
                  "flex-shrink-0 w-60 md:w-[17rem] rounded-xl border flex flex-col snap-start transition-all",
                  isDrop && "ring-2 ring-primary/40 bg-primary/5",
                  !isDrop && "bg-muted/30"
                )}
                onDragOver={(e) => onDragOver(e, col.key)}
                onDragLeave={() => setDragOver(null)}
                onDrop={(e) => onDrop(e, col.statusKey)}
              >
                <div className={cn("px-3 py-2.5 rounded-t-xl flex items-center justify-between", headerCls)}>
                  <div className="flex items-center gap-2 min-w-0">
                    <div className={cn("w-2 h-2 rounded-full shrink-0", dotCls)} />
                    <span className="text-xs font-semibold truncate">{col.nome}</span>
                  </div>
                  <span className="text-[11px] text-muted-foreground bg-background/80 rounded-full px-2 py-0.5 font-semibold tabular-nums">
                    {lista.length}
                  </span>
                </div>

                <div className="px-2 pt-2">
                  <div className="relative">
                    <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                    <Input
                      value={busca[col.key] ?? ""}
                      onChange={(e) => setBusca((prev) => ({ ...prev, [col.key]: e.target.value }))}
                      placeholder="Buscar nesta coluna…"
                      className="h-8 pl-7 text-xs"
                    />
                  </div>
                </div>

                <div className="flex-1 px-2 py-2 space-y-2 min-h-[100px] overflow-y-auto max-h-[calc(100vh-320px)]">
                  {lista.length === 0 ? (
                    <div className="flex items-center justify-center h-20 text-[11px] text-muted-foreground/60 italic">
                      Nenhuma OS
                    </div>
                  ) : (
                    lista.map(renderCard)
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <OrdemDetalheSheet orderId={selectedOrderId} onClose={() => setSelectedOrderId(null)} />
    </div>
  );
}
