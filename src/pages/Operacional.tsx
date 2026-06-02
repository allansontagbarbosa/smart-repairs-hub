import { useMemo, useRef, useState, DragEvent } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Search, LayoutGrid, Users, Loader2, Clock, AlertTriangle, MessageCircle,
  Truck, PackageSearch, ShieldCheck, Wrench, CheckCircle2,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { OrdemDetalheSheet } from "@/components/OrdemDetalheSheet";
import { calcularPrioridade } from "@/lib/prioridade";
import { statusLabels, type Status } from "@/lib/status";
import { abrirWhatsApp } from "@/lib/whatsapp";
import { invalidateOrdensDependentes } from "@/lib/cacheInvalidation";
import { useAparelhosNaRua, useGarantiasTerceiroVigentes } from "@/hooks/useTerceirizacao";

type Modo = "fluxo" | "mesa";

// Mapa central: cada coluna do Kanban aceita um ou mais valores REAIS de status.
// Ajustado conforme valores reais no banco (recebido, em_analise, aguardando_peca,
// terceirizado, garantia, pronto). "em_reparo" agrega todos os status que
// representam "o técnico está trabalhando nisso".
const STATUS_POR_COLUNA: Record<string, Status[]> = {
  na_rua:           ["terceirizado"],
  aguardando_pecas: ["aguardando_peca"],
  garantia:         ["garantia"],
  em_reparo:        ["em_reparo", "em_analise", "aprovado", "aguardando_aprovacao"],
  prontos:          ["pronto"],
};
const TODOS_STATUS_MAPEADOS = new Set<Status>(
  Object.values(STATUS_POR_COLUNA).flat() as Status[]
);
const naColuna = (o: any, colKey: keyof typeof STATUS_POR_COLUNA) =>
  STATUS_POR_COLUNA[colKey].includes(o.status);

