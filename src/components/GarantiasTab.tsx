import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Shield, Search, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type FilterType = "todas" | "ativas" | "vencendo" | "vencidas" | "utilizadas";

export function GarantiasTab() {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<FilterType>("ativas");

  const { data: garantias = [], isLoading } = useQuery({
    queryKey: ["garantias_list"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("garantias")
        .select("*, ordens_de_servico ( numero, aparelhos ( marca, modelo, clientes ( nome ) ) )")
        .order("data_fim", { ascending: true });
      if (error) throw error;
      return data;
    },
  });

  const hoje = new Date();

  const enriched = garantias.map((g) => {
    const fim = new Date(g.data_fim);
    const diasRestantes = Math.ceil((fim.getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24));
    const os = g.ordens_de_servico as any;
    return {
      ...g,
      diasRestantes,
      osNumero: os?.numero,
      clienteNome: os?.aparelhos?.clientes?.nome || "—",
      aparelhoNome: os?.aparelhos ? `${os.aparelhos.marca} ${os.aparelhos.modelo}` : "—",
      computed: g.status === "utilizada" ? "utilizada" as const
        : diasRestantes <= 0 ? "vencida" as const
        : diasRestantes <= 30 ? "vencendo" as const
        : "ativa" as const,
    };
  });

  const filtered = enriched.filter((g) => {
    const q = search.toLowerCase();
    const matchSearch = !search || g.clienteNome.toLowerCase().includes(q)
      || g.aparelhoNome.toLowerCase().includes(q)
      || String(g.osNumero).includes(q);
    const matchFilter = filter === "todas"
      || (filter === "ativas" && g.computed === "ativa")
      || (filter === "vencendo" && g.computed === "vencendo")
      || (filter === "vencidas" && g.computed === "vencida")
      || (filter === "utilizadas" && g.computed === "utilizada");
    return matchSearch && matchFilter;
  });

  const counts = {
    todas: enriched.length,
    ativas: enriched.filter(g => g.computed === "ativa").length,
    vencendo: enriched.filter(g => g.computed === "vencendo").length,
    vencidas: enriched.filter(g => g.computed === "vencida").length,
    utilizadas: enriched.filter(g => g.computed === "utilizada").length,
  };

  const filters: { key: FilterType; label: string }[] = [
    { key: "todas", label: "Todas" },
    { key: "ativas", label: "Ativas" },
    { key: "vencendo", label: "Vencendo (30d)" },
    { key: "vencidas", label: "Vencidas" },
    { key: "utilizadas", label: "Utilizadas" },
  ];

  const statusBadge = (computed: string) => {
    if (computed === "utilizada") return <Badge variant="secondary">Utilizada</Badge>;
    if (computed === "vencida") return <Badge variant="destructive">Vencida</Badge>;
    if (computed === "vencendo") return <Badge className="bg-warning text-warning-foreground">Vencendo</Badge>;
    return <Badge className="bg-success text-success-foreground">Ativa</Badge>;
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Shield className="h-5 w-5 text-primary" />
        <h2 className="text-lg font-semibold">Garantias</h2>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Buscar por cliente, aparelho ou OS..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
      </div>

      <div className="flex gap-1.5 overflow-x-auto pb-1">
        {filters.map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={cn(
              "shrink-0 inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium border transition-colors",
              filter === f.key
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-card text-muted-foreground border-border hover:bg-muted"
            )}
          >
            {f.label}
            {counts[f.key] > 0 && <span className="text-[10px] opacity-70">{counts[f.key]}</span>}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : (
        <div className="rounded-lg border bg-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-muted/50 border-b">
                <tr>
                  <th className="px-3 py-2 text-xs font-semibold text-muted-foreground">OS</th>
                  <th className="px-3 py-2 text-xs font-semibold text-muted-foreground">Cliente</th>
                  <th className="px-3 py-2 text-xs font-semibold text-muted-foreground">Aparelho</th>
                  <th className="px-3 py-2 text-xs font-semibold text-muted-foreground">Válida até</th>
                  <th className="px-3 py-2 text-xs font-semibold text-muted-foreground">Status</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((g) => (
                  <tr key={g.id} className="border-b last:border-0 hover:bg-muted/30">
                    <td className="px-3 py-2 font-mono text-xs text-primary">
                      #{String(g.osNumero).padStart(3, "0")}
                    </td>
                    <td className="px-3 py-2 text-sm">{g.clienteNome}</td>
                    <td className="px-3 py-2 text-sm text-muted-foreground">{g.aparelhoNome}</td>
                    <td className="px-3 py-2 text-xs text-muted-foreground">
                      {new Date(g.data_fim).toLocaleDateString("pt-BR")}
                      {g.computed !== "utilizada" && g.computed !== "vencida" && (
                        <span className="ml-1 text-[10px]">({g.diasRestantes}d)</span>
                      )}
                    </td>
                    <td className="px-3 py-2">{statusBadge(g.computed)}</td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr><td colSpan={5} className="py-8 text-center text-muted-foreground text-sm">Nenhuma garantia encontrada</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
