import { useState, useRef, DragEvent } from "react";
import { Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ChevronRight, ChevronLeft, Clock, AlertTriangle, List, Loader2, MessageCircle, Users, Columns3 } from "lucide-react";
import { toast } from "sonner";
import { abrirWhatsApp } from "@/lib/whatsapp";
import { cn } from "@/lib/utils";
import { OrdemDetalheSheet } from "@/components/OrdemDetalheSheet";
import { calcularPrioridade } from "@/lib/prioridade";
import type { Database } from "@/integrations/supabase/types";
import { statusFlow, statusLabels, type Status } from "@/lib/status";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

const statusHeaderColors: Record<Status, string> = {
  recebido: "bg-muted-foreground/20",
  em_analise: "bg-info/20",
  aguardando_aprovacao: "bg-warning/20",
  aprovado: "bg-success/20",
  em_reparo: "bg-info/20",
  aguardando_peca: "bg-warning/20",
  pronto: "bg-success/20",
  entregue: "bg-muted/40",
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
};

async function fetchOrders() {
  const { data, error } = await supabase
    .from("ordens_de_servico")
    .select(`*, aparelhos ( marca, modelo, clientes ( nome, telefone ) ), funcionarios ( nome )`)
    .order("data_entrada", { ascending: false });
  if (error) throw error;
  return data;
}

async function fetchTecnicos() {
  const { data } = await supabase
    .from("funcionarios")
    .select("id, nome")
    .eq("ativo", true)
    .is("deleted_at", null)
    .order("nome");
  return data ?? [];
}

function daysAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  return Math.floor(diff / (1000 * 60 * 60 * 24));
}

type ViewMode = "status" | "tecnico";

