import { useState } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEmpresa } from "@/contexts/EmpresaContext";
import { Plus, Search, Download, Loader2 } from "lucide-react";
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
import { formatBRL } from "@/lib/utils";
import { AtacadoEmptyState } from "@/components/atacado/AtacadoEmptyState";
import { PedidoAtacadoDrawer } from "@/components/atacado/PedidoAtacadoDrawer";

const STATUS_CONFIG: Record<string, { label: string; cls: string }> = {
  rascunho: { label: "Rascunho", cls: "bg-muted text-muted-foreground" },
  aguardando_aprovacao: {
    label: "Aguardando aprovação",
    cls: "bg-warning/15 text-warning border-warning/30",
  },
  aprovado: { label: "Aprovado", cls: "bg-info/15 text-info border-info/30" },
  faturado: { label: "Faturado", cls: "bg-primary/15 text-primary border-primary/30" },
  entregue: { label: "Entregue", cls: "bg-success/15 text-success border-success/30" },
  cancelado: { label: "Cancelado", cls: "bg-destructive/15 text-destructive border-destructive/30" },
};

export default function AtacadoPedidos() {
  const { empresaId } = useEmpresa();
  const [searchParams, setSearchParams] = useSearchParams();
  const [busca, setBusca] = useState("");
  const [statusFilter, setStatusFilter] = useState(searchParams.get("status") ?? "ativos");
  const [pedidoDrawerId, setPedidoDrawerId] = useState<string | null>(null);

  const { data: pedidos = [], isLoading } = useQuery({
    queryKey: ["atacado-pedidos", empresaId, statusFilter],
    queryFn: async () => {
      let q = supabase
        .from("atacado_pedidos")
        .select(
          `id, numero_pedido, total, status, created_at, condicao_pagamento,
           cliente:atacado_clientes(razao_social, nome_fantasia, cnpj),
           vendedor:funcionarios!vendedor_id(nome)`
        )
        .eq("empresa_id", empresaId!)
        .is("deleted_at", null);

      if (statusFilter === "ativos") {
        q = q.not("status", "in", "(cancelado,entregue)");
      } else if (statusFilter !== "todos") {
        q = q.eq("status", statusFilter);
      }

      const { data } = await q.order("created_at", { ascending: false }).limit(200);
      return (data ?? []) as any[];
    },
    enabled: !!empresaId,
  });

  const pedidosFiltrados = busca
    ? pedidos.filter((p: any) => {
        const nome = (p.cliente?.nome_fantasia || p.cliente?.razao_social || "").toLowerCase();
        return (
          nome.includes(busca.toLowerCase()) ||
          String(p.numero_pedido).includes(busca)
        );
      })
    : pedidos;

  const handleExportCSV = () => {
    const headers = ["Número", "Cliente", "Status", "Total", "Vendedor", "Condição", "Data"];
    const rows = pedidosFiltrados.map((p: any) => [
      `#P-${String(p.numero_pedido).padStart(6, "0")}`,
      p.cliente?.nome_fantasia || p.cliente?.razao_social || "—",
      STATUS_CONFIG[p.status]?.label ?? p.status,
      Number(p.total).toFixed(2).replace(".", ","),
      p.vendedor?.nome || "—",
      p.condicao_pagamento || "—",
      new Date(p.created_at).toLocaleDateString("pt-BR"),
    ]);
    const csv = [headers, ...rows].map((r) => r.join(";")).join("\n");
    const blob = new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `pedidos-atacado-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const totalFaturado = pedidos
    .filter((p: any) => ["faturado", "entregue"].includes(p.status))
    .reduce((s: number, p: any) => s + Number(p.total), 0);
  const aguardando = pedidos.filter((p: any) => p.status === "aguardando_aprovacao").length;
  const aprovados = pedidos.filter((p: any) => p.status === "aprovado").length;

  return (
    <div className="container mx-auto p-6 space-y-4">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold">Pedidos B2B</h1>
          <p className="text-sm text-muted-foreground">Acompanhamento e gestão de pedidos</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleExportCSV} disabled={pedidosFiltrados.length === 0}>
            <Download className="h-4 w-4" /> Exportar CSV
          </Button>
          <Button asChild>
            <Link to="/atacado/novo-pedido">
              <Plus className="h-4 w-4" /> Novo pedido
            </Link>
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiBox label="Total no período" valor={pedidos.length} />
        <KpiBox label="Faturado" valor={formatBRL(totalFaturado)} accent />
        <KpiBox label="Aguardando aprovação" valor={aguardando} warning={aguardando > 0} />
        <KpiBox label="Aprovados a faturar" valor={aprovados} />
      </div>

      <div className="flex gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por número ou cliente..."
            className="pl-9"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
          />
        </div>
        <Select
          value={statusFilter}
          onValueChange={(v) => {
            setStatusFilter(v);
            if (v === "todos") searchParams.delete("status");
            else searchParams.set("status", v);
            setSearchParams(searchParams);
          }}
        >
          <SelectTrigger className="w-[220px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ativos">Ativos (não cancelados)</SelectItem>
            <SelectItem value="todos">Todos</SelectItem>
            <SelectItem value="rascunho">Rascunhos</SelectItem>
            <SelectItem value="aguardando_aprovacao">Aguardando aprovação</SelectItem>
            <SelectItem value="aprovado">Aprovados</SelectItem>
            <SelectItem value="faturado">Faturados</SelectItem>
            <SelectItem value="entregue">Entregues</SelectItem>
            <SelectItem value="cancelado">Cancelados</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : pedidosFiltrados.length === 0 ? (
        <AtacadoEmptyState
          title="Nenhum pedido encontrado"
          description="Crie um novo pedido B2B ou ajuste os filtros."
          actionLabel="Novo pedido"
          actionTo="/atacado/novo-pedido"
        />
      ) : (
        <div className="border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="text-left p-3 font-medium">Número</th>
                <th className="text-left p-3 font-medium">Cliente</th>
                <th className="text-left p-3 font-medium hidden md:table-cell">Vendedor</th>
                <th className="text-left p-3 font-medium hidden lg:table-cell">Condição</th>
                <th className="text-right p-3 font-medium">Total</th>
                <th className="text-left p-3 font-medium">Status</th>
                <th className="text-left p-3 font-medium hidden md:table-cell">Data</th>
              </tr>
            </thead>
            <tbody>
              {pedidosFiltrados.map((p: any) => {
                const cfg = STATUS_CONFIG[p.status] ?? { label: p.status, cls: "" };
                return (
                  <tr
                    key={p.id}
                    onClick={() => setPedidoDrawerId(p.id)}
                    className="cursor-pointer hover:bg-muted/40 border-b transition-colors"
                  >
                    <td className="p-3 font-mono text-xs">
                      #P-{String(p.numero_pedido).padStart(6, "0")}
                    </td>
                    <td className="p-3">
                      <div className="font-medium">
                        {p.cliente?.nome_fantasia || p.cliente?.razao_social || "—"}
                      </div>
                    </td>
                    <td className="p-3 hidden md:table-cell text-muted-foreground">
                      {p.vendedor?.nome || "—"}
                    </td>
                    <td className="p-3 hidden lg:table-cell text-muted-foreground">
                      {p.condicao_pagamento || "—"}
                    </td>
                    <td className="p-3 text-right font-bold tabular-nums">
                      {formatBRL(Number(p.total))}
                    </td>
                    <td className="p-3">
                      <Badge variant="outline" className={cfg.cls}>
                        {cfg.label}
                      </Badge>
                    </td>
                    <td className="p-3 hidden md:table-cell text-xs text-muted-foreground">
                      {new Date(p.created_at).toLocaleDateString("pt-BR")}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <PedidoAtacadoDrawer
        open={!!pedidoDrawerId}
        onOpenChange={(v) => !v && setPedidoDrawerId(null)}
        pedidoId={pedidoDrawerId}
      />
    </div>
  );
}

function KpiBox({
  label,
  valor,
  accent,
  warning,
}: {
  label: string;
  valor: string | number;
  accent?: boolean;
  warning?: boolean;
}) {
  return (
    <div
      className={`p-3 rounded-lg border ${
        warning
          ? "bg-warning/10 border-warning/30"
          : accent
            ? "bg-primary/5 border-primary/30"
            : "bg-card"
      }`}
    >
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
        {label}
      </div>
      <div
        className={`text-xl font-bold mt-1 tabular-nums ${
          warning ? "text-warning" : accent ? "text-primary" : ""
        }`}
      >
        {valor}
      </div>
    </div>
  );
}
