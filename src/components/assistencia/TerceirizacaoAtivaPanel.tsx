import { useState } from "react";
import { useTerceirizacoesDaOS } from "@/hooks/useTerceirizacao";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Truck, Calendar, DollarSign, ArrowLeftRight, ShieldCheck, ShieldOff } from "lucide-react";
import { RegistrarRetornoTerceiroDialog } from "./RegistrarRetornoTerceiroDialog";

interface Props {
  osId: string;
}

function fmtData(iso?: string | null) {
  return iso ? new Date(iso + "T00:00:00").toLocaleDateString("pt-BR") : "—";
}

export function TerceirizacaoAtivaPanel({ osId }: Props) {
  const { data: lista = [], isLoading } = useTerceirizacoesDaOS(osId);
  const [dialogOpen, setDialogOpen] = useState(false);

  if (isLoading) return null;
  const ativa = lista.find(t => t.status === "enviado");
  const ultimaRetornada = lista.find(t => t.status === "retornado");

  if (!ativa && !ultimaRetornada) return null;

  return (
    <>
      {ativa && (
        <div className="mb-4 rounded-lg border border-[hsl(270_70%_64%/0.4)] bg-[hsl(270_70%_64%/0.08)] p-3">
          <div className="flex items-center gap-2 mb-2">
            <Truck className="h-4 w-4 text-[hsl(270_70%_50%)]" />
            <span className="text-sm font-semibold text-[hsl(270_70%_45%)]">
              Em terceiro: {ativa.terceiro_nome || ativa.assistencia_terceiros?.nome || "—"}
            </span>
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground mb-3">
            <span className="inline-flex items-center gap-1"><Calendar className="h-3 w-3" /> Enviado: {fmtData(ativa.data_envio)}</span>
            {ativa.previsao_retorno && (
              <span className="inline-flex items-center gap-1"><Calendar className="h-3 w-3" /> Previsão: {fmtData(ativa.previsao_retorno)}</span>
            )}
            <span className="inline-flex items-center gap-1">
              <DollarSign className="h-3 w-3" /> R$ {Number(ativa.custo).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
            </span>
            {ativa.servico && <span>· {ativa.servico}</span>}
          </div>
          <Button size="sm" variant="outline" onClick={() => setDialogOpen(true)}>
            <ArrowLeftRight className="h-3.5 w-3.5 mr-1" /> Registrar retorno
          </Button>
        </div>
      )}

      {!ativa && ultimaRetornada && (() => {
        const hoje = new Date().toISOString().slice(0, 10);
        const emGarantia = ultimaRetornada.garantia_ate && ultimaRetornada.garantia_ate >= hoje;
        const custo = Number(ultimaRetornada.custo_final ?? ultimaRetornada.custo) || 0;
        return (
          <div className="mb-4 rounded-lg border bg-muted/30 p-3">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <Truck className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-semibold">
                Retornou de {ultimaRetornada.terceiro_nome || ultimaRetornada.assistencia_terceiros?.nome || "terceiro"}
              </span>
              {ultimaRetornada.garantia_ate && (
                emGarantia ? (
                  <Badge variant="outline" className="gap-1 border-success/40 bg-success-muted/40 text-success-foreground">
                    <ShieldCheck className="h-3 w-3" /> Em garantia até {fmtData(ultimaRetornada.garantia_ate)}
                  </Badge>
                ) : (
                  <Badge variant="outline" className="gap-1 text-muted-foreground">
                    <ShieldOff className="h-3 w-3" /> Garantia expirada ({fmtData(ultimaRetornada.garantia_ate)})
                  </Badge>
                )
              )}
            </div>
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1"><Calendar className="h-3 w-3" /> Retornou em {fmtData(ultimaRetornada.data_retorno)}</span>
              {ultimaRetornada.servico_realizado && <span>· serviço: {ultimaRetornada.servico_realizado}</span>}
              <span className="inline-flex items-center gap-1">
                <DollarSign className="h-3 w-3" /> custo R$ {custo.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
              </span>
            </div>
          </div>
        );
      })()}

      <RegistrarRetornoTerceiroDialog open={dialogOpen} onOpenChange={setDialogOpen} terceirizacao={ativa ?? null} />
    </>
  );
}
