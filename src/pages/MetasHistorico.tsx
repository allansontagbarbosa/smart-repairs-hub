import { useNavigate } from "react-router-dom";
import { ArrowLeft, Check, X as XIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { useMetas, METRICAS_LABEL } from "@/hooks/useMetas";
import { formatValorMeta } from "@/components/metas/utils";

export default function MetasHistorico() {
  const navigate = useNavigate();
  const { data: metas = [], isLoading } = useMetas("todas");
  const concluidas = metas
    .filter(m => m.status === "concluida_sucesso" || m.status === "concluida_falha")
    .sort((a, b) => b.periodo_fim.localeCompare(a.periodo_fim));

  return (
    <div className="space-y-4 p-4 md:p-6">
      <div className="flex items-center gap-2">
        <SidebarTrigger />
        <Button variant="ghost" size="icon" onClick={() => navigate("/metas")}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-xl font-semibold">Histórico</h1>
          <p className="text-xs text-muted-foreground">{concluidas.length} meta(s) concluída(s)</p>
        </div>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Carregando...</p>
      ) : concluidas.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhuma meta concluída ainda.</p>
      ) : (
        <div className="rounded-lg border border-border bg-card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-xs text-muted-foreground">
              <tr>
                <th className="text-left p-2 font-medium">Meta</th>
                <th className="text-left p-2 font-medium">Período</th>
                <th className="text-left p-2 font-medium">Resultado</th>
                <th className="text-right p-2 font-medium">%</th>
                <th className="text-center p-2 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {concluidas.map(m => {
                const ok = m.status === "concluida_sucesso";
                const pct = m.valor_alvo > 0 ? (m.valor_atual / m.valor_alvo) * 100 : 0;
                return (
                  <tr key={m.id} onClick={() => navigate(`/metas/${m.id}`)} className="border-t border-border hover:bg-muted/30 cursor-pointer">
                    <td className="p-2">
                      <div className="font-medium">{m.nome}</div>
                      <div className="text-xs text-muted-foreground">{METRICAS_LABEL[m.metrica].label}</div>
                    </td>
                    <td className="p-2 text-xs">
                      {new Date(m.periodo_inicio + "T00:00:00").toLocaleDateString("pt-BR")} → {new Date(m.periodo_fim + "T00:00:00").toLocaleDateString("pt-BR")}
                    </td>
                    <td className="p-2 text-xs">
                      {formatValorMeta(m.valor_atual, m.metrica)} / {formatValorMeta(m.valor_alvo, m.metrica)}
                    </td>
                    <td className="p-2 text-right">{pct.toFixed(0)}%</td>
                    <td className="p-2 text-center">
                      {ok ? <Check className="h-4 w-4 mx-auto text-primary" /> : <XIcon className="h-4 w-4 mx-auto text-red-600" />}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
