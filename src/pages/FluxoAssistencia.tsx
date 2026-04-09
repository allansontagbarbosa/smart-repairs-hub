import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ChevronRight, ChevronLeft, Clock, AlertTriangle, LayoutGrid, List, Loader2 } from "lucide-react";
import { StatusBadge, allStatuses } from "@/components/StatusBadge";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import type { Database } from "@/integrations/supabase/types";

type Status = Database["public"]["Enums"]["status_ordem"];

const statusFlow: Status[] = [
  "recebido",
  "em_analise",
  "aguardando_aprovacao",
  "em_reparo",
  "pronto",
  "entregue",
];

const statusLabels: Record<Status, string> = {
  recebido: "Recebido",
  em_analise: "Em Análise",
  aguardando_aprovacao: "Aguard. Aprovação",
  em_reparo: "Em Reparo",
  pronto: "Pronto",
  entregue: "Entregue",
};

const statusColors: Record<Status, string> = {
  recebido: "border-t-muted-foreground/40",
  em_analise: "border-t-info",
  aguardando_aprovacao: "border-t-warning",
  em_reparo: "border-t-info",
  pronto: "border-t-success",
  entregue: "border-t-foreground/20",
};

async function fetchOrders() {
  const { data, error } = await supabase
    .from("ordens_de_servico")
    .select(`*, aparelhos ( marca, modelo, clientes ( nome, telefone ) )`)
    .order("data_entrada", { ascending: false });
  if (error) throw error;
  return data;
}

function daysAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  return Math.floor(diff / (1000 * 60 * 60 * 24));
}

export default function FluxoAssistencia() {
  const queryClient = useQueryClient();
  const { data: orders = [], isLoading } = useQuery({ queryKey: ["ordens"], queryFn: fetchOrders });

  const updateStatus = useMutation({
    mutationFn: async ({ id, newStatus }: { id: string; newStatus: Status }) => {
      const updates: {
        status: Status;
        data_conclusao?: string;
        data_entrega?: string;
      } = { status: newStatus };
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

  const moveOrder = (id: string, direction: 1 | -1, currentStatus: Status) => {
    const idx = statusFlow.indexOf(currentStatus);
    const newIdx = idx + direction;
    if (newIdx < 0 || newIdx >= statusFlow.length) return;
    updateStatus.mutate({ id, newStatus: statusFlow[newIdx] });
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="page-header">
        <h1 className="page-title">Fluxo de Atendimento</h1>
        <p className="page-subtitle">Acompanhe cada aparelho pelas etapas da assistência</p>
      </div>

      {/* Kanban */}
      <div className="flex gap-3 overflow-x-auto pb-4 -mx-4 px-4 md:-mx-6 md:px-6 lg:-mx-8 lg:px-8 snap-x">
        {statusFlow.map((status) => {
          const columnOrders = orders.filter((o) => o.status === status);
          return (
            <div
              key={status}
              className={cn(
                "flex-shrink-0 w-64 md:w-72 bg-muted/40 rounded-xl border border-t-[3px] flex flex-col snap-start",
                statusColors[status]
              )}
            >
              {/* Column header */}
              <div className="px-3 py-3 flex items-center justify-between">
                <span className="text-xs font-semibold">{statusLabels[status]}</span>
                <span className="text-xs text-muted-foreground bg-background rounded-full px-2 py-0.5 font-medium">
                  {columnOrders.length}
                </span>
              </div>

              {/* Cards */}
              <div className="flex-1 px-2 pb-2 space-y-2 min-h-[120px]">
                {columnOrders.map((order) => {
                  const days = daysAgo(order.data_entrada);
                  const isStale = status !== "entregue" && days >= 5;
                  const idx = statusFlow.indexOf(status);
                  const canGoBack = idx > 0;
                  const canGoForward = idx < statusFlow.length - 1;

                  return (
                    <div
                      key={order.id}
                      className={cn(
                        "bg-card rounded-lg border p-3 space-y-2 transition-shadow hover:shadow-sm",
                        isStale && "ring-1 ring-warning/40"
                      )}
                    >
                      {/* Client + device */}
                      <div>
                        <p className="text-sm font-medium leading-tight truncate">
                          {order.aparelhos?.clientes?.nome ?? "—"}
                        </p>
                        <p className="text-xs text-muted-foreground truncate">
                          {order.aparelhos?.marca} {order.aparelhos?.modelo}
                        </p>
                      </div>

                      {/* Defect */}
                      <p className="text-xs text-muted-foreground line-clamp-2">{order.defeito_relatado}</p>

                      {/* Meta row */}
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-mono text-muted-foreground">#{String(order.numero).padStart(3, "0")}</span>
                          {isStale ? (
                            <span className="inline-flex items-center gap-0.5 text-[10px] text-warning font-medium">
                              <AlertTriangle className="h-3 w-3" />
                              {days}d
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-0.5 text-[10px] text-muted-foreground">
                              <Clock className="h-3 w-3" />
                              {days}d
                            </span>
                          )}
                        </div>
                        {order.valor ? (
                          <span className="text-[10px] font-medium">
                            R$ {Number(order.valor).toLocaleString("pt-BR", { minimumFractionDigits: 0 })}
                          </span>
                        ) : null}
                      </div>

                      {/* Move buttons */}
                      <div className="flex gap-1.5 pt-1">
                        <button
                          type="button"
                          disabled={!canGoBack || updateStatus.isPending}
                          onClick={() => moveOrder(order.id, -1, status)}
                          className="flex-1 flex items-center justify-center gap-1 rounded-md border bg-background px-2 py-1 text-[10px] font-medium text-muted-foreground hover:bg-muted disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                        >
                          <ChevronLeft className="h-3 w-3" />
                          Voltar
                        </button>
                        <button
                          type="button"
                          disabled={!canGoForward || updateStatus.isPending}
                          onClick={() => moveOrder(order.id, 1, status)}
                          className="flex-1 flex items-center justify-center gap-1 rounded-md border bg-background px-2 py-1 text-[10px] font-medium text-muted-foreground hover:bg-muted disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                        >
                          Avançar
                          <ChevronRight className="h-3 w-3" />
                        </button>
                      </div>
                    </div>
                  );
                })}

                {columnOrders.length === 0 && (
                  <div className="flex items-center justify-center h-20 text-xs text-muted-foreground">
                    Nenhum aparelho
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
