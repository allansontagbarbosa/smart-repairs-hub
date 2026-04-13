import { useState, useEffect } from "react";
import { Plus, Search, Loader2, LayoutGrid, MessageCircle, ChevronRight, CheckCircle, Truck, AlertTriangle, Clock, CircleDot } from "lucide-react";
import { Link, useSearchParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { StatusBadge, allStatuses } from "@/components/StatusBadge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { abrirWhatsApp } from "@/lib/whatsapp";
import { NovaOrdemDialog } from "@/components/NovaOrdemDialog";
import { OrdemDetalheSheet } from "@/components/OrdemDetalheSheet";
import { useAlertas } from "@/hooks/useAlertas";
import { AlertsBanner } from "@/components/AlertsBanner";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { ConfirmarEntregaDialog, useConfirmarEntrega } from "@/components/ConfirmarEntregaDialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { Database } from "@/integrations/supabase/types";
import { calcularPrioridade, type Prioridade } from "@/lib/prioridade";
import { statusFlow, statusLabels, type Status } from "@/lib/status";


const prioridadeConfig: Record<Prioridade, { color: string; bg: string; icon: typeof AlertTriangle }> = {
  critica: { color: "text-destructive", bg: "bg-destructive/10 border-destructive/30", icon: AlertTriangle },
  atencao: { color: "text-warning", bg: "bg-warning/10 border-warning/30", icon: Clock },
  normal: { color: "text-success", bg: "bg-success/10 border-success/30", icon: CircleDot },
};

async function fetchOrders() {
  const { data, error } = await supabase
    .from("ordens_de_servico")
    .select(`*, aparelhos ( marca, modelo, clientes ( nome, telefone ) )`)
    .order("data_entrada", { ascending: false });
  if (error) throw error;
  return data;
}

function PrioridadeBadge({ nivel, motivo }: { nivel: Prioridade; motivo: string }) {
  const cfg = prioridadeConfig[nivel];
  const Icon = cfg.icon;
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${cfg.bg} ${cfg.color}`}>
          <Icon className="h-3 w-3" />
          {nivel === "critica" ? "Urgente" : nivel === "atencao" ? "Atenção" : "OK"}
        </span>
      </TooltipTrigger>
      <TooltipContent side="top" className="text-xs">{motivo}</TooltipContent>
    </Tooltip>
  );
}

export default function Assistencia() {
  const [searchParams] = useSearchParams();
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("todos");

  useEffect(() => {
    const status = searchParams.get("status");
    setFilterStatus(status || "todos");
  }, [searchParams]);
  const [filterPrioridade, setFilterPrioridade] = useState<string>("todas");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const queryClient = useQueryClient();
  const { entrega, pedirConfirmacao, cancelar } = useConfirmarEntrega();

  const { data: orders = [], isLoading } = useQuery({
    queryKey: ["ordens"],
    queryFn: fetchOrders,
  });

  const alertas = useAlertas(orders);

  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: Status }) => {
      const updates: any = { status };
      if (status === "entregue") updates.data_entrega = new Date().toISOString();
      if (status === "pronto") updates.data_conclusao = new Date().toISOString();
      const { error } = await supabase.from("ordens_de_servico").update(updates).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ordens"] });
      toast.success("Status atualizado!");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const handleWhatsApp = (phone: string | undefined, orderNum: number) => {
    if (!phone) return toast.error("Cliente sem telefone cadastrado");
    abrirWhatsApp(phone, `Olá! Informamos sobre a OS #${String(orderNum).padStart(3, "0")}. Por favor, entre em contato conosco.`);
  };

  const getNextStatus = (current: Status): Status | null => {
    const idx = statusFlow.indexOf(current);
    if (idx < 0 || idx >= statusFlow.length - 1) return null;
    return statusFlow[idx + 1];
  };

  const enrichedOrders = orders.map((o) => {
    const prio = calcularPrioridade(o.status, o.data_entrada, o.previsao_entrega);
    return { ...o, prioridade: prio };
  });

  const filtered = enrichedOrders.filter((o) => {
    const clientName = o.aparelhos?.clientes?.nome ?? "";
    const clientPhone = o.aparelhos?.clientes?.telefone ?? "";
    const device = `${o.aparelhos?.marca ?? ""} ${o.aparelhos?.modelo ?? ""}`;
    const q = search.toLowerCase();
    const matchSearch = !search || clientName.toLowerCase().includes(q) || clientPhone.includes(q) || device.toLowerCase().includes(q) || String(o.numero).includes(q);
    const matchStatus = filterStatus === "todos" ? o.status !== "entregue" : o.status === filterStatus;
    const matchPrioridade = filterPrioridade === "todas" || o.prioridade.nivel === filterPrioridade;
    return matchSearch && matchStatus && matchPrioridade;
  });

  const prioOrder: Record<Prioridade, number> = { critica: 0, atencao: 1, normal: 2 };
  const sorted = [...filtered].sort((a, b) => prioOrder[a.prioridade.nivel] - prioOrder[b.prioridade.nivel]);

  const activePrios = enrichedOrders.filter((o) => o.status !== "entregue");
  const countCritica = activePrios.filter((o) => o.prioridade.nivel === "critica").length;
  const countAtencao = activePrios.filter((o) => o.prioridade.nivel === "atencao").length;

  const formatDate = (d: string | null) => {
    if (!d) return "—";
    return new Date(d).toLocaleDateString("pt-BR");
  };

  const formatCurrency = (v: number | null) => {
    if (!v) return "—";
    return `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 0 })}`;
  };

  return (
    <div className="space-y-5 md:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="page-header !mb-0">
          <h1 className="page-title">Assistência Técnica</h1>
          <p className="page-subtitle">{sorted.length} ordens de serviço</p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            to="/assistencia/fluxo"
            className="inline-flex items-center gap-1.5 rounded-md border bg-card px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted transition-colors"
          >
            <LayoutGrid className="h-3.5 w-3.5" />
            Kanban
          </Link>
          <Button size="sm" onClick={() => setDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-1.5" />Nova Ordem
          </Button>
        </div>
      </div>

      <NovaOrdemDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ["ordens"] });
        }}
      />

      {/* Priority summary bar */}
      {(countCritica > 0 || countAtencao > 0) && (
        <div className="flex items-center gap-3 flex-wrap">
          {countCritica > 0 && (
            <button
              onClick={() => setFilterPrioridade(filterPrioridade === "critica" ? "todas" : "critica")}
              className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors ${
                filterPrioridade === "critica"
                  ? "bg-destructive text-destructive-foreground border-destructive"
                  : "bg-destructive/10 text-destructive border-destructive/30 hover:bg-destructive/20"
              }`}
            >
              <AlertTriangle className="h-3.5 w-3.5" />
              {countCritica} urgente{countCritica > 1 ? "s" : ""}
            </button>
          )}
          {countAtencao > 0 && (
            <button
              onClick={() => setFilterPrioridade(filterPrioridade === "atencao" ? "todas" : "atencao")}
              className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors ${
                filterPrioridade === "atencao"
                  ? "bg-warning text-warning-foreground border-warning"
                  : "bg-warning/10 text-warning border-warning/30 hover:bg-warning/20"
              }`}
            >
              <Clock className="h-3.5 w-3.5" />
              {countAtencao} atenção
            </button>
          )}
          {filterPrioridade !== "todas" && (
            <button
              onClick={() => setFilterPrioridade("todas")}
              className="text-xs text-muted-foreground hover:text-foreground underline"
            >
              Limpar filtro
            </button>
          )}
        </div>
      )}

      {alertas.length > 0 && (
        <AlertsBanner alertas={alertas} max={3} onClickAlert={setSelectedOrderId} />
      )}

      <div className="flex flex-col sm:flex-row gap-2.5">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar cliente, telefone ou aparelho..." className="pl-9 h-9" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-full sm:w-44 h-9"><SelectValue /></SelectTrigger>
          <SelectContent>
            {allStatuses.map((s) => (
              <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="section-card">
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>OS</th>
                  <th>Cliente / Aparelho</th>
                  <th className="hidden md:table-cell">Prioridade</th>
                  <th className="hidden lg:table-cell">Defeito</th>
                  <th>Status</th>
                  <th className="hidden md:table-cell">Entrada</th>
                  <th className="hidden sm:table-cell text-right">Lucro</th>
                  <th className="text-right">Ações</th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((order) => {
                  const nextStatus = getNextStatus(order.status as Status);
                  const phone = order.aparelhos?.clientes?.telefone;
                  const isCritica = order.prioridade.nivel === "critica";
                  return (
                    <tr key={order.id} className={isCritica ? "bg-destructive/5" : ""}>
                      <td
                        className="font-mono text-xs text-muted-foreground cursor-pointer hover:text-foreground"
                        onClick={() => setSelectedOrderId(order.id)}
                      >
                        #{String(order.numero).padStart(3, "0")}
                      </td>
                      <td className="cursor-pointer" onClick={() => setSelectedOrderId(order.id)}>
                        <p className="font-medium text-sm">{order.aparelhos?.clientes?.nome ?? "—"}</p>
                        <p className="text-xs text-muted-foreground">{order.aparelhos?.marca} {order.aparelhos?.modelo}</p>
                      </td>
                      <td className="hidden md:table-cell">
                        <PrioridadeBadge nivel={order.prioridade.nivel} motivo={order.prioridade.motivo} />
                      </td>
                      <td
                        className="hidden lg:table-cell text-sm text-muted-foreground max-w-48 truncate cursor-pointer"
                        onClick={() => setSelectedOrderId(order.id)}
                      >
                        {order.defeito_relatado}
                      </td>
                      <td>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <button className="focus:outline-none">
                              <StatusBadge status={order.status} />
                            </button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="start" className="w-44">
                            {statusFlow.map((s) => (
                              <DropdownMenuItem
                                key={s}
                                disabled={s === order.status}
                                onClick={() => {
                                  if (s === "entregue") {
                                    pedirConfirmacao({
                                      orderId: order.id,
                                      numero: order.numero,
                                      clienteNome: order.aparelhos?.clientes?.nome ?? "—",
                                    });
                                  } else {
                                    updateStatusMutation.mutate({ id: order.id, status: s });
                                  }
                                }}
                                className="text-xs"
                              >
                                {statusLabels[s]}
                                {s === order.status && <span className="ml-auto text-muted-foreground">atual</span>}
                              </DropdownMenuItem>
                            ))}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </td>
                      <td className="hidden md:table-cell text-sm text-muted-foreground">{formatDate(order.data_entrada)}</td>
                      <td className="hidden sm:table-cell text-sm text-right">
                        {(() => {
                          const valor = Number(order.valor ?? 0);
                          const custo = Number(order.custo_pecas ?? 0);
                          const lucro = valor - custo;
                          if (!valor) return <span className="text-muted-foreground">—</span>;
                          return (
                            <span className={lucro >= 0 ? "text-success font-medium" : "text-destructive font-medium"}>
                              {formatCurrency(lucro)}
                            </span>
                          );
                        })()}
                      </td>
                      <td>
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-success hover:text-success"
                            title="Enviar WhatsApp"
                            onClick={() => handleWhatsApp(phone, order.numero)}
                          >
                            <MessageCircle className="h-3.5 w-3.5" />
                          </Button>
                          {!["pronto", "entregue"].includes(order.status) && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-info hover:text-info"
                              title="Marcar como Pronto"
                              onClick={() => updateStatusMutation.mutate({ id: order.id, status: "pronto" })}
                            >
                              <CheckCircle className="h-3.5 w-3.5" />
                            </Button>
                          )}
                          {order.status === "pronto" && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-success hover:text-success"
                              title="Marcar como Entregue"
                              onClick={() => pedirConfirmacao({
                                orderId: order.id,
                                numero: order.numero,
                                clienteNome: order.aparelhos?.clientes?.nome ?? "—",
                              })}
                            >
                              <Truck className="h-3.5 w-3.5" />
                            </Button>
                          )}
                          {nextStatus && order.status !== "pronto" && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
                              title={`Avançar para ${statusLabels[nextStatus]}`}
                              onClick={() => updateStatusMutation.mutate({ id: order.id, status: nextStatus })}
                            >
                              <ChevronRight className="h-3.5 w-3.5" />
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {sorted.length === 0 && (
                  <tr><td colSpan={8} className="text-center text-muted-foreground py-10 text-sm">Nenhuma ordem encontrada</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <OrdemDetalheSheet orderId={selectedOrderId} onClose={() => setSelectedOrderId(null)} />
      <ConfirmarEntregaDialog
        entrega={entrega}
        onConfirm={(id) => {
          updateStatusMutation.mutate({ id, status: "entregue" });
          cancelar();
        }}
        onCancel={cancelar}
      />
    </div>
  );
}
