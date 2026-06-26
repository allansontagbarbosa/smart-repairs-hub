import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useEmpresa } from "@/contexts/EmpresaContext";
import { useToast } from "@/hooks/use-toast";
import { usePermissoesAtacado } from "@/hooks/usePermissoesAtacado";
import {
  ClipboardList,
  Plus,
  Search,
  MoreHorizontal,
  CheckCircle2,
  XCircle,
  FileText,
  Truck,
  RotateCcw,
  Loader2,
  Trash2,
  Wallet,
  Download,
  X,
} from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { formatBRL, maskCNPJ } from "@/lib/utils";
import { AtacadoEmptyState } from "@/components/atacado/AtacadoEmptyState";
import {
  calcularStatusPagamento,
  labelStatusPagamento,
  classesStatusPagamento,
  type StatusPagamentoPedido,
} from "@/lib/atacadoPagamentoStatus";
import { PedidosDashboardPanel } from "@/components/atacado/PedidosDashboardPanel";
import { usePapelSocio } from "@/hooks/usePapelSocio";

export default function AtacadoPedidos() {
  const { empresaId } = useEmpresa();
  const { toast } = useToast();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const perms = usePermissoesAtacado();
  const [busca, setBusca] = useState("");
  const [statusFilter, setStatusFilter] = useState("todos");
  const [periodoFilter, setPeriodoFilter] = useState("este_mes");
  const [customInicio, setCustomInicio] = useState("");
  const [customFim, setCustomFim] = useState("");
  const [pagFilter, setPagFilter] = useState<StatusPagamentoPedido | "todos">("todos");
  const [vendedorFilter, setVendedorFilter] = useState<string>("todos");
  const [formaFilter, setFormaFilter] = useState<string>("todas");
  const [semVendedor, setSemVendedor] = useState(false);

  const papel = usePapelSocio();
  const mostrarLucro = !!papel.data?.ehAdmin || !!papel.data?.ehSocio;

  const hojeStr = new Date().toISOString().slice(0, 10);
  const { inicio, fim } = (() => {
    if (periodoFilter === "custom" && customInicio && customFim) {
      return { inicio: customInicio, fim: customFim };
    }
    const hoje = new Date();
    if (periodoFilter === "hoje") return { inicio: hojeStr, fim: hojeStr };
    if (periodoFilter === "ultimos_7") {
      const d = new Date(); d.setDate(d.getDate() - 7);
      return { inicio: d.toISOString().slice(0, 10), fim: hojeStr };
    }
    if (periodoFilter === "ultimos_30") {
      const d = new Date(); d.setDate(d.getDate() - 30);
      return { inicio: d.toISOString().slice(0, 10), fim: hojeStr };
    }
    if (periodoFilter === "mes_passado") {
      const ref = new Date(hoje.getFullYear(), hoje.getMonth() - 1, 1);
      const fimRef = new Date(hoje.getFullYear(), hoje.getMonth(), 0);
      return { inicio: ref.toISOString().slice(0, 10), fim: fimRef.toISOString().slice(0, 10) };
    }
    if (periodoFilter === "este_ano") return { inicio: `${hoje.getFullYear()}-01-01`, fim: hojeStr };
    return {
      inicio: `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, "0")}-01`,
      fim: hojeStr,
    };
  })();

  // Vendedores p/ filtro
  const { data: vendedores = [] } = useQuery({
    queryKey: ["atacado-vendedores-list", empresaId],
    queryFn: async () => {
      const { data } = await supabase
        .from("funcionarios")
        .select("id, nome")
        .eq("empresa_id", empresaId!)
        .order("nome");
      return data ?? [];
    },
    enabled: !!empresaId,
  });

  const { data: pedidosRaw = [], isLoading } = useQuery({
    queryKey: ["atacado-pedidos", empresaId, busca, statusFilter, inicio, fim, vendedorFilter, semVendedor],
    queryFn: async () => {
      let q = supabase
        .from("atacado_pedidos")
        .select(
          `*, cliente:atacado_clientes(razao_social, nome_fantasia, cnpj), vendedor:funcionarios!vendedor_id(nome), pagamentos:atacado_pedidos_pagamentos(id, valor, valor_pago, status, vencimento, forma, pago_em)`
        )
        .eq("empresa_id", empresaId!)
        .is("deleted_at", null)
        .gte("created_at", inicio)
        .lte("created_at", fim + "T23:59:59.999");
      if (statusFilter !== "todos") q = q.eq("status", statusFilter);
      if (vendedorFilter !== "todos") q = q.eq("vendedor_id", vendedorFilter);
      if (semVendedor) q = q.is("vendedor_id", null);
      if (busca) {
        const num = busca.replace(/\D/g, "");
        if (num) q = q.eq("numero_pedido", parseInt(num));
      }
      const { data, error } = await q
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!empresaId,
  });

  // Filtros client-side: status de pagamento + forma + chip "pagos hoje"
  const [pagosHoje, setPagosHoje] = useState(false);
  const pedidos = pedidosRaw.filter((p: any) => {
    if (pagFilter !== "todos") {
      if (calcularStatusPagamento(p.pagamentos as any) !== pagFilter) return false;
    }
    if (formaFilter !== "todas") {
      const pags = (p.pagamentos ?? []) as any[];
      if (!pags.some((x) => x.forma === formaFilter)) return false;
    }
    if (pagosHoje) {
      const pags = (p.pagamentos ?? []) as any[];
      if (!pags.some((x) => x.pago_em && String(x.pago_em).slice(0, 10) === hojeStr)) return false;
    }
    return true;
  });

  const aguardando = pedidos.filter(
    (p: any) => p.status === "aguardando_aprovacao"
  ).length;

  const mudarStatus = useMutation({
    mutationFn: async ({ pedidoId, novoStatus, motivo }: any) => {
      const { error } = await supabase.rpc("atacado_mudar_status_pedido", {
        p_pedido_id: pedidoId,
        p_novo_status: novoStatus,
        p_motivo: motivo ?? null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["atacado-pedidos"] });
      qc.invalidateQueries({ queryKey: ["atacado-kpis"] });
      qc.invalidateQueries({ queryKey: ["atacado-aparelhos"] });
      toast({ title: "✓ Status atualizado" });
    },
    onError: (e: any) =>
      toast({
        title: "Erro",
        description: e.message,
        variant: "destructive",
      }),
  });

  const receberPedido = useMutation({
    mutationFn: async ({ pedido, data, forma }: any) => {
      const alvos = (pedido.pagamentos ?? []).filter(
        (pg: any) => pg.status !== "pago" && pg.status !== "cancelado",
      );
      for (const pg of alvos) {
        const { error } = await supabase.rpc("atacado_baixar_pagamento" as any, {
          p_pagamento_id: pg.id,
          p_forma: forma,
          p_data_recebimento: data,
        });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast({ title: "Pagamento recebido" });
      qc.invalidateQueries({ queryKey: ["atacado-pedidos"] });
      qc.invalidateQueries({ queryKey: ["atacado-financeiro-kpis"] });
      qc.invalidateQueries({ queryKey: ["atacado-cobranca"] });
    },
    onError: (e: any) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  const excluirPedido = useMutation({
    mutationFn: async (pedidoId: string) => {
      const { data, error } = await supabase.rpc("atacado_excluir_pedido" as any, { p_id: pedidoId });
      if (error) throw error;
      const res = data as any;
      if (res && res.success === false) throw new Error(res.error || "Não foi possível excluir");
    },
    onSuccess: () => {
      toast({ title: "Pedido excluído" });
      qc.invalidateQueries({ queryKey: ["atacado-pedidos"] });
      qc.invalidateQueries({ queryKey: ["atacado-kpis"] });
      qc.invalidateQueries({ queryKey: ["atacado-financeiro-kpis"] });
    },
    onError: (e: any) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  // ===== Seleção múltipla / ações em massa =====
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [bulkPagOpen, setBulkPagOpen] = useState(false);
  const [bulkDelOpen, setBulkDelOpen] = useState(false);

  const selArr = pedidos.filter((p: any) => sel.has(p.id));
  const allOnPage = pedidos.length > 0 && pedidos.every((p: any) => sel.has(p.id));
  const toggle = (id: string) =>
    setSel((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id); else n.add(id);
      return n;
    });
  const toggleAll = () =>
    setSel(allOnPage ? new Set() : new Set(pedidos.map((p: any) => p.id)));
  const clearSel = () => setSel(new Set());

  const receberMassa = useMutation({
    mutationFn: async ({ data, forma }: { data: string; forma: string }) => {
      const alvos: string[] = [];
      for (const p of selArr)
        for (const pg of (p.pagamentos ?? []) as any[])
          if (pg.status !== "pago" && pg.status !== "cancelado") alvos.push(pg.id);
      for (const pgId of alvos) {
        const { error } = await supabase.rpc("atacado_baixar_pagamento" as any, {
          p_pagamento_id: pgId,
          p_forma: forma,
          p_data_recebimento: data,
        });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast({ title: "Pagamentos recebidos" });
      setBulkPagOpen(false);
      clearSel();
      qc.invalidateQueries({ queryKey: ["atacado-pedidos"] });
      qc.invalidateQueries({ queryKey: ["atacado-financeiro-kpis"] });
      qc.invalidateQueries({ queryKey: ["atacado-cobranca"] });
    },
    onError: (e: any) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  const mudarStatusMassa = useMutation({
    mutationFn: async (novoStatus: string) => {
      for (const p of selArr) {
        const { error } = await supabase.rpc("atacado_mudar_status_pedido", {
          p_pedido_id: p.id,
          p_novo_status: novoStatus,
          p_motivo: null,
        });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast({ title: "Status atualizado" });
      clearSel();
      qc.invalidateQueries({ queryKey: ["atacado-pedidos"] });
      qc.invalidateQueries({ queryKey: ["atacado-kpis"] });
    },
    onError: (e: any) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  const excluirMassa = useMutation({
    mutationFn: async () => {
      for (const p of selArr) {
        const { data, error } = await supabase.rpc("atacado_excluir_pedido" as any, { p_id: p.id });
        if (error) throw error;
        const res = data as any;
        if (res && res.success === false) throw new Error(res.error || "Falha ao excluir");
      }
    },
    onSuccess: () => {
      toast({ title: "Pedidos excluídos" });
      setBulkDelOpen(false);
      clearSel();
      qc.invalidateQueries({ queryKey: ["atacado-pedidos"] });
      qc.invalidateQueries({ queryKey: ["atacado-kpis"] });
      qc.invalidateQueries({ queryKey: ["atacado-financeiro-kpis"] });
    },
    onError: (e: any) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  function exportarCSV() {
    const linhas: string[][] = [["Pedido", "Cliente", "Vendedor", "Total", "Status", "Data"]];
    for (const p of selArr)
      linhas.push([
        `#P-${String(p.numero_pedido).padStart(6, "0")}`,
        p.cliente?.nome_fantasia || p.cliente?.razao_social || "",
        p.vendedor?.nome || "",
        String(p.total),
        p.status,
        new Date(p.created_at).toLocaleDateString("pt-BR"),
      ]);
    const csv = linhas
      .map((l) => l.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(";"))
      .join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `pedidos-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold">Pedidos B2B</h1>
          <p className="text-sm text-muted-foreground">
            Acompanhe todos os pedidos do atacado
          </p>
        </div>
        <Button onClick={() => navigate("/atacado/novo-pedido")}>
          <Plus className="h-4 w-4 mr-2" /> Novo pedido
        </Button>
      </div>

      {/* KPIs (cockpit) */}
      <PedidosDashboardPanel
        empresaId={empresaId}
        inicio={inicio}
        fim={fim}
        mostrarLucro={mostrarLucro}
      />

      {/* Chips rápidos */}
      <div className="flex flex-wrap gap-1.5">
        <ChipFilter
          label="Vencidos"
          active={pagFilter === "atrasado"}
          onClick={() => setPagFilter(pagFilter === "atrasado" ? "todos" : "atrasado")}
          tone="destructive"
        />
        <ChipFilter
          label="Aguardando aprovação"
          active={statusFilter === "aguardando_aprovacao"}
          onClick={() =>
            setStatusFilter(statusFilter === "aguardando_aprovacao" ? "todos" : "aguardando_aprovacao")
          }
          tone="warning"
          count={aguardando}
        />
        <ChipFilter
          label="Pagos hoje"
          active={pagosHoje}
          onClick={() => setPagosHoje((v) => !v)}
          tone="success"
        />
        <ChipFilter
          label="Sem vendedor"
          active={semVendedor}
          onClick={() => setSemVendedor((v) => !v)}
        />
        {(pagFilter !== "todos" ||
          statusFilter !== "todos" ||
          pagosHoje ||
          semVendedor ||
          vendedorFilter !== "todos" ||
          formaFilter !== "todas") && (
          <button
            type="button"
            onClick={() => {
              setPagFilter("todos");
              setStatusFilter("todos");
              setPagosHoje(false);
              setSemVendedor(false);
              setVendedorFilter("todos");
              setFormaFilter("todas");
            }}
            className="text-xs text-muted-foreground hover:text-foreground underline ml-1"
          >
            Limpar filtros
          </button>
        )}
      </div>

      {/* Filtros */}
      <div className="flex flex-col md:flex-row gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por número do pedido (ex.: 123)"
            className="pl-9"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="md:w-44">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos status</SelectItem>
            <SelectItem value="rascunho">Rascunho</SelectItem>
            <SelectItem value="aguardando_aprovacao">Aguardando aprovação</SelectItem>
            <SelectItem value="aprovado">Aprovados</SelectItem>
            <SelectItem value="faturado">Faturados</SelectItem>
            <SelectItem value="entregue">Entregues</SelectItem>
            <SelectItem value="cancelado">Cancelados</SelectItem>
          </SelectContent>
        </Select>
        <Select value={pagFilter} onValueChange={(v) => setPagFilter(v as any)}>
          <SelectTrigger className="md:w-44">
            <SelectValue placeholder="Pagamento" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos pagamentos</SelectItem>
            <SelectItem value="pago">Pago</SelectItem>
            <SelectItem value="parcial">Parcial</SelectItem>
            <SelectItem value="aguardando">Aguardando</SelectItem>
            <SelectItem value="atrasado">Atrasado</SelectItem>
            <SelectItem value="sem_pagamentos">Sem pagamentos</SelectItem>
          </SelectContent>
        </Select>
        <Select value={vendedorFilter} onValueChange={setVendedorFilter}>
          <SelectTrigger className="md:w-44">
            <SelectValue placeholder="Vendedor" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos vendedores</SelectItem>
            {(vendedores as any[]).map((v) => (
              <SelectItem key={v.id} value={v.id}>{v.nome}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={formaFilter} onValueChange={setFormaFilter}>
          <SelectTrigger className="md:w-40">
            <SelectValue placeholder="Forma" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todas">Todas formas</SelectItem>
            <SelectItem value="pix">Pix</SelectItem>
            <SelectItem value="boleto">Boleto</SelectItem>
            <SelectItem value="transferencia">Transferência</SelectItem>
            <SelectItem value="dinheiro">Dinheiro</SelectItem>
            <SelectItem value="cartao">Cartão</SelectItem>
            <SelectItem value="cheque">Cheque</SelectItem>
          </SelectContent>
        </Select>
        <Select value={periodoFilter} onValueChange={setPeriodoFilter}>
          <SelectTrigger className="md:w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="hoje">Hoje</SelectItem>
            <SelectItem value="ultimos_7">Últimos 7 dias</SelectItem>
            <SelectItem value="este_mes">Este mês</SelectItem>
            <SelectItem value="mes_passado">Mês passado</SelectItem>
            <SelectItem value="ultimos_30">Últimos 30 dias</SelectItem>
            <SelectItem value="este_ano">Este ano</SelectItem>
            <SelectItem value="custom">Intervalo custom…</SelectItem>
          </SelectContent>
        </Select>
        {periodoFilter === "custom" && (
          <div className="flex items-center gap-1">
            <Input
              type="date"
              className="md:w-36"
              value={customInicio}
              onChange={(e) => setCustomInicio(e.target.value)}
            />
            <span className="text-xs text-muted-foreground">até</span>
            <Input
              type="date"
              className="md:w-36"
              value={customFim}
              onChange={(e) => setCustomFim(e.target.value)}
            />
          </div>
        )}
      </div>

      {/* Lista */}
      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : pedidos.length === 0 ? (
        <AtacadoEmptyState
          icon={ClipboardList}
          title="Nenhum pedido encontrado"
          description="Ajuste os filtros ou crie um novo pedido."
          ctaLabel="Novo pedido"
          ctaOnClick={() => navigate("/atacado/novo-pedido")}
        />
      ) : (
        <div className="space-y-2">
          {sel.size > 0 && (
            <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-card px-3 py-2 shadow-sm">
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={clearSel} aria-label="Limpar seleção">
                <X className="h-4 w-4" />
              </Button>
              <span className="text-sm font-medium">{sel.size} selecionado(s)</span>
              <div className="ml-auto flex flex-wrap items-center gap-1.5">
                <Button size="sm" variant="outline" className="h-8 gap-1.5" onClick={() => setBulkPagOpen(true)} disabled={receberMassa.isPending}>
                  <Wallet className="h-4 w-4" /> Receber pagamento
                </Button>
                <Select onValueChange={(v) => mudarStatusMassa.mutate(v)}>
                  <SelectTrigger className="h-8 w-[170px]">
                    <SelectValue placeholder="Mudar status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="aprovado">Aprovar</SelectItem>
                    <SelectItem value="faturado">Faturar (NF-e)</SelectItem>
                    <SelectItem value="entregue">Marcar entregue</SelectItem>
                    <SelectItem value="cancelado">Cancelar</SelectItem>
                  </SelectContent>
                </Select>
                <Button size="sm" variant="outline" className="h-8 gap-1.5" onClick={exportarCSV}>
                  <Download className="h-4 w-4" /> CSV
                </Button>
                <Button size="sm" variant="outline" className="h-8 gap-1.5 text-destructive" onClick={() => setBulkDelOpen(true)}>
                  <Trash2 className="h-4 w-4" /> Excluir
                </Button>
              </div>
            </div>
          )}
        <div className="border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
              <tr>
                <th className="w-10 px-3 py-2">
                  <Checkbox checked={allOnPage} onCheckedChange={toggleAll} aria-label="Selecionar todos" />
                </th>
                <th className="text-left px-4 py-2">Pedido</th>
                <th className="text-left px-4 py-2">Cliente</th>
                <th className="text-left px-4 py-2">Vendedor</th>
                <th className="text-right px-4 py-2">Total</th>
                <th className="text-left px-4 py-2">Status</th>
                <th className="text-left px-4 py-2">Data</th>
                <th className="w-10"></th>
              </tr>
            </thead>
            <tbody>
              {pedidos.map((p: any) => (
                <tr
                  key={p.id}
                  className="border-t hover:bg-muted/30 cursor-pointer"
                  onClick={() => navigate(`/atacado/pedidos/${p.id}`)}
                >
                  <td className="px-3 py-3" onClick={(e) => e.stopPropagation()}>
                    <Checkbox checked={sel.has(p.id)} onCheckedChange={() => toggle(p.id)} aria-label="Selecionar pedido" />
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-medium">
                      #P-{String(p.numero_pedido).padStart(6, "0")}
                    </div>
                    {p.nfe_numero && (
                      <div className="text-xs text-muted-foreground">
                        NF-e {p.nfe_numero}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-medium">
                      {p.cliente?.nome_fantasia ||
                        p.cliente?.razao_social ||
                        "—"}
                    </div>
                    {p.cliente?.cnpj && (
                      <div className="text-xs text-muted-foreground">
                        {maskCNPJ(p.cliente.cnpj)}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3">{p.vendedor?.nome ?? "—"}</td>
                  <td className="px-4 py-3 text-right">
                    <div className="font-medium">
                      {formatBRL(Number(p.total))}
                    </div>
                    {Number(p.desconto) > 0 && (
                      <div className="text-xs text-muted-foreground">
                        −{formatBRL(Number(p.desconto))}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                    <div className="flex flex-col gap-1 items-start">
                      <StatusPopover pedido={p} mudarStatus={mudarStatus} />
                      <PagamentoPopover pedido={p} receberPedido={receberPedido} />
                    </div>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {new Date(p.created_at).toLocaleDateString("pt-BR")}
                  </td>
                  <td className="px-2 py-3" onClick={(e) => e.stopPropagation()}>
                    <PedidoActions
                      pedido={p}
                      perms={perms}
                      mudarStatus={mudarStatus}
                      excluirPedido={excluirPedido}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        </div>
      )}

      {bulkPagOpen && (
        <BulkPagDialog
          qtd={sel.size}
          isPending={receberMassa.isPending}
          onClose={() => setBulkPagOpen(false)}
          onConfirm={(data: string, forma: string) => receberMassa.mutate({ data, forma })}
        />
      )}

      <AlertDialog open={bulkDelOpen} onOpenChange={(v) => !v && setBulkDelOpen(false)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir {sel.size} pedido(s) definitivamente?</AlertDialogTitle>
            <AlertDialogDescription>
              Remove os pedidos e seus lançamentos (itens, parcelas, cobrança) do financeiro/relatórios. Irreversível.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setBulkDelOpen(false)}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => excluirMassa.mutate()}
            >
              Excluir definitivamente
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

    </div>
  );
}

function Kpi({ label, valor, danger }: any) {
  return (
    <div
      className={`border rounded-lg p-4 ${
        danger ? "border-warning/40 bg-warning/5" : ""
      }`}
    >
      <div className="text-xs uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
      <div className="text-xl font-semibold mt-1">{valor}</div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    rascunho: { label: "Rascunho", cls: "bg-muted text-muted-foreground" },
    aguardando_aprovacao: {
      label: "Aguardando",
      cls: "bg-warning/15 text-warning border-warning/30",
    },
    aprovado: {
      label: "Aprovado",
      cls: "bg-info/15 text-info border-info/30",
    },
    faturado: {
      label: "Faturado",
      cls: "bg-primary/15 text-primary border-primary/30",
    },
    entregue: {
      label: "Entregue",
      cls: "bg-success/15 text-success border-success/30",
    },
    cancelado: {
      label: "Cancelado",
      cls: "bg-destructive/15 text-destructive border-destructive/30",
    },
  };
  const m = map[status] ?? map.rascunho;
  return (
    <Badge variant="outline" className={m.cls}>
      {m.label}
    </Badge>
  );
}

function PagamentoBadge({ pagamentos }: { pagamentos: any[] | null | undefined }) {
  const s = calcularStatusPagamento(pagamentos as any);
  if (s === "sem_pagamentos") return null;
  return (
    <Badge variant="outline" className={classesStatusPagamento(s)}>
      {labelStatusPagamento(s)}
    </Badge>
  );
}

function PedidoActions({ pedido, perms, mudarStatus, excluirPedido }: any) {
  const [confirmOpen, setConfirmOpen] = useState(false);

  const acoes: {
    label: string;
    icon: any;
    novoStatus: string;
    danger?: boolean;
  }[] = [];

  if (
    pedido.status === "aguardando_aprovacao" &&
    perms.podeAprovarPedido
  ) {
    acoes.push({ label: "Aprovar", icon: CheckCircle2, novoStatus: "aprovado" });
    acoes.push({
      label: "Rejeitar",
      icon: XCircle,
      novoStatus: "cancelado",
      danger: true,
    });
  }
  if (pedido.status === "aprovado") {
    acoes.push({
      label: "Faturar (NF-e)",
      icon: FileText,
      novoStatus: "faturado",
    });
    acoes.push({
      label: "Cancelar pedido",
      icon: XCircle,
      novoStatus: "cancelado",
      danger: true,
    });
  }
  if (pedido.status === "faturado") {
    acoes.push({
      label: "Marcar entregue",
      icon: Truck,
      novoStatus: "entregue",
    });
  }
  if (pedido.status === "cancelado") {
    acoes.push({
      label: "Reativar (rascunho)",
      icon: RotateCcw,
      novoStatus: "rascunho",
    });
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="h-8 w-8">
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {acoes.map((a, i) => {
            const Icon = a.icon;
            return (
              <DropdownMenuItem
                key={i}
                className={a.danger ? "text-destructive" : ""}
                onClick={() =>
                  mudarStatus.mutate({
                    pedidoId: pedido.id,
                    novoStatus: a.novoStatus,
                  })
                }
              >
                <Icon className="h-4 w-4 mr-2" /> {a.label}
              </DropdownMenuItem>
            );
          })}
          <DropdownMenuItem
            className="text-destructive"
            onSelect={(e) => { e.preventDefault(); setConfirmOpen(true); }}
          >
            <Trash2 className="h-4 w-4 mr-2" /> Excluir definitivamente
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Excluir pedido #P-{String(pedido.numero_pedido).padStart(6, "0")} definitivamente?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Isso remove o pedido e seus lançamentos (itens, parcelas, cobrança) do financeiro/relatórios. Ação irreversível.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => excluirPedido.mutate(pedido.id)}
            >
              Excluir definitivamente
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function BulkPagDialog({ qtd, onConfirm, onClose, isPending }: any) {
  const [forma, setForma] = useState("pix");
  const [data, setData] = useState(new Date().toISOString().slice(0, 10));
  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Receber pagamento — {qtd} pedido(s)</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Forma de recebimento</Label>
            <Select value={forma} onValueChange={setForma}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="pix">Pix</SelectItem>
                <SelectItem value="boleto">Boleto</SelectItem>
                <SelectItem value="transferencia">Transferência</SelectItem>
                <SelectItem value="dinheiro">Dinheiro</SelectItem>
                <SelectItem value="cartao">Cartão</SelectItem>
                <SelectItem value="cheque">Cheque</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Data do recebimento</Label>
            <Input type="date" value={data} onChange={(e) => setData(e.target.value)} />
            <p className="text-xs text-muted-foreground">
              Aplica a todas as parcelas em aberto dos pedidos selecionados. Pode ser retroativa.
            </p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={() => onConfirm(data, forma)} disabled={isPending}>
            Confirmar baixa
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function statusTransicoes(status: string) {
  switch (status) {
    case "rascunho":
      return [
        { value: "aguardando_aprovacao", label: "Enviar p/ aprovação" },
        { value: "aprovado", label: "Aprovar" },
        { value: "cancelado", label: "Cancelar", danger: true },
      ];
    case "aguardando_aprovacao":
      return [
        { value: "aprovado", label: "Aprovar" },
        { value: "cancelado", label: "Rejeitar", danger: true },
      ];
    case "aprovado":
      return [
        { value: "faturado", label: "Faturar (NF-e)" },
        { value: "cancelado", label: "Cancelar", danger: true },
      ];
    case "faturado":
      return [{ value: "entregue", label: "Marcar entregue" }];
    case "entregue":
      return [];
    case "cancelado":
      return [{ value: "rascunho", label: "Reativar (rascunho)" }];
    default:
      return [];
  }
}

function StatusPopover({ pedido, mudarStatus }: any) {
  const [open, setOpen] = useState(false);
  const opcoes = statusTransicoes(pedido.status);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button type="button" className="cursor-pointer">
          <StatusBadge status={pedido.status} />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-56 p-2" align="start">
        {opcoes.length === 0 ? (
          <p className="text-xs text-muted-foreground px-2 py-1.5">Sem mudança disponível</p>
        ) : (
          <div className="flex flex-col gap-0.5">
            {opcoes.map((o: any) => (
              <Button
                key={o.value}
                variant="ghost"
                size="sm"
                className={`justify-start h-8 ${o.danger ? "text-destructive hover:text-destructive" : ""}`}
                onClick={() => {
                  mudarStatus.mutate({ pedidoId: pedido.id, novoStatus: o.value });
                  setOpen(false);
                }}
              >
                {o.label}
              </Button>
            ))}
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}

function PagamentoPopover({ pedido, receberPedido }: any) {
  const [open, setOpen] = useState(false);
  const [forma, setForma] = useState("pix");
  const [data, setData] = useState(new Date().toISOString().slice(0, 10));
  const s = calcularStatusPagamento(pedido.pagamentos as any);
  if (s === "sem_pagamentos") return null;
  const jaPago = s === "pago";
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button type="button" className="cursor-pointer">
          <PagamentoBadge pagamentos={pedido.pagamentos} />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-3" align="start">
        {jaPago ? (
          <p className="text-sm text-muted-foreground">Pagamento já recebido.</p>
        ) : (
          <div className="space-y-3">
            <p className="text-sm font-medium">Marcar recebido</p>
            <div className="space-y-1.5">
              <Label className="text-xs">Forma</Label>
              <Select value={forma} onValueChange={setForma}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="pix">Pix</SelectItem>
                  <SelectItem value="boleto">Boleto</SelectItem>
                  <SelectItem value="transferencia">Transferência</SelectItem>
                  <SelectItem value="dinheiro">Dinheiro</SelectItem>
                  <SelectItem value="cartao">Cartão</SelectItem>
                  <SelectItem value="cheque">Cheque</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Data do recebimento</Label>
              <Input type="date" className="h-9" value={data} onChange={(e) => setData(e.target.value)} />
            </div>
            <Button
              size="sm"
              className="w-full"
              disabled={receberPedido.isPending}
              onClick={() => {
                receberPedido.mutate(
                  { pedido, data, forma },
                  { onSuccess: () => setOpen(false) },
                );
              }}
            >
              Confirmar recebimento
            </Button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
