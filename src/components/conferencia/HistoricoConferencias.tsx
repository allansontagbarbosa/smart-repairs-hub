import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useState } from "react";
import { Loader2, CheckCircle2, AlertTriangle, XCircle, PlusCircle, Eye, FileDown } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConferenciaResumoDrawer, type ConferenciaResumo } from "./ConferenciaResumoDrawer";

type Props = {
  /** Filtra por tipo: "aparelhos" ou "pecas" */
  tipo: "aparelhos" | "pecas";
};

type ConferenciaRow = {
  id: string;
  data: string;
  responsavel: string;
  total_esperado: number;
  total_conferido: number;
  total_divergencias: number;
  status: string;
  detalhes: any;
};

export function HistoricoConferencias({ tipo }: Props) {
  const [resumoOpen, setResumoOpen] = useState(false);
  const [resumoSelecionado, setResumoSelecionado] = useState<ConferenciaResumo | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["historico_conferencias", tipo],
    queryFn: async (): Promise<ConferenciaRow[]> => {
      const { data, error } = await supabase
        .from("conferencias_estoque")
        .select("id, data, responsavel, total_esperado, total_conferido, total_divergencias, status, detalhes")
        .eq("tipo", tipo)
        .order("data", { ascending: false })
        .limit(50);
      if (error) throw error;
      return (data ?? []) as ConferenciaRow[];
    },
  });

  const verResumo = (row: ConferenciaRow) => {
    const det = row.detalhes ?? {};
    setResumoSelecionado({
      tipo,
      titulo: `Conferência de ${tipo === "aparelhos" ? "aparelhos" : "peças"} — ${format(new Date(row.data), "dd/MM/yyyy HH:mm", { locale: ptBR })}`,
      conferidos: det.conferidos ?? [],
      divergencias: det.divergencias ?? [],
      naoEncontrados: det.naoEncontrados ?? [],
      foraDoSistema: det.foraDoSistema ?? [],
    });
    setResumoOpen(true);
  };

  if (isLoading) {
    return <div className="flex justify-center py-12"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>;
  }

  if (!data || data.length === 0) {
    return (
      <div className="section-card p-10 text-center">
        <p className="text-sm text-muted-foreground">Nenhuma conferência salva ainda.</p>
        <p className="text-xs text-muted-foreground mt-1">Use o botão "📷 Conferir" para iniciar uma auditoria.</p>
      </div>
    );
  }

  return (
    <>
      <div className="section-card">
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>Data</th>
                <th>Responsável</th>
                <th className="text-right">Esperado</th>
                <th className="text-right">Conferido</th>
                <th className="text-right">Divergências</th>
                <th>Status</th>
                <th className="w-10"></th>
              </tr>
            </thead>
            <tbody>
              {data.map((c) => (
                <tr key={c.id}>
                  <td className="text-sm">{format(new Date(c.data), "dd/MM/yyyy HH:mm", { locale: ptBR })}</td>
                  <td className="text-sm">{c.responsavel}</td>
                  <td className="text-sm text-right tabular-nums">{c.total_esperado}</td>
                  <td className="text-sm text-right tabular-nums text-success">{c.total_conferido}</td>
                  <td className={`text-sm text-right tabular-nums font-medium ${c.total_divergencias > 0 ? "text-destructive" : "text-muted-foreground"}`}>
                    {c.total_divergencias}
                  </td>
                  <td>
                    <Badge variant={c.status === "finalizada" ? "secondary" : "outline"} className="text-[10px]">
                      {c.status}
                    </Badge>
                  </td>
                  <td>
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => verResumo(c)}>
                      <Eye className="h-3.5 w-3.5" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="px-4 py-2 border-t text-xs text-muted-foreground">
          {data.length} conferência{data.length !== 1 ? "s" : ""} {data.length === 50 && "(últimas 50)"}
        </div>
      </div>

      <ConferenciaResumoDrawer
        open={resumoOpen}
        onClose={() => setResumoOpen(false)}
        resumo={resumoSelecionado}
        onSalvar={async () => setResumoOpen(false)}
      />
    </>
  );
}