// Cores das colunas do modo Fluxo (conforme spec)
const FLUXO_COLORS: Record<string, { header: string; dot: string; ring: string }> = {
  na_rua:           { header: "bg-[hsl(270_72%_64%/0.18)]", dot: "bg-[hsl(270_72%_58%)]", ring: "ring-[hsl(270_72%_58%/0.4)]" },
  aguardando_pecas: { header: "bg-[hsl(34_82%_56%/0.18)]",  dot: "bg-[hsl(34_82%_50%)]",  ring: "ring-[hsl(34_82%_50%/0.4)]" },
  garantia:         { header: "bg-[hsl(207_78%_57%/0.18)]", dot: "bg-[hsl(207_78%_50%)]", ring: "ring-[hsl(207_78%_50%/0.4)]" },
  em_reparo:        { header: "bg-[hsl(217_78%_57%/0.18)]", dot: "bg-[hsl(217_78%_50%)]", ring: "ring-[hsl(217_78%_50%/0.4)]" },
  prontos:          { header: "bg-[hsl(165_100%_39%/0.18)]",dot: "bg-[hsl(165_100%_39%)]",ring: "ring-[hsl(165_100%_39%/0.4)]" },
  outros:           { header: "bg-muted/60", dot: "bg-muted-foreground", ring: "ring-muted-foreground/40" },
  mesa:             { header: "bg-muted/40", dot: "bg-primary", ring: "ring-primary/40" },
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
function fmtDM(d: string | null | undefined) {
  if (!d) return "";
  const dt = new Date(d);
  return `${String(dt.getDate()).padStart(2, "0")}/${String(dt.getMonth() + 1).padStart(2, "0")}`;
}

export default function Operacional() {
  const queryClient = useQueryClient();
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [modo, setModo] = useState<Modo>(() => {
    if (typeof window === "undefined") return "fluxo";
    const saved = localStorage.getItem("operacional-modo");
    return saved === "mesa" ? "mesa" : "fluxo";
  });
  const [busca, setBusca] = useState<Record<string, string>>({});
  const [dragOver, setDragOver] = useState<string | null>(null);
  const dragRef = useRef<{ id: string } | null>(null);

  const { data: orders = [], isLoading } = useQuery({
    queryKey: ["ordens", "ultimos-90"],
    queryFn: fetchOrders,
  });
  const { data: naRuaList = [] } = useAparelhosNaRua();
  const { data: garantiasTerceiro = [] } = useGarantiasTerceiroVigentes();

  const updateStatus = useMutation({
    mutationFn: async ({ id, newStatus }: { id: string; newStatus: Status }) => {
      const ordemAtual = (orders as any[]).find((o) => o.id === id);
      const now = new Date().toISOString();
      const updates: any = { status: newStatus };
      if (newStatus === "pronto" && !ordemAtual?.data_conclusao) updates.data_conclusao = now;
      if (newStatus === "aguardando_peca" && !ordemAtual?.pecas_pedido_em) {
        updates.pecas_pedido_em = new Date().toISOString().slice(0, 10);
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

  // OS map for resolving terceirizações/garantias-terceiro -> ordem
  const ordemById = useMemo(() => {
    const m = new Map<string, any>();
    (orders as any[]).forEach((o) => m.set(o.id, o));
    return m;
  }, [orders]);

  // ============== MODO MESA / POR TÉCNICO ==============
  // Mostra SOMENTE os em_reparo, uma coluna por técnico.
  const emReparo = useMemo(
    () => ativas.filter((o: any) => naColuna(o, "em_reparo")),
    [ativas]
  );

  const tecnicosColunas = useMemo(() => {
    const tecs = Array.from(new Set(emReparo.flatMap(tecnicosNomes))).sort();
    return tecs;
  }, [emReparo]);

  const cardMatchesBusca = (o: any, q: string) => {
    if (!q) return true;
    const tecs = tecnicosNomes(o).join(" ");
    const haystack = `${o.numero ?? ""} ${o.aparelhos?.clientes?.nome ?? ""} ${o.aparelhos?.marca ?? ""} ${o.aparelhos?.modelo ?? ""} ${tecs}`.toLowerCase();
    return haystack.includes(q);
  };

  const setModoPersist = (m: Modo) => {
    setModo(m);
    if (typeof window !== "undefined") localStorage.setItem("operacional-modo", m);
  };

  // Drag handlers (somente modo fluxo, e somente em colunas que tenham statusKey)
  const onDragStart = (e: DragEvent, id: string) => {
    if (modo !== "fluxo") return;
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
  const onDragOver = (e: DragEvent, key: string, accepts: boolean) => {
    if (modo !== "fluxo" || !accepts) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDragOver(key);
  };
  const onDrop = (e: DragEvent, statusKey: Status | null) => {
    e.preventDefault();
    setDragOver(null);
    if (modo !== "fluxo" || !statusKey || !dragRef.current) return;
    const { id } = dragRef.current;
    const order = (orders as any[]).find((o) => o.id === id);
    if (!order || order.status === statusKey) return;
    updateStatus.mutate({ id, newStatus: statusKey });
  };

  // ============== CARDS ==============
  const renderOSCard = (order: any, opts?: { draggable?: boolean; extraLine?: React.ReactNode }) => {
    const draggable = opts?.draggable ?? (modo === "fluxo");
    const days = daysAgo(order.data_entrada);
    const prio = calcularPrioridade(order.status, order.data_entrada, order.previsao_entrega);
    const isCritica = prio.nivel === "critica";
    const isAtencao = prio.nivel === "atencao";
    const phone = order.aparelhos?.clientes?.telefone;
    const tecs = tecnicosNomes(order);

    return (
      <div
        key={order.id}
        draggable={draggable}
        onDragStart={(e) => onDragStart(e, order.id)}
        onDragEnd={onDragEnd}
        onClick={() => setSelectedOrderId(order.id)}
        className={cn(
          "bg-card rounded-lg border p-2.5 space-y-1.5 transition-all hover:shadow-md select-none",
          draggable ? "cursor-grab active:cursor-grabbing" : "cursor-pointer",
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
        {opts?.extraLine}
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
        {modo === "fluxo" && tecs.length > 0 && (
          <p className="text-[10px] text-muted-foreground truncate" title={tecs.join(", ")}>
            👤 {tecs.join(", ")}
          </p>
        )}
      </div>
    );
  };

  // ============== COLUNAS ==============
  type Coluna = {
    key: string;
    nome: string;
    icon: React.ReactNode;
    color: keyof typeof FLUXO_COLORS;
    statusKey: Status | null; // p/ drop
    /** Conteúdo já filtrado por busca, com contagem total e o JSX dos cards */
    render: (q: string) => { total: number; node: React.ReactNode };
  };

  const colunasFluxo: Coluna[] = useMemo(() => {
    const cols: Coluna[] = [];

    // ---- Na rua (terceirizações enviadas) ----
    cols.push({
      key: "na_rua",
      nome: "Na rua (terceiro)",
      icon: <Truck className="h-3.5 w-3.5" />,
      color: "na_rua",
      statusKey: null,
      render: (q) => {
        const items = (naRuaList as any[]).filter((it) => {
          const order = ordemById.get(it.os_id);
          const numero = order?.numero ?? "";
          const cli = order?.aparelhos?.clientes?.nome ?? "";
          const aparelho = `${order?.aparelhos?.marca ?? ""} ${order?.aparelhos?.modelo ?? ""}`;
          const haystack = `${numero} ${cli} ${aparelho} ${it.terceiro_nome ?? ""} ${it.servico ?? ""}`.toLowerCase();
          return !q || haystack.includes(q);
        });
        return {
          total: items.length,
          node: items.length === 0 ? null : items.map((it: any) => {
            const order = ordemById.get(it.os_id);
            const extra = (
              <div className="flex items-center justify-between gap-2">
                <span className="text-[10px] text-[hsl(270_72%_50%)] font-medium truncate">
                  🛠 {it.terceiro_nome ?? "Terceiro"}
                </span>
                <span className={cn(
                  "text-[10px] font-medium",
                  it.atrasado ? "text-destructive" : "text-muted-foreground"
                )}>
                  {it.dias_fora}d fora{it.atrasado ? " · atrasado" : ""}
                </span>
              </div>
            );
            if (order) return renderOSCard(order, { draggable: false, extraLine: extra });
            // OS fora do range de 90d: card mínimo clicável
            return (
              <div
                key={it.terceirizacao_id}
                onClick={() => setSelectedOrderId(it.os_id)}
                className="bg-card rounded-lg border p-2.5 space-y-1 cursor-pointer hover:shadow-md"
              >
                <p className="text-sm font-medium truncate">{it.servico ?? "Terceirização"}</p>
                {extra}
              </div>
            );
          }),
        };
      },
    });

    // ---- Aguardando peças ----
    cols.push({
      key: "aguardando_pecas",
      nome: "Aguardando peças",
      icon: <PackageSearch className="h-3.5 w-3.5" />,
      color: "aguardando_pecas",
      statusKey: "aguardando_peca" as Status,
      render: (q) => {
        const list = ativas.filter((o: any) => naColuna(o, "aguardando_pecas") && cardMatchesBusca(o, q));
        return {
          total: list.length,
          node: list.map((o: any) =>
            renderOSCard(o, {
              extraLine: o.pecas_pedido_em ? (
                <p className="text-[10px] text-[hsl(34_82%_45%)] font-medium">
                  📦 pedido em {fmtDM(o.pecas_pedido_em)}
                </p>
              ) : undefined,
            })
          ),
        };
      },
    });

    // ---- Garantia (Da loja + Do terceiro) ----
    cols.push({
      key: "garantia",
      nome: "Garantia",
      icon: <ShieldCheck className="h-3.5 w-3.5" />,
      color: "garantia",
      statusKey: "garantia" as Status,
      render: (q) => {
        const daLoja = ativas.filter((o: any) => naColuna(o, "garantia") && cardMatchesBusca(o, q));
        const doTerceiro = (garantiasTerceiro as any[]).filter((g) => {
          const order = ordemById.get(g.os_id);
          const numero = order?.numero ?? "";
          const cli = order?.aparelhos?.clientes?.nome ?? "";
          const haystack = `${numero} ${cli} ${g.terceiro_nome ?? ""} ${g.servico_realizado ?? ""}`.toLowerCase();
          return !q || haystack.includes(q);
        });
        const total = daLoja.length + doTerceiro.length;
        return {
          total,
          node: (
            <>
              <div className="px-1 pt-1 text-[10px] uppercase tracking-wide font-semibold text-muted-foreground/80">
                Da loja ({daLoja.length})
              </div>
              {daLoja.length === 0 && (
                <div className="text-[11px] text-muted-foreground/60 italic px-1">—</div>
              )}
              {daLoja.map((o: any) => renderOSCard(o))}

              <div className="px-1 pt-2 text-[10px] uppercase tracking-wide font-semibold text-muted-foreground/80">
                Do terceiro ({doTerceiro.length})
              </div>
              {doTerceiro.length === 0 && (
                <div className="text-[11px] text-muted-foreground/60 italic px-1">—</div>
              )}
              {doTerceiro.map((g: any) => {
                const order = ordemById.get(g.os_id);
                const extra = (
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[10px] text-[hsl(207_78%_45%)] font-medium truncate">
                      🛡 {g.terceiro_nome ?? "Terceiro"}
                    </span>
                    <span className="text-[10px] text-muted-foreground">
                      {g.dias_restantes}d restantes
                    </span>
                  </div>
                );
                if (order) return renderOSCard(order, { draggable: false, extraLine: extra });
                return (
                  <div
                    key={g.terceirizacao_id}
                    onClick={() => setSelectedOrderId(g.os_id)}
                    className="bg-card rounded-lg border p-2.5 space-y-1 cursor-pointer hover:shadow-md"
                  >
                    <p className="text-sm font-medium truncate">
                      {g.servico_realizado ?? "Garantia do terceiro"}
                    </p>
                    {extra}
                  </div>
                );
              })}
            </>
          ),
        };
      },
    });

    // ---- Em reparo (subagrupado por técnico) ----
    cols.push({
      key: "em_reparo",
      nome: "Em reparo",
      icon: <Wrench className="h-3.5 w-3.5" />,
      color: "em_reparo",
      statusKey: "em_reparo" as Status,
      render: (q) => {
        const list = ativas.filter((o: any) => naColuna(o, "em_reparo") && cardMatchesBusca(o, q));
        const grupos = new Map<string, any[]>();
        list.forEach((o: any) => {
          const tecs = tecnicosNomes(o);
          if (tecs.length === 0) {
            grupos.set("Sem técnico", [...(grupos.get("Sem técnico") ?? []), o]);
          } else {
            tecs.forEach((t) => grupos.set(t, [...(grupos.get(t) ?? []), o]));
          }
        });
        const keys = Array.from(grupos.keys()).sort();
        return {
          total: list.length,
          node: keys.length === 0 ? null : keys.map((k) => (
            <div key={k} className="space-y-2">
              <div className="px-1 text-[10px] uppercase tracking-wide font-semibold text-muted-foreground/80">
                👤 {k} ({grupos.get(k)!.length})
              </div>
              {grupos.get(k)!.map((o: any) => renderOSCard(o))}
            </div>
          )),
        };
      },
    });

    // ---- Prontos p/ entrega ----
    cols.push({
      key: "prontos",
      nome: "Prontos p/ entrega",
      icon: <CheckCircle2 className="h-3.5 w-3.5" />,
      color: "prontos",
      statusKey: "pronto" as Status,
      render: (q) => {
        const list = ativas.filter((o: any) => o.status === "pronto" && cardMatchesBusca(o, q));
        return { total: list.length, node: list.map((o: any) => renderOSCard(o)) };
      },
    });

    return cols;
  }, [ativas, naRuaList, garantiasTerceiro, ordemById, modo]);

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
            onClick={() => setModoPersist("fluxo")}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-md px-3 py-1 text-[12px] font-medium transition-colors",
              modo === "fluxo" ? "bg-secondary text-foreground" : "text-muted-foreground hover:text-foreground",
            )}
          >
            <LayoutGrid className="h-3.5 w-3.5" /> Fluxo
          </button>
          <button
            type="button"
            onClick={() => setModoPersist("mesa")}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-md px-3 py-1 text-[12px] font-medium transition-colors",
              modo === "mesa" ? "bg-secondary text-foreground" : "text-muted-foreground hover:text-foreground",
            )}
          >
            <Users className="h-3.5 w-3.5" /> Por técnico
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : modo === "fluxo" ? (
        <div
          className="flex gap-2.5 overflow-x-auto pb-4 -mx-4 px-4 md:-mx-6 md:px-6 lg:-mx-8 lg:px-8 snap-x"
          style={{ minHeight: "calc(100vh - 200px)" }}
        >
          {colunasFluxo.map((col) => {
            const q = (busca[col.key] || "").toLowerCase().trim();
            const { total, node } = col.render(q);
            const isDrop = dragOver === col.key;
            const accepts = !!col.statusKey;
            const c = FLUXO_COLORS[col.color];
            return (
              <div
                key={col.key}
                className={cn(
                  "flex-shrink-0 w-60 md:w-[17rem] rounded-xl border flex flex-col snap-start transition-all bg-muted/30",
                  isDrop && accepts && `ring-2 ${c.ring} bg-primary/5`,
                )}
                onDragOver={(e) => onDragOver(e, col.key, accepts)}
                onDragLeave={() => setDragOver(null)}
                onDrop={(e) => onDrop(e, col.statusKey)}
              >
                <div className={cn("px-3 py-2.5 rounded-t-xl flex items-center justify-between", c.header)}>
                  <div className="flex items-center gap-2 min-w-0">
                    <div className={cn("w-2 h-2 rounded-full shrink-0", c.dot)} />
                    <span className="text-xs font-semibold truncate flex items-center gap-1.5">
                      {col.icon} {col.nome}
                    </span>
                  </div>
                  <span className="text-[11px] text-muted-foreground bg-background/80 rounded-full px-2 py-0.5 font-semibold tabular-nums">
                    {total}
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
                  {total === 0 ? (
                    <div className="flex items-center justify-center h-20 text-[11px] text-muted-foreground/60 italic">
                      Nenhum item
                    </div>
                  ) : (
                    node
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        // ============== MODO POR TÉCNICO ==============
        <div
          className="flex gap-2.5 overflow-x-auto pb-4 -mx-4 px-4 md:-mx-6 md:px-6 lg:-mx-8 lg:px-8 snap-x"
          style={{ minHeight: "calc(100vh - 200px)" }}
        >
          {tecnicosColunas.length === 0 && (
            <div className="flex items-center justify-center w-full py-20 text-sm text-muted-foreground italic">
              Nenhuma OS em reparo no momento.
            </div>
          )}
          {tecnicosColunas.map((tec) => {
            const key = `mesa-${tec}`;
            const q = (busca[key] || "").toLowerCase().trim();
            // Regra-chave: só em_reparo na mesa do técnico.
            const list = emReparo.filter(
              (o: any) => tecnicosNomes(o).includes(tec) && cardMatchesBusca(o, q)
            );
            return (
              <div
                key={key}
                className="flex-shrink-0 w-60 md:w-[17rem] rounded-xl border flex flex-col snap-start bg-muted/30"
              >
                <div className={cn("px-3 py-2.5 rounded-t-xl flex items-center justify-between", FLUXO_COLORS.em_reparo.header)}>
                  <div className="flex items-center gap-2 min-w-0">
                    <div className={cn("w-2 h-2 rounded-full shrink-0", FLUXO_COLORS.em_reparo.dot)} />
                    <span className="text-xs font-semibold truncate">Mesa {tec}</span>
                  </div>
                  <span className="text-[11px] text-muted-foreground bg-background/80 rounded-full px-2 py-0.5 font-semibold tabular-nums">
                    {list.length}
                  </span>
                </div>

                <div className="px-2 pt-2">
                  <div className="relative">
                    <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                    <Input
                      value={busca[key] ?? ""}
                      onChange={(e) => setBusca((prev) => ({ ...prev, [key]: e.target.value }))}
                      placeholder="Buscar nesta coluna…"
                      className="h-8 pl-7 text-xs"
                    />
                  </div>
                </div>

                <div className="flex-1 px-2 py-2 space-y-2 min-h-[100px] overflow-y-auto max-h-[calc(100vh-320px)]">
                  {list.length === 0 ? (
                    <div className="flex items-center justify-center h-20 text-[11px] text-muted-foreground/60 italic">
                      Mesa livre
                    </div>
                  ) : (
                    list.map((o: any) => (
                      <div key={o.id}>
                        {renderOSCard(o, { draggable: false })}
                        <Badge variant="outline" className="text-[10px] mt-1">
                          <span className={cn("w-1.5 h-1.5 rounded-full mr-1", FLUXO_COLORS.em_reparo.dot)} />
                          {statusLabels[o.status as Status]}
                        </Badge>
                      </div>
                    ))
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
