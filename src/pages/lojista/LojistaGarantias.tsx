import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useLojistaAuth } from "@/hooks/useLojistaAuth";
import { cn } from "@/lib/utils";
import { ShieldCheck } from "lucide-react";

export default function LojistaGarantias() {
  const { lojistaUser } = useLojistaAuth();
  const lojistaId = lojistaUser?.lojista_id;
  const today = new Date().toISOString().split("T")[0];

  const { data: garantias = [], isLoading } = useQuery({
    queryKey: ["lojista-garantias-full", lojistaId],
    enabled: !!lojistaId,
    queryFn: async () => {
      // Get all OS for this lojista
      const { data: osData } = await supabase
        .from("ordens_de_servico")
        .select("id, numero, aparelhos(marca, modelo, imei)")
        .eq("lojista_id", lojistaId!)
        .is("deleted_at", null);

      if (!osData?.length) return [];

      const osIds = osData.map(o => o.id);
      const { data: gData } = await supabase
        .from("garantias")
        .select("*")
        .in("ordem_id", osIds);

      return (gData ?? []).map(g => {
        const os = osData.find(o => o.id === g.ordem_id);
        return { ...g, os };
      });
    },
  });

  const ativas = garantias.filter(g => g.status === "ativa" && g.data_fim >= today);
  const vencidas = garantias.filter(g => g.data_fim < today || g.status !== "ativa");

  function diasRestantes(dataFim: string) {
    const diff = Math.ceil((new Date(dataFim).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    return Math.max(0, diff);
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="h-6 w-6 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-lg font-semibold">Garantias</h1>

      {/* Ativas */}
      <div>
        <h2 className="text-sm font-semibold mb-3 flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-success" />
          Garantias ativas ({ativas.length})
        </h2>
        {ativas.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4">Nenhuma garantia ativa no momento.</p>
        ) : (
          <div className="rounded-xl border bg-card overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/30">
                  <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground">Aparelho</th>
                  <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground">OS#</th>
                  <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground hidden sm:table-cell">IMEI</th>
                  <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground hidden md:table-cell">Data reparo</th>
                  <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground">Garantia até</th>
                  <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground">Dias rest.</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {ativas.map(g => {
                  const dias = diasRestantes(g.data_fim);
                  return (
                    <tr key={g.id} className="hover:bg-muted/30">
                      <td className="px-4 py-3">
                        {(g.os?.aparelhos as any)?.marca} {(g.os?.aparelhos as any)?.modelo}
                      </td>
                      <td className="px-4 py-3 font-medium">#{String(g.os?.numero ?? 0).padStart(3, "0")}</td>
                      <td className="px-4 py-3 font-mono text-xs text-muted-foreground hidden sm:table-cell">
                        {(g.os?.aparelhos as any)?.imei || "—"}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground hidden md:table-cell">
                        {new Date(g.data_inicio).toLocaleDateString("pt-BR")}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {new Date(g.data_fim).toLocaleDateString("pt-BR")}
                      </td>
                      <td className="px-4 py-3">
                        <span className={cn(
                          "text-xs font-semibold px-2 py-0.5 rounded-full",
                          dias > 30 ? "bg-success-muted text-success" : "bg-warning-muted text-warning"
                        )}>
                          {dias} dias
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Vencidas */}
      {vencidas.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold mb-3 text-muted-foreground">Garantias vencidas ({vencidas.length})</h2>
          <div className="rounded-xl border bg-card overflow-hidden opacity-70">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/30">
                  <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground">Aparelho</th>
                  <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground">OS#</th>
                  <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground">Venceu em</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {vencidas.map(g => (
                  <tr key={g.id}>
                    <td className="px-4 py-3">
                      {(g.os?.aparelhos as any)?.marca} {(g.os?.aparelhos as any)?.modelo}
                    </td>
                    <td className="px-4 py-3 font-medium">#{String(g.os?.numero ?? 0).padStart(3, "0")}</td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {new Date(g.data_fim).toLocaleDateString("pt-BR")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
