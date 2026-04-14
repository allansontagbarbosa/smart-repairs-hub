import { useState, useEffect, useMemo } from "react";
import {
  Plus, Search, Loader2, LayoutGrid, MessageCircle,
  ChevronRight, CheckCircle, Truck, AlertTriangle, Clock,
  CircleDot, PackageOpen, ArrowUpDown, RefreshCw, Package,
  CalendarClock, SortAsc, Filter,
} from "lucide-react";
import { Link, useSearchParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { StatusBadge, allStatuses } from "@/components/StatusBadge";
import { toast } from "sonner";
import { abrirWhatsApp } from "@/lib/whatsapp";
import { NovaOrdemDialog } from "@/components/NovaOrdemDialog";
import { OrdemDetalheSheet } from "@/components/OrdemDetalheSheet";
import { useAlertas } from "@/hooks/useAlertas";
import { AlertsBanner } from "@/components/AlertsBanner";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { ConfirmarEntregaDialog, useConfirmarEntrega } from "@/components/ConfirmarEntregaDialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { calcularPrioridade, type Prioridade } from "@/lib/prioridade";
import { statusFlow, statusLabels, type Status } from "@/lib/status";
import { differenceInDays, format, isToday, isYesterday, isThisWeek } from "date-fns";
import { ptBR } from "date-fns/locale";

// ─── TIPOS ────────────────────────────────────────────────────────────────────

type SortKey = "prioridade" | "data_entrada" | "previsao_entrega" | "valor";
type SortDir = "asc" | "desc";

const prioridadeConfig: Record<Prioridade, { color: string; bg: string; icon: any }> = {
  critica: { color: "text-destructive", bg: "bg-destructive/10 border-destructive/30", icon: AlertTriangle },
  atencao: { color: "text-warning", bg: "bg-warning/10 border-warning/30", icon: Clock },
  normal: { color: "text-success", bg: "bg-success/10 border-success/30", icon: CircleDot },
};

const prioOrder: Record<Prioridade, number> = { critica: 0, atencao: 1, normal: 2 };

// ─── DATA FETCH ───────────────────────────────────────────────────────────────

async function fetchOrders() {
  const { data, error } = await supabase
    .from("ordens_de_servico")
    .select(`*, aparelhos ( marca, modelo, clientes ( nome, telefone ) )`)
    .order("data_entrada", { ascending: false });
  if (error) throw error;
  return data;
}

// ─── HELPERS ─────────────────────────────────────────────────────────────────

function formatCurrency(v: number | null) {
  if (!v) return "—";
  return `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 0 })}`;
}

function formatDate(d: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("pt-BR");
}

function grupoData(dataEntrada: string): string {
  const d = new Date(dataEntrada);
  if (isToday(d)) return "Hoje";
  if (isYesterday(d)) return "Ontem";
  if (isThisWeek(d, { locale: ptBR })) return "Esta semana";
  return format(d, "MMMM yyyy", { locale: ptBR });
}

// ─── SUB-COMPONENTES ──────────────────────────────────────────────────────────

function PrioridadeBadge({ nivel, motivo }: { nivel: Prioridade; motivo: string }) {
  const cfg = prioridadeConfig[nivel];
  const Icon = cfg.icon;
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold ${cfg.bg} ${cfg.color}`}>
          <Icon className="h-3 w-3" />
          {nivel === "critica" ? "Urgente" : nivel === "atencao" ? "Atenção" : "OK"}
        </span>
      </TooltipTrigger>
      <TooltipContent>{motivo}</TooltipContent>
    </Tooltip>
  );
}

function PrazoTag({ previsao, status }: { previsao: string | null; status: string }) {
  if (!previsao || status === "entregue" || status === "pronto") return null;
  const dias = differenceInDays(new Date(previsao), new Date());
  if (dias < 0)
    return (
      <span className="inline-flex items-center gap-1 text-[10px] text-destructive font-medium">
        <AlertTriangle className="h-3 w-3" /> {Math.abs(dias)}d atraso
      </span>
    );
  if (dias === 0)
    return (
      <span className="inline-flex items-center gap-1 text-[10px] text-warning font-medium">
        <Clock className="h-3 w-3" /> vence hoje
      </span>
    );
  if (dias <= 2)
    return (
      <span className="inline-flex items-center gap-1 text-[10px] text-warning font-medium">
        <CalendarClock className="h-3 w-3" /> {dias}d restante{dias > 1 ? "s" : ""}
      </span>
    );
  return (
    <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground">
      <CalendarClock className="h-3 w-3" /> {formatDate(previsao)}
    </span>
  );
}

function PecasPendentesTag({ temPeca }: { temPeca: boolean }) {
  if (!temPeca) return null;
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="inline-flex items-center gap-1 text-[10px] text-orange-600 font-medium">
          <Package className="h-3 w-3" /> peça pendente
        </span>
      </TooltipTrigger>
      <TooltipContent>Aguardando chegada de peça</TooltipContent>
    </Tooltip>
  );
}

// Chips de status com contador
function StatusChips({
  counts,
  active,
  onChange,
}: {
  counts: Record<string, number>;
  active: string;
  onChange: (v: string) => void;
}) {
  const chips = [
    { value: "todos", label: "Todos" },
    ...allStatuses.filter((s) => s.value !== "todos" && s.value !== "entregue"),
    { value: "entregue", label: "Entregues" },
  ];

  return (
    <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-hide">
      {chips.map((chip) => {
        const count = counts[chip.value] ?? 0;
        const isActive = active === chip.value;
        return (
          <button
            key={chip.value}
            onClick={() => onChange(chip.value)}
            className={`shrink-0 inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition-colors border ${
              isActive
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-card text-muted-foreground border-border hover:bg-muted"
            }`}
          >
            {chip.label}
            {count > 0 && (
              <span className={`text-[10px] ${isActive ? "opacity-80" : "opacity-60"}`}>
                {count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

// ─── COMPONENTE PRINCIPAL ─────────────────────────────────────────────────────

export default function Assistencia() {
  const [searchParams] = useSearchParams();
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("todos");
  const [filterPrioridade, setFilterPrioridade] = useState<"todas" | Prioridade>("todas");
  const [sortKey, setSortKey] = useState<SortKey>("prioridade");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [agrupar, setAgrupar] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);

  const queryClient = useQueryClient();
  const { entrega, pedirConfirmacao, cancelar } = useConfirmarEntrega();

  useEffect(() => {
    const status = searchParams.get("status");
    setFilterStatus(status || "todos");
  }, [searchParams]);

  const { data: orders = [], isLoading, refetch, isFetching } = useQuery({
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
    onError: (e: Error) => toast.error(e.message),
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

  // ── ENRICH + FILTRO + SORT ────────────────────────────────────────────────

  const enriched = useMemo(() =>
    orders.map((o) => ({
      ...o,
      prioridade: calcularPrioridade(o.status, o.data_entrada, o.previsao_entrega),
      temPecaPendente: o.status === "aguardando_peca",
    })),
    [orders]
  );

  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = { todos: 0 };
    for (const o of enriched) {
      counts[o.status] = (counts[o.status] ?? 0) + 1;
      if (o.status !== "entregue") counts["todos"] = (counts["todos"] ?? 0) + 1;
    }
    return counts;
  }, [enriched]);

  const filtered = useMemo(() => {
    return enriched.filter((o) => {
      const clientName = o.aparelhos?.clientes?.nome ?? "";
      const clientPhone = o.aparelhos?.clientes?.telefone ?? "";
      const device = `${o.aparelhos?.marca ?? ""} ${o.aparelhos?.modelo ?? ""}`;
      const q = search.toLowerCase();
      const matchSearch =
        !search ||
        clientName.toLowerCase().includes(q) ||
        clientPhone.includes(q) ||
        device.toLowerCase().includes(q) ||
        String(o.numero).includes(q);
      const matchStatus =
        filterStatus === "todos" ? o.status !== "entregue" : o.status === filterStatus;
      const matchPrioridade =
        filterPrioridade === "todas" || o.prioridade.nivel === filterPrioridade;
      return matchSearch && matchStatus && matchPrioridade;
    });
  }, [enriched, search, filterStatus, filterPrioridade]);

  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      let cmp = 0;
      if (sortKey === "prioridade") cmp = prioOrder[a.prioridade.nivel] - prioOrder[b.prioridade.nivel];
      else if (sortKey === "data_entrada")
        cmp = new Date(a.data_entrada).getTime() - new Date(b.data_entrada).getTime();
      else if (sortKey === "previsao_entrega") {
        const ap = a.previsao_entrega ? new Date(a.previsao_entrega).getTime() : Infinity;
        const bp = b.previsao_entrega ? new Date(b.previsao_entrega).getTime() : Infinity;
        cmp = ap - bp;
      } else if (sortKey === "valor") {
        cmp = (Number(a.valor) || 0) - (Number(b.valor) || 0);
      }
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [filtered, sortKey, sortDir]);

  const grupos = useMemo(() => {
    if (!agrupar) return null;
    const map = new Map<string, typeof sorted>();
    for (const o of sorted) {
      const g = grupoData(o.data_entrada);
      if (!map.has(g)) map.set(g, []);
      map.get(g)!.push(o);
    }
    return map;
  }, [sorted, agrupar]);

  const activeOrders = enriched.filter((o) => o.status !== "entregue");
  const countCritica = activeOrders.filter((o) => o.prioridade.nivel === "critica").length;
  const countAtencao = activeOrders.filter((o) => o.prioridade.nivel === "atencao").length;

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(key); setSortDir("asc"); }
  }

  function SortBtn({ label, k }: { label: string; k: SortKey }) {
    const isActive = sortKey === k;
    return (
      <button
        onClick={() => toggleSort(k)}
        className={`inline-flex items-center gap-1 text-xs px-2 py-1 rounded border transition-colors ${
          isActive
            ? "bg-primary/10 text-primary border-primary/30 font-medium"
            : "text-muted-foreground border-border hover:bg-muted"
        }`}
      >
        {label}
        <ArrowUpDown className="h-3 w-3" />
        {isActive && <span className="text-[10px]">{sortDir === "asc" ? "↑" : "↓"}</span>}
      </button>
    );
  }

  // ── RENDER DE LINHA ───────────────────────────────────────────────────────

  function OrderRow({ order }: { order: typeof sorted[number] }) {
    const nextStatus = getNextStatus(order.status as Status);
    const phone = order.aparelhos?.clientes?.telefone;
    const isCritica = order.prioridade.nivel === "critica";
    const valor = Number(order.valor ?? 0);
    const custo = Number(order.custo_pecas ?? 0);
    const lucro = valor - custo;

    return (
      <tr className={`border-b border-border/50 hover:bg-muted/30 transition-colors ${isCritica ? "bg-destructive/5" : ""}`}>
        <td className="px-3 py-2.5 font-mono text-xs text-primary cursor-pointer hover:underline"
          onClick={() => setSelectedOrderId(order.id)}
        >
          #{String(order.numero).padStart(3, "0")}
        </td>

        <td className="px-3 py-2.5 cursor-pointer" onClick={() => setSelectedOrderId(order.id)}>
          <p className="text-sm font-medium truncate max-w-[180px]">{order.aparelhos?.clientes?.nome ?? "—"}</p>
          <p className="text-xs text-muted-foreground truncate">{order.aparelhos?.marca} {order.aparelhos?.modelo}</p>
          <div className="flex gap-2 mt-0.5">
            <PrazoTag previsao={order.previsao_entrega} status={order.status} />
            <PecasPendentesTag temPeca={order.temPecaPendente} />
          </div>
        </td>

        <td className="px-3 py-2.5">
          <PrioridadeBadge nivel={order.prioridade.nivel} motivo={order.prioridade.motivo} />
        </td>

        <td className="px-3 py-2.5 text-xs text-muted-foreground max-w-[200px] truncate cursor-pointer"
          onClick={() => setSelectedOrderId(order.id)}
        >
          {order.defeito_relatado}
        </td>

        <td className="px-3 py-2.5">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="focus:outline-none">
                <StatusBadge status={order.status} />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {statusFlow.map((s) => (
                <DropdownMenuItem
                  key={s}
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
                  {s === order.status && <span className="ml-auto text-[10px] text-muted-foreground">atual</span>}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </td>

        <td className="px-3 py-2.5 text-xs text-muted-foreground">
          {formatDate(order.data_entrada)}
        </td>

        <td className="px-3 py-2.5 text-xs text-right">
          {valor ? (
            <span className={lucro >= 0 ? "text-success font-medium" : "text-destructive font-medium"}>
              {formatCurrency(lucro)}
            </span>
          ) : (
            <span className="text-muted-foreground">—</span>
          )}
        </td>

        <td className="px-3 py-2.5">
          <div className="flex items-center gap-1">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" className="h-7 w-7"
                  onClick={() => handleWhatsApp(phone, order.numero)}
                >
                  <MessageCircle className="h-3.5 w-3.5 text-green-600" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Enviar WhatsApp</TooltipContent>
            </Tooltip>

            {!["pronto", "entregue"].includes(order.status) && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-7 w-7"
                    onClick={() => updateStatusMutation.mutate({ id: order.id, status: "pronto" })}
                  >
                    <CheckCircle className="h-3.5 w-3.5 text-blue-600" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Marcar como Pronto</TooltipContent>
              </Tooltip>
            )}

            {order.status === "pronto" && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-7 w-7"
                    onClick={() =>
                      pedirConfirmacao({
                        orderId: order.id,
                        numero: order.numero,
                        clienteNome: order.aparelhos?.clientes?.nome ?? "—",
                      })
                    }
                  >
                    <Truck className="h-3.5 w-3.5 text-emerald-600" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Marcar como Entregue</TooltipContent>
              </Tooltip>
            )}

            {nextStatus && order.status !== "pronto" && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-7 w-7"
                    onClick={() => updateStatusMutation.mutate({ id: order.id, status: nextStatus })}
                  >
                    <ChevronRight className="h-3.5 w-3.5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Avançar para {statusLabels[nextStatus]}</TooltipContent>
              </Tooltip>
            )}
          </div>
        </td>
      </tr>
    );
  }

  // ── TABELA ────────────────────────────────────────────────────────────────

  function Tabela({ items }: { items: typeof sorted }) {
    return (
      <div className="rounded-lg border border-border bg-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-muted/50 border-b border-border">
              <tr>
                <th className="px-3 py-2 text-xs font-semibold text-muted-foreground">OS</th>
                <th className="px-3 py-2 text-xs font-semibold text-muted-foreground">Cliente / Aparelho</th>
                <th className="px-3 py-2 text-xs font-semibold text-muted-foreground">Prioridade</th>
                <th className="px-3 py-2 text-xs font-semibold text-muted-foreground">Defeito</th>
                <th className="px-3 py-2 text-xs font-semibold text-muted-foreground">Status</th>
                <th className="px-3 py-2 text-xs font-semibold text-muted-foreground">Entrada</th>
                <th className="px-3 py-2 text-xs font-semibold text-muted-foreground text-right">Lucro</th>
                <th className="px-3 py-2 text-xs font-semibold text-muted-foreground">Ações</th>
              </tr>
            </thead>
            <tbody>
              {items.map((order) => (
                <OrderRow key={order.id} order={order} />
              ))}
              {items.length === 0 && (
                <tr>
                  <td colSpan={8} className="text-center text-sm text-muted-foreground py-12">
                    Nenhuma ordem encontrada
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER PRINCIPAL
  // ─────────────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold">Assistência Técnica</h1>
          <p className="text-sm text-muted-foreground">
            {sorted.length} ordens{filterStatus !== "todos" ? ` — ${allStatuses.find(s => s.value === filterStatus)?.label}` : " ativas"}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="outline" size="icon" className="h-9 w-9" onClick={() => refetch()} disabled={isFetching}>
                <RefreshCw className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`} />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Atualizar</TooltipContent>
          </Tooltip>

          <Button variant="outline" size="sm" asChild>
            <Link to="/assistencia/fluxo"><LayoutGrid className="h-4 w-4 mr-1" /> Kanban</Link>
          </Button>
          <Button variant="outline" size="sm" asChild>
            <Link to="/assistencia/lote">
              <PackageOpen className="h-4 w-4 mr-1" /> Lote
            </Link>
          </Button>
          <Button size="sm" onClick={() => setDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-1" /> Nova Ordem
          </Button>
        </div>
      </div>

      <NovaOrdemDialog open={dialogOpen} onOpenChange={setDialogOpen}
        onSuccess={() => queryClient.invalidateQueries({ queryKey: ["ordens"] })}
      />

      {(countCritica > 0 || countAtencao > 0) && (
        <div className="flex items-center gap-2 flex-wrap">
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
            <button onClick={() => setFilterPrioridade("todas")} className="text-xs text-muted-foreground hover:text-foreground underline">
              Limpar filtro
            </button>
          )}
        </div>
      )}

      {alertas.length > 0 && (
        <AlertsBanner alertas={alertas} />
      )}

      <div className="space-y-2">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por cliente, telefone, aparelho ou nº OS..."
            className="pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <StatusChips counts={statusCounts} active={filterStatus} onChange={setFilterStatus} />
      </div>

      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-muted-foreground flex items-center gap-1">
            <SortAsc className="h-3.5 w-3.5" /> Ordenar:
          </span>
          <SortBtn label="Prioridade" k="prioridade" />
          <SortBtn label="Data entrada" k="data_entrada" />
          <SortBtn label="Previsão" k="previsao_entrega" />
          <SortBtn label="Valor" k="valor" />
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setAgrupar((v) => !v)}
            className={`inline-flex items-center gap-1.5 text-xs px-2 py-1 rounded border transition-colors ${
              agrupar
                ? "bg-primary/10 text-primary border-primary/30 font-medium"
                : "text-muted-foreground border-border hover:bg-muted"
            }`}
          >
            <Filter className="h-3 w-3" />
            Agrupar por data
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : agrupar && grupos ? (
        <div className="space-y-6">
          {Array.from(grupos.entries()).map(([grupo, items]) => (
            <div key={grupo}>
              <div className="flex items-center gap-2 mb-2">
                <h3 className="text-sm font-semibold text-foreground">{grupo} ({items.length})</h3>
              </div>
              <Tabela items={items} />
            </div>
          ))}
        </div>
      ) : (
        <Tabela items={sorted} />
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
