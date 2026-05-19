import { useState } from "react";
import { AlertTriangle, ChevronDown, ChevronRight } from "lucide-react";
import { useOSPendenteAtribuicao } from "@/hooks/useOSPendenteAtribuicao";

interface Props {
  onAbrirOS: (orderId: string) => void;
}

export function BannerOSPendentes({ onAbrirOS }: Props) {
  const [expanded, setExpanded] = useState(false);
  const { data: pendentes = [], isLoading } = useOSPendenteAtribuicao();

  if (isLoading || pendentes.length === 0) return null;

  const totalServicos = pendentes.reduce((s, p) => s + Number(p.qtd_servicos_pendentes || 0), 0);
  const totalValor = pendentes.reduce((s, p) => s + Number(p.valor_servicos_pendentes || 0), 0);

  return (
    <div className="rounded-md border border-warning/40 bg-warning-muted overflow-hidden">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center gap-3 p-3 hover:bg-warning/10 transition-colors text-left"
      >
        <AlertTriangle className="h-5 w-5 shrink-0 text-warning" />
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium">
            {pendentes.length} OS com técnico não atribuído
          </div>
          <div className="text-xs text-muted-foreground mt-0.5">
            {totalServicos} serviço{totalServicos !== 1 ? "s" : ""} pendente
            {totalServicos !== 1 ? "s" : ""} ·{" "}
            R$ {totalValor.toLocaleString("pt-BR", { minimumFractionDigits: 2 })} ·{" "}
            Clique para resolver
          </div>
        </div>
        {expanded ? (
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        ) : (
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
        )}
      </button>

      {expanded && (
        <div className="border-t border-warning/30 bg-card/50">
          {pendentes.map((os) => (
            <button
              key={os.ordem_id}
              type="button"
              onClick={() => onAbrirOS(os.ordem_id)}
              className="w-full flex items-center gap-3 p-3 border-b border-warning/20 hover:bg-muted/40 transition-colors text-left last:border-b-0"
            >
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium truncate">
                  OS #{String(os.numero).padStart(5, "0")} — {os.cliente_nome}
                </div>
                <div className="text-xs text-muted-foreground mt-0.5 truncate">
                  {os.aparelho} · {os.qtd_servicos_pendentes} serviço(s) ·{" "}
                  R$ {Number(os.valor_servicos_pendentes).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                </div>
              </div>
              <span className="text-xs px-2 py-1 rounded bg-muted text-muted-foreground shrink-0">
                {os.status}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
