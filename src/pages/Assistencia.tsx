import { useState } from "react";
import { Plus, Search, Loader2, LayoutGrid, MessageCircle, ChevronRight, CheckCircle, Truck } from "lucide-react";
import { Link, useSearchParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { StatusBadge, allStatuses } from "@/components/StatusBadge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { NovaOrdemDialog } from "@/components/NovaOrdemDialog";
import { OrdemDetalheSheet } from "@/components/OrdemDetalheSheet";
import { useAlertas } from "@/hooks/useAlertas";
import { AlertsBanner } from "@/components/AlertsBanner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { Database } from "@/integrations/supabase/types";

type Status = Database["public"]["Enums"]["status_ordem"];

const statusFlow: Status[] = ["recebido", "em_analise", "aguardando_aprovacao", "em_reparo", "pronto", "entregue"];
const statusLabels: Record<Status, string> = {
  recebido: "Recebido",
  em_analise: "Em Análise",
  aguardando_aprovacao: "Aguard. Aprovação",
  em_reparo: "Em Reparo",
  pronto: "Pronto",
  entregue: "Entregue",
};

async function fetchOrders() {
  const { data, error } = await supabase
    .from("ordens_de_servico")
    .select(`*, aparelhos ( marca, modelo, clientes ( nome, telefone ) )`)
    .order("data_entrada", { ascending: false });
  if (error) throw error;
  return data;
}

export default function Assistencia() {
  const [searchParams] = useSearchParams();
  const initialStatus = searchParams.get("status") || "todos";
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>(initialStatus);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const queryClient = useQueryClient();

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
    const clean = phone.replace(/\D/g, "");
    const full = clean.startsWith("55") ? clean : `55${clean}`;
    const msg = encodeURIComponent(
      `Olá! Informamos sobre a OS #${String(orderNum).padStart(3, "0")}. Por favor, entre em contato conosco.`
    );
    window.open(`https://wa.me/${full}?text=${msg}`, "_blank");
  };

  const getNextStatus = (current: Status): Status | null => {
    const idx = statusFlow.indexOf(current);
    if (idx < 0 || idx >= statusFlow.length - 1) return null;
    return statusFlow[idx + 1];
  };

  const filtered = orders.filter((o) => {
    const clientName = o.aparelhos?.clientes?.nome ?? "";
    const clientPhone = o.aparelhos?.clientes?.telefone ?? "";
    const device = `${o.aparelhos?.marca ?? ""} ${o.aparelhos?.modelo ?? ""}`;
    const q = search.toLowerCase();
    const matchSearch = !search || clientName.toLowerCase().includes(q) || clientPhone.includes(q) || device.toLowerCase().includes(q) || String(o.numero).includes(q);
    const matchStatus = filterStatus === "todos" ? o.status !== "entregue" : o.status === filterStatus;
    return matchSearch && matchStatus;
  });

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
          <p className="page-subtitle">{filtered.length} ordens de serviço</p>
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
                  <th className="hidden lg:table-cell">Defeito</th>
                  <th>Status</th>
                  <th className="hidden md:table-cell">Entrada</th>
                  <th className="hidden sm:table-cell">Técnico</th>
                  <th className="text-right">Ações</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((order) => {
                  const nextStatus = getNextStatus(order.status as Status);
                  const phone = order.aparelhos?.clientes?.telefone;
                  return (
                    <tr key={order.id}>
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
                                onClick={() => updateStatusMutation.mutate({ id: order.id, status: s })}
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
                      <td className="hidden sm:table-cell text-sm">{order.tecnico ?? "—"}</td>
                      <td>
                        <div className="flex items-center justify-end gap-1">
                          {/* WhatsApp */}
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-success hover:text-success"
                            title="Enviar WhatsApp"
                            onClick={() => handleWhatsApp(phone, order.numero)}
                          >
                            <MessageCircle className="h-3.5 w-3.5" />
                          </Button>

                          {/* Quick: Mark as Pronto */}
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

                          {/* Quick: Mark as Entregue */}
                          {order.status === "pronto" && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-success hover:text-success"
                              title="Marcar como Entregue"
                              onClick={() => updateStatusMutation.mutate({ id: order.id, status: "entregue" })}
                            >
                              <Truck className="h-3.5 w-3.5" />
                            </Button>
                          )}

                          {/* Advance to next status */}
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
                {filtered.length === 0 && (
                  <tr><td colSpan={7} className="text-center text-muted-foreground py-10 text-sm">Nenhuma ordem encontrada</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <OrdemDetalheSheet orderId={selectedOrderId} onClose={() => setSelectedOrderId(null)} />
    </div>
  );
}
