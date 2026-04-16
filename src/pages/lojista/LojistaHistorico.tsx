import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useLojistaAuth } from "@/hooks/useLojistaAuth";
import { StatusBadge } from "@/components/StatusBadge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Search, Filter, ChevronLeft, ChevronRight } from "lucide-react";

function fmt(v: number | null | undefined) {
  return `R$ ${(v ?? 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;
}

const PAGE_SIZE = 50;

export default function LojistaHistorico() {
  const { lojistaUser } = useLojistaAuth();
  const lojistaId = lojistaUser?.lojista_id;
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("todos");
  const [page, setPage] = useState(0);

  const { data: ordens = [] } = useQuery({
    queryKey: ["lojista-historico", lojistaId],
    enabled: !!lojistaId,
    queryFn: async () => {
      const { data } = await supabase
        .from("ordens_de_servico")
        .select("id, numero, status, valor, data_entrada, aparelhos(marca, modelo, imei)")
        .eq("lojista_id", lojistaId!)
        .is("deleted_at", null)
        .order("data_entrada", { ascending: false });
      return data ?? [];
    },
  });

  const filtered = useMemo(() => {
    let list = ordens;
    if (statusFilter !== "todos") list = list.filter(o => o.status === statusFilter);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(o =>
        String(o.numero).includes(q) ||
        ((o.aparelhos as any)?.imei || "").includes(q) ||
        ((o.aparelhos as any)?.modelo || "").toLowerCase().includes(q)
      );
    }
    return list;
  }, [ordens, statusFilter, search]);

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paginated = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  const totalAtendidos = ordens.length;
  const totalGasto = ordens.reduce((s, o) => s + (o.valor ?? 0), 0);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">Histórico completo</h1>
      </div>

      {/* Totals */}
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-xl border bg-card p-3.5">
          <span className="text-[11px] text-muted-foreground">Total de aparelhos atendidos</span>
          <p className="text-lg font-bold">{totalAtendidos}</p>
        </div>
        <div className="rounded-xl border bg-card p-3.5">
          <span className="text-[11px] text-muted-foreground">Valor total gasto</span>
          <p className="text-lg font-bold">{fmt(totalGasto)}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar IMEI, OS# ou modelo..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(0); }}
            className="pl-9 h-9 text-sm"
          />
        </div>
        <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(0); }}>
          <SelectTrigger className="w-[150px] h-9 text-xs">
            <Filter className="h-3.5 w-3.5 mr-1.5" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos</SelectItem>
            <SelectItem value="recebido">Recebido</SelectItem>
            <SelectItem value="em_reparo">Em Reparo</SelectItem>
            <SelectItem value="pronto">Pronto</SelectItem>
            <SelectItem value="entregue">Entregue</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <div className="rounded-xl border bg-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/30">
                <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground">OS#</th>
                <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground">Aparelho</th>
                <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground hidden sm:table-cell">IMEI</th>
                <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground">Status</th>
                <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground hidden md:table-cell">Data</th>
                <th className="text-right px-4 py-2.5 text-xs font-medium text-muted-foreground">Valor</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {paginated.map((os) => (
                <tr key={os.id} className="hover:bg-muted/30">
                  <td className="px-4 py-3 font-medium">#{String(os.numero).padStart(3, "0")}</td>
                  <td className="px-4 py-3">{(os.aparelhos as any)?.marca} {(os.aparelhos as any)?.modelo}</td>
                  <td className="px-4 py-3 font-mono text-xs text-muted-foreground hidden sm:table-cell">
                    {(os.aparelhos as any)?.imei || "—"}
                  </td>
                  <td className="px-4 py-3"><StatusBadge status={os.status} /></td>
                  <td className="px-4 py-3 text-muted-foreground hidden md:table-cell">
                    {new Date(os.data_entrada).toLocaleDateString("pt-BR")}
                  </td>
                  <td className="px-4 py-3 text-right font-medium">{fmt(os.valor)}</td>
                </tr>
              ))}
              {paginated.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground text-sm">Nenhum registro encontrado</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">
            Página {page + 1} de {totalPages} ({filtered.length} registros)
          </span>
          <div className="flex gap-1">
            <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage(p => p - 1)}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="sm" disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
