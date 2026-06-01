import { useTerceirizacoesDaOS, useRegistrarRetornoTerceiro } from "@/hooks/useTerceirizacao";
import { Button } from "@/components/ui/button";
import { Truck, Calendar, DollarSign, ArrowLeftRight, Loader2 } from "lucide-react";

interface Props {
  osId: string;
}

export function TerceirizacaoAtivaPanel({ osId }: Props) {
  const { data: lista = [], isLoading } = useTerceirizacoesDaOS(osId);
  const retorno = useRegistrarRetornoTerceiro();
  const ativa = lista.find(t => t.status === "enviado");

  if (isLoading || !ativa) return null;

  const dEnvio = ativa.data_envio ? new Date(ativa.data_envio + "T00:00:00").toLocaleDateString("pt-BR") : "—";
  const dPrev = ativa.previsao_retorno ? new Date(ativa.previsao_retorno + "T00:00:00").toLocaleDateString("pt-BR") : null;
  const nome = ativa.terceiro_nome || ativa.assistencia_terceiros?.nome || "—";

  return (
    <div className="mb-4 rounded-lg border border-[hsl(270_70%_64%/0.4)] bg-[hsl(270_70%_64%/0.08)] p-3">
      <div className="flex items-center gap-2 mb-2">
        <Truck className="h-4 w-4 text-[hsl(270_70%_50%)]" />
        <span className="text-sm font-semibold text-[hsl(270_70%_45%)]">Em terceiro: {nome}</span>
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground mb-3">
        <span className="inline-flex items-center gap-1"><Calendar className="h-3 w-3" /> Enviado: {dEnvio}</span>
        {dPrev && <span className="inline-flex items-center gap-1"><Calendar className="h-3 w-3" /> Previsão: {dPrev}</span>}
        <span className="inline-flex items-center gap-1"><DollarSign className="h-3 w-3" /> R$ {Number(ativa.custo).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span>
        {ativa.servico && <span>· {ativa.servico}</span>}
      </div>
      <Button
        size="sm"
        variant="outline"
        onClick={() => retorno.mutate({ terceirizacao_id: ativa.id, os_id: osId, novo_status: "em_reparo" })}
        disabled={retorno.isPending}
      >
        {retorno.isPending ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <ArrowLeftRight className="h-3.5 w-3.5 mr-1" />}
        Registrar retorno
      </Button>
    </div>
  );
}
