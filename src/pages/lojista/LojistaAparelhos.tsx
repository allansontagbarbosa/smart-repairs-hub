import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useLojistaAuth } from "@/hooks/useLojistaAuth";
import { StatusBadge } from "@/components/StatusBadge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Search, Download, Filter, Calendar } from "lucide-react";
import { cn } from "@/lib/utils";

function fmt(v: number | null | undefined) {
  return `R$ ${(v ?? 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;
}

export default function LojistaAparelhos() {
  const { lojistaUser } = useLojistaAuth();
  const lojistaId = lojistaUser?.lojista_id;
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("todos");
  const [periodo, setPeriodo] = useState("todos");
  const [selectedOs, setSelectedOs] = useState<any>(null);

  const { data: ordens = [] } = useQuery({
    queryKey: ["lojista-aparelhos", lojistaId],
    enabled: !!lojistaId,
    queryFn: async () => {
      const { data } = await supabase
        .from("ordens_de_servico")
        .select("id, numero, status, valor, valor_pago, data_entrada, previsao_entrega, defeito_relatado, diagnostico, servico_realizado, aparelhos(marca, modelo, imei)")
        .eq("lojista_id", lojistaId!)
        .is("deleted_at", null)
        .order("data_entrada", { ascending: false });
      return data ?? [];
    },
  });

  const { data: garantiasAtivas = [] } = useQuery({
    queryKey: ["lojista-garantias-ids", lojistaId],
    enabled: !!lojistaId,
    queryFn: async () => {
      const { data } = await supabase
        .from("garantias")
        .select("ordem_id")
        .eq("status", "ativa")
        .gte("data_fim", new Date().toISOString().split("T")[0]);
      return (data ?? []).map(g => g.ordem_id);
    },
  });

  const filtered = useMemo(() => {
    let list = ordens;

    if (statusFilter === "em_garantia") {
      list = list.filter(o => garantiasAtivas.includes(o.id));
    } else if (statusFilter === "na_assistencia") {
      list = list.filter(o => !["entregue"].includes(o.status));
    } else if (statusFilter !== "todos") {
      list = list.filter(o => o.status === statusFilter);
    }

    if (periodo !== "todos") {
      const now = new Date();
      const months = periodo === "mes" ? 1 : 3;
      const cutoff = new Date(now.getFullYear(), now.getMonth() - months, now.getDate());
      list = list.filter(o => new Date(o.data_entrada) >= cutoff);
    }

    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(o =>
        String(o.numero).includes(q) ||
        ((o.aparelhos as any)?.imei || "").includes(q) ||
        ((o.aparelhos as any)?.modelo || "").toLowerCase().includes(q) ||
        ((o.aparelhos as any)?.marca || "").toLowerCase().includes(q)
      );
    }

    return list;
  }, [ordens, statusFilter, periodo, search, garantiasAtivas]);

  function exportCsv() {
    const header = "OS,Aparelho,IMEI,Status,Data Entrada,Previsão,Valor";
    const rows = filtered.map(o =>
      [
        o.numero,
        `${(o.aparelhos as any)?.marca} ${(o.aparelhos as any)?.modelo}`,
        (o.aparelhos as any)?.imei || "",
        o.status,
        new Date(o.data_entrada).toLocaleDateString("pt-BR"),
        o.previsao_entrega ? new Date(o.previsao_entrega).toLocaleDateString("pt-BR") : "",
        (o.valor ?? 0).toFixed(2),
      ].join(",")
    );
    const csv = [header, ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `aparelhos_${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">Aparelhos</h1>
        <Button variant="outline" size="sm" onClick={exportCsv} className="gap-1.5 text-xs">
          <Download className="h-3.5 w-3.5" />
          Exportar CSV
        </Button>
      </div>

      <div className="flex flex-wrap gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar IMEI, OS# ou modelo..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-9 text-sm"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[160px] h-9 text-xs">
            <Filter className="h-3.5 w-3.5 mr-1.5" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos</SelectItem>
            <SelectItem value="na_assistencia">Na assistência</SelectItem>
            <SelectItem value="pronto">Prontos</SelectItem>
            <SelectItem value="entregue">Entregues</SelectItem>
            <SelectItem value="em_garantia">Em garantia</SelectItem>
          </SelectContent>
        </Select>
        <Select value={periodo} onValueChange={setPeriodo}>
          <SelectTrigger className="w-[150px] h-9 text-xs">
            <Calendar className="h-3.5 w-3.5 mr-1.5" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="mes">Este mês</SelectItem>
            <SelectItem value="3meses">Últimos 3 meses</SelectItem>
            <SelectItem value="todos">Todos</SelectItem>
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
                <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground hidden md:table-cell">Entrada</th>
                <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground hidden md:table-cell">Previsão</th>
                <th className="text-right px-4 py-2.5 text-xs font-medium text-muted-foreground">Valor</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filtered.map((os) => (
                <tr
                  key={os.id}
                  onClick={() => setSelectedOs(os)}
                  className="hover:bg-muted/30 cursor-pointer transition-colors"
                >
                  <td className="px-4 py-3 font-medium">#{String(os.numero).padStart(3, "0")}</td>
                  <td className="px-4 py-3">
                    {(os.aparelhos as any)?.marca} {(os.aparelhos as any)?.modelo}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground hidden sm:table-cell font-mono text-xs">
                    {(os.aparelhos as any)?.imei || "—"}
                  </td>
                  <td className="px-4 py-3"><StatusBadge status={os.status} /></td>
                  <td className="px-4 py-3 text-muted-foreground hidden md:table-cell">
                    {new Date(os.data_entrada).toLocaleDateString("pt-BR")}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground hidden md:table-cell">
                    {os.previsao_entrega ? new Date(os.previsao_entrega).toLocaleDateString("pt-BR") : "—"}
                  </td>
                  <td className="px-4 py-3 text-right font-medium">{fmt(os.valor)}</td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-muted-foreground text-sm">
                    Nenhum aparelho encontrado
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Detail Sheet */}
      <Sheet open={!!selectedOs} onOpenChange={(v) => !v && setSelectedOs(null)}>
        <SheetContent className="w-full sm:max-w-md overflow-y-auto">
          {selectedOs && (
            <>
              <SheetHeader>
                <SheetTitle>OS #{String(selectedOs.numero).padStart(3, "0")}</SheetTitle>
              </SheetHeader>
              <div className="mt-4 space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Status</span>
                  <StatusBadge status={selectedOs.status} />
                </div>
                <div className="space-y-2">
                  <DetailRow label="Aparelho" value={`${(selectedOs.aparelhos as any)?.marca} ${(selectedOs.aparelhos as any)?.modelo}`} />
                  <DetailRow label="IMEI" value={(selectedOs.aparelhos as any)?.imei || "—"} />
                  <DetailRow label="Defeito" value={selectedOs.defeito_relatado} />
                  {selectedOs.diagnostico && <DetailRow label="Diagnóstico" value={selectedOs.diagnostico} />}
                  {selectedOs.servico_realizado && <DetailRow label="Serviço realizado" value={selectedOs.servico_realizado} />}
                  <DetailRow label="Data entrada" value={new Date(selectedOs.data_entrada).toLocaleDateString("pt-BR")} />
                  {selectedOs.previsao_entrega && (
                    <DetailRow label="Previsão" value={new Date(selectedOs.previsao_entrega).toLocaleDateString("pt-BR")} />
                  )}
                  <DetailRow label="Valor" value={fmt(selectedOs.valor)} />
                  <DetailRow label="Pago" value={fmt(selectedOs.valor_pago)} />
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium text-right max-w-[60%]">{value}</span>
    </div>
  );
}