export default function FluxoAssistencia() {
  const queryClient = useQueryClient();
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [dragOverColumn, setDragOverColumn] = useState<string | null>(null);
  const dragItemRef = useRef<{ id: string; aparelhoId: string } | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>("status");

  const { data: orders = [], isLoading } = useQuery({ queryKey: ["ordens"], queryFn: fetchOrders });
  const { data: tecnicos = [] } = useQuery({ queryKey: ["tecnicos_kanban"], queryFn: fetchTecnicos });

  const updateStatus = useMutation({
    mutationFn: async ({ id, newStatus }: { id: string; newStatus: Status }) => {
      const updates: { status: Status; data_conclusao?: string; data_entrega?: string } = { status: newStatus };
      if (newStatus === "pronto") updates.data_conclusao = new Date().toISOString();
      if (newStatus === "entregue") updates.data_entrega = new Date().toISOString();
      const { error } = await supabase.from("ordens_de_servico").update(updates).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ordens"] });
      toast.success("Status atualizado!");
    },
    onError: () => toast.error("Erro ao atualizar status"),
  });

  const updateTecnico = useMutation({
    mutationFn: async ({ id, tecnicoId }: { id: string; tecnicoId: string | null }) => {
      const { error } = await supabase.from("ordens_de_servico").update({ funcionario_id: tecnicoId }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ordens"] });
      toast.success("Técnico reatribuído!");
    },
    onError: () => toast.error("Erro ao reatribuir técnico"),
  });

  // Drag handlers
  const handleDragStart = (e: DragEvent, orderId: string, aparelhoId: string) => {
    dragItemRef.current = { id: orderId, aparelhoId };
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", orderId);
    if (e.currentTarget instanceof HTMLElement) {
      e.currentTarget.style.opacity = "0.5";
    }
  };

  const handleDragEnd = (e: DragEvent) => {
    if (e.currentTarget instanceof HTMLElement) {
      e.currentTarget.style.opacity = "1";
    }
    setDragOverColumn(null);
    dragItemRef.current = null;
  };

  const handleDragOver = (e: DragEvent, columnKey: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDragOverColumn(columnKey);
  };

  const handleDragLeave = () => {
    setDragOverColumn(null);
  };

  const handleDropStatus = (e: DragEvent, targetStatus: Status) => {
    e.preventDefault();
    setDragOverColumn(null);
    if (!dragItemRef.current) return;
    const { id } = dragItemRef.current;
    const order = orders.find((o) => o.id === id);
    if (!order || order.status === targetStatus) return;
    updateStatus.mutate({ id, newStatus: targetStatus });
  };

  const handleDropTecnico = (e: DragEvent, tecnicoId: string | null) => {
    e.preventDefault();
    setDragOverColumn(null);
    if (!dragItemRef.current) return;
    const { id } = dragItemRef.current;
    const order = orders.find((o) => o.id === id);
    if (!order) return;
    if (order.funcionario_id === tecnicoId) return;
    updateTecnico.mutate({ id, tecnicoId });
  };

  const moveOrder = (id: string, direction: 1 | -1, currentStatus: Status) => {
    const idx = statusFlow.indexOf(currentStatus);
    const newIdx = idx + direction;
    if (newIdx < 0 || newIdx >= statusFlow.length) return;
    updateStatus.mutate({ id, newStatus: statusFlow[newIdx] });
  };

  const handleWhatsApp = (phone: string | undefined, orderNum: number) => {
    if (!phone) return toast.error("Cliente sem telefone");
    abrirWhatsApp(phone, `Olá! Informamos sobre a OS #${String(orderNum).padStart(3, "0")}.`);
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const totalAtivas = orders.filter((o) => o.status !== "entregue").length;

  // Build order card (shared between both views)
  const renderCard = (order: any, showStatusBadge = false) => {
    const days = daysAgo(order.data_entrada);
    const prio = calcularPrioridade(order.status, order.data_entrada, order.previsao_entrega);
    const isCritica = prio.nivel === "critica";
    const isAtencao = prio.nivel === "atencao";
    const idx = statusFlow.indexOf(order.status as Status);
    const canGoBack = idx > 0;
    const canGoForward = idx < statusFlow.length - 1;
    const phone = order.aparelhos?.clientes?.telefone;
    const lucro = Number(order.valor ?? 0) - Number(order.custo_pecas ?? 0);

    return (
      <div
        key={order.id}
        draggable
        onDragStart={(e) => handleDragStart(e, order.id, order.aparelho_id)}
        onDragEnd={handleDragEnd}
        className={cn(
          "bg-card rounded-lg border p-2.5 space-y-1.5 transition-all hover:shadow-md cursor-grab active:cursor-grabbing select-none",
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

        <div onClick={() => setSelectedOrderId(order.id)} className="cursor-pointer">
          <p className="text-sm font-medium leading-tight truncate">
            {order.aparelhos?.clientes?.nome ?? "—"}
          </p>
          <p className="text-[11px] text-muted-foreground truncate">
            {order.aparelhos?.marca} {order.aparelhos?.modelo}
          </p>
        </div>

        <p className="text-[11px] text-muted-foreground line-clamp-1">{order.defeito_relatado}</p>

        {showStatusBadge && (
          <Badge variant="outline" className={cn("text-[10px]", statusDotColors[order.status as Status])}>
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
              <span className={cn("text-[10px] font-medium", lucro >= 0 ? "text-success" : "text-destructive")}>
                R$ {Number(order.valor).toLocaleString("pt-BR", { minimumFractionDigits: 0 })}
              </span>
            )}
            {phone && (
              <button
                onClick={(e) => { e.stopPropagation(); handleWhatsApp(phone, order.numero); }}
                className="text-success hover:text-success/80 transition-colors"
                title="WhatsApp"
              >
                <MessageCircle className="h-3 w-3" />
              </button>
            )}
          </div>
        </div>

        {viewMode === "status" && order.status !== "entregue" && (
          <div className="flex gap-1 pt-0.5">
            <button
              type="button"
              disabled={!canGoBack || updateStatus.isPending}
              onClick={(e) => { e.stopPropagation(); moveOrder(order.id, -1, order.status as Status); }}
              className="flex-1 flex items-center justify-center gap-0.5 rounded border bg-background px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground hover:bg-muted disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronLeft className="h-2.5 w-2.5" /> Voltar
            </button>
            <button
              type="button"
              disabled={!canGoForward || updateStatus.isPending}
              onClick={(e) => { e.stopPropagation(); moveOrder(order.id, 1, order.status as Status); }}
              className="flex-1 flex items-center justify-center gap-0.5 rounded border bg-background px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground hover:bg-muted disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              Avançar <ChevronRight className="h-2.5 w-2.5" />
            </button>
          </div>
        )}
      </div>
    );
  };

  // Columns for technician view
  const tecnicoColumns = [
    { id: null, nome: "Sem técnico" },
    ...tecnicos,
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="page-header !mb-0">
          <h1 className="page-title">Kanban de Atendimento</h1>
          <p className="page-subtitle">{totalAtivas} ordens ativas</p>
        </div>
        <div className="flex items-center gap-2">
          {/* View mode toggle */}
          <div className="flex rounded-lg border overflow-hidden">
            <button
              onClick={() => setViewMode("status")}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium transition-colors",
                viewMode === "status" ? "bg-primary text-primary-foreground" : "bg-card text-muted-foreground hover:bg-muted"
              )}
            >
              <Columns3 className="h-3.5 w-3.5" /> Por Status
            </button>
            <button
              onClick={() => setViewMode("tecnico")}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium transition-colors",
                viewMode === "tecnico" ? "bg-primary text-primary-foreground" : "bg-card text-muted-foreground hover:bg-muted"
              )}
            >
              <Users className="h-3.5 w-3.5" /> Por Técnico
            </button>
          </div>
          <Link
            to="/assistencia"
            className="inline-flex items-center gap-1.5 rounded-md border bg-card px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted transition-colors"
          >
            <List className="h-3.5 w-3.5" /> Lista
          </Link>
        </div>
      </div>

      {/* Kanban board */}
      <div className="flex gap-2.5 overflow-x-auto pb-4 -mx-4 px-4 md:-mx-6 md:px-6 lg:-mx-8 lg:px-8 snap-x" style={{ minHeight: "calc(100vh - 200px)" }}>
        {viewMode === "status" ? (
          // === STATUS VIEW ===
          statusFlow.map((status) => {
            const columnOrders = orders.filter((o) => o.status === status);
            const isDropTarget = dragOverColumn === status;

            return (
              <div
                key={status}
                className={cn(
                  "flex-shrink-0 w-60 md:w-[17rem] rounded-xl border flex flex-col snap-start transition-all",
                  isDropTarget && "ring-2 ring-primary/40 bg-primary/5",
                  !isDropTarget && "bg-muted/30"
                )}
                onDragOver={(e) => handleDragOver(e, status)}
                onDragLeave={handleDragLeave}
                onDrop={(e) => handleDropStatus(e, status)}
              >
                <div className={cn("px-3 py-2.5 rounded-t-xl flex items-center justify-between", statusHeaderColors[status])}>
                  <div className="flex items-center gap-2">
                    <div className={cn("w-2 h-2 rounded-full", statusDotColors[status])} />
                    <span className="text-xs font-semibold">{statusLabels[status]}</span>
                  </div>
                  <span className="text-[11px] text-muted-foreground bg-background/80 rounded-full px-2 py-0.5 font-semibold tabular-nums">
                    {columnOrders.length}
                  </span>
                </div>

                <div className="flex-1 px-2 py-2 space-y-2 min-h-[100px] overflow-y-auto max-h-[calc(100vh-280px)]">
                  {columnOrders.map((order) => renderCard(order, false))}
                  {columnOrders.length === 0 && (
                    <div className="flex items-center justify-center h-20 text-[11px] text-muted-foreground/60 italic">
                      Nenhuma ordem
                    </div>
                  )}
                </div>
              </div>
            );
          })
        ) : (
          // === TECHNICIAN VIEW ===
          tecnicoColumns.map((tec) => {
            const columnOrders = orders.filter((o) => {
              if (o.status === "entregue") return false;
              if (tec.id === null) return !o.funcionario_id;
              return o.funcionario_id === tec.id;
            });
            const colKey = tec.id ?? "__none__";
            const isDropTarget = dragOverColumn === colKey;

            return (
              <div
                key={colKey}
                className={cn(
                  "flex-shrink-0 w-60 md:w-[17rem] rounded-xl border flex flex-col snap-start transition-all",
                  isDropTarget && "ring-2 ring-primary/40 bg-primary/5",
                  !isDropTarget && "bg-muted/30"
                )}
                onDragOver={(e) => handleDragOver(e, colKey)}
                onDragLeave={handleDragLeave}
                onDrop={(e) => handleDropTecnico(e, tec.id)}
              >
                <div className="px-3 py-2.5 rounded-t-xl flex items-center justify-between bg-primary/10">
                  <div className="flex items-center gap-2">
                    <Users className="h-3.5 w-3.5 text-primary" />
                    <span className="text-xs font-semibold">{tec.nome}</span>
                  </div>
                  <span className="text-[11px] text-muted-foreground bg-background/80 rounded-full px-2 py-0.5 font-semibold tabular-nums">
                    {columnOrders.length}
                  </span>
                </div>

                <div className="flex-1 px-2 py-2 space-y-2 min-h-[100px] overflow-y-auto max-h-[calc(100vh-280px)]">
                  {columnOrders.map((order) => renderCard(order, true))}
                  {columnOrders.length === 0 && (
                    <div className="flex items-center justify-center h-20 text-[11px] text-muted-foreground/60 italic">
                      Nenhuma ordem
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      <OrdemDetalheSheet orderId={selectedOrderId} onClose={() => setSelectedOrderId(null)} />
    </div>
  );
}
