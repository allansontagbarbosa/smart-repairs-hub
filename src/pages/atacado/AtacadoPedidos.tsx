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
} from "lucide-react";
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
import { formatBRL, maskCNPJ } from "@/lib/utils";
import { AtacadoEmptyState } from "@/components/atacado/AtacadoEmptyState";
import {
  calcularStatusPagamento,
  labelStatusPagamento,
  classesStatusPagamento,
} from "@/lib/atacadoPagamentoStatus";

export default function AtacadoPedidos() {
  const { empresaId } = useEmpresa();
  const { toast } = useToast();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const perms = usePermissoesAtacado();
  const [busca, setBusca] = useState("");
  const [statusFilter, setStatusFilter] = useState("todos");
  const [periodoFilter, setPeriodoFilter] = useState("este_mes");

  const hoje = new Date();
  const inicio = (() => {
    if (periodoFilter === "hoje") return hoje.toISOString().slice(0, 10);
    if (periodoFilter === "ultimos_7") {
      const d = new Date();
      d.setDate(d.getDate() - 7);
      return d.toISOString().slice(0, 10);
    }
    if (periodoFilter === "ultimos_30") {
      const d = new Date();
      d.setDate(d.getDate() - 30);
      return d.toISOString().slice(0, 10);
    }
    if (periodoFilter === "este_ano") return `${hoje.getFullYear()}-01-01`;
    return `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, "0")}-01`;
  })();

  const { data: pedidos = [], isLoading } = useQuery({
    queryKey: ["atacado-pedidos", empresaId, busca, statusFilter, inicio],
    queryFn: async () => {
      let q = supabase
        .from("atacado_pedidos")
        .select(
          `*, cliente:atacado_clientes(razao_social, nome_fantasia, cnpj), vendedor:funcionarios!vendedor_id(nome), pagamentos:atacado_pedidos_pagamentos(status, vencimento)`
        )
        .eq("empresa_id", empresaId!)
        .is("deleted_at", null)
        .gte("created_at", inicio);
      if (statusFilter !== "todos") q = q.eq("status", statusFilter);
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

  const totalPedidos = pedidos.length;
  const aguardando = pedidos.filter(
    (p: any) => p.status === "aguardando_aprovacao"
  ).length;
  const faturados = pedidos.filter((p: any) =>
    ["faturado", "entregue"].includes(p.status)
  );
  const valorFaturado = faturados.reduce(
    (s: number, p: any) => s + Number(p.total),
    0
  );
  const ticketMedio =
    faturados.length > 0 ? valorFaturado / faturados.length : 0;

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

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Kpi label="Pedidos no período" valor={totalPedidos} />
        <Kpi label="Aguardando aprovação" valor={aguardando} danger={aguardando > 0} />
        <Kpi label="Valor faturado" valor={formatBRL(valorFaturado)} />
        <Kpi label="Ticket médio" valor={formatBRL(ticketMedio)} />
      </div>

      {/* Filtros */}
      <div className="flex flex-col md:flex-row gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por número do pedido (ex.: 123)"
            className="pl-9"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="md:w-52">
            <SelectValue />
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
        <Select value={periodoFilter} onValueChange={setPeriodoFilter}>
          <SelectTrigger className="md:w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="hoje">Hoje</SelectItem>
            <SelectItem value="ultimos_7">Últimos 7 dias</SelectItem>
            <SelectItem value="este_mes">Este mês</SelectItem>
            <SelectItem value="ultimos_30">Últimos 30 dias</SelectItem>
            <SelectItem value="este_ano">Este ano</SelectItem>
          </SelectContent>
        </Select>
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
        <div className="border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
              <tr>
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
                  <td className="px-4 py-3">
                    <div className="flex flex-col gap-1">
                      <StatusBadge status={p.status} />
                      <PagamentoBadge pagamentos={p.pagamentos} />
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
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
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

function PedidoActions({ pedido, perms, mudarStatus }: any) {
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

  if (acoes.length === 0) return null;

  return (
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
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
