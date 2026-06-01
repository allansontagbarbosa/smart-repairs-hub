import { useState, useMemo } from "react";
import { useAparelhosNaRua, useGarantiasTerceiroVigentes } from "@/hooks/useTerceirizacao";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Truck, AlertTriangle, Calendar, DollarSign, ArrowLeftRight, ExternalLink, Loader2, ShieldCheck } from "lucide-react";
import { OrdemDetalheSheet } from "@/components/OrdemDetalheSheet";
import { RegistrarRetornoTerceiroDialog } from "@/components/assistencia/RegistrarRetornoTerceiroDialog";
import { cn } from "@/lib/utils";

export default function AparelhosNaRua() {
  const { data: lista = [], isLoading } = useAparelhosNaRua();
  const { data: garantias = [] } = useGarantiasTerceiroVigentes();
  const [osAbertaId, setOsAbertaId] = useState<string | null>(null);
  const [retornoAlvo, setRetornoAlvo] = useState<null | {
    id: string; os_id: string; custo: number; servico: string | null; terceiro_nome: string | null;
  }>(null);

  const atrasados = useMemo(() => lista.filter(l => l.atrasado).length, [lista]);

  return (
    <div className="container mx-auto p-6 max-w-5xl">
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Truck className="h-6 w-6 text-[hsl(270_70%_50%)]" />
            Aparelhos na rua
          </h1>
          <p className="text-sm text-muted-foreground">Aparelhos enviados a terceiros e ainda fora da oficina.</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="gap-1">
            <Truck className="h-3 w-3" /> {lista.length} na rua
          </Badge>
          {atrasados > 0 && (
            <Badge variant="destructive" className="gap-1">
              <AlertTriangle className="h-3 w-3" /> {atrasados} atrasado{atrasados > 1 ? "s" : ""}
            </Badge>
          )}
        </div>
      </div>

      <Card>
        {isLoading ? (
          <div className="p-12 text-center"><Loader2 className="h-5 w-5 animate-spin mx-auto" /></div>
        ) : lista.length === 0 ? (
          <div className="p-12 text-center text-muted-foreground">
            <Truck className="h-12 w-12 mx-auto mb-3 opacity-30" />
            <p>Nenhum aparelho na rua agora.</p>
          </div>
        ) : (
          <div className="divide-y">
            {lista.map(item => {
              const envio = new Date(item.data_envio + "T00:00:00").toLocaleDateString("pt-BR");
              const prev = item.previsao_retorno ? new Date(item.previsao_retorno + "T00:00:00").toLocaleDateString("pt-BR") : null;
              return (
                <div
                  key={item.terceirizacao_id}
                  className={cn(
                    "p-4 hover:bg-muted/40 transition-colors",
                    item.atrasado && "bg-destructive/5 hover:bg-destructive/10",
                  )}
                >
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold">{item.terceiro_nome || "Terceiro"}</span>
                        {item.atrasado && (
                          <Badge variant="destructive" className="gap-1 text-xs">
                            <AlertTriangle className="h-3 w-3" /> Atrasado
                          </Badge>
                        )}
                        <Badge variant="outline" className="text-xs">{item.dias_fora}d fora</Badge>
                      </div>
                      {item.servico && <div className="text-sm text-muted-foreground mt-1">{item.servico}</div>}
                      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground mt-2">
                        <span className="inline-flex items-center gap-1"><Calendar className="h-3 w-3" /> Enviado: {envio}</span>
                        {prev && <span className={cn("inline-flex items-center gap-1", item.atrasado && "text-destructive font-medium")}>
                          <Calendar className="h-3 w-3" /> Previsão: {prev}
                        </span>}
                        <span className="inline-flex items-center gap-1"><DollarSign className="h-3 w-3" /> R$ {Number(item.custo).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" onClick={() => setOsAbertaId(item.os_id)}>
                        <ExternalLink className="h-3.5 w-3.5 mr-1" /> Abrir OS
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => setRetornoAlvo({
                          id: item.terceirizacao_id,
                          os_id: item.os_id,
                          custo: Number(item.custo) || 0,
                          servico: item.servico,
                          terceiro_nome: item.terceiro_nome,
                        })}
                      >
                        <ArrowLeftRight className="h-3.5 w-3.5 mr-1" /> Registrar retorno
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      <div className="mt-8">
        <div className="flex items-center gap-2 mb-3">
          <ShieldCheck className="h-5 w-5 text-success" />
          <h2 className="text-lg font-semibold">Garantias de terceiro vigentes</h2>
          <Badge variant="secondary">{garantias.length}</Badge>
        </div>
        <Card>
          {garantias.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted-foreground">
              Nenhuma garantia de terceiro vigente.
            </div>
          ) : (
            <div className="divide-y">
              {garantias.map(g => (
                <div key={g.terceirizacao_id} className="p-3 flex items-center justify-between gap-3 flex-wrap hover:bg-muted/40">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium">{g.terceiro_nome || "Terceiro"}</span>
                      <Badge variant="outline" className="text-xs gap-1 border-success/40 text-success-foreground bg-success-muted/40">
                        <ShieldCheck className="h-3 w-3" /> {g.dias_restantes}d restantes
                      </Badge>
                    </div>
                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground mt-1">
                      {g.servico_realizado && <span>{g.servico_realizado}</span>}
                      <span>Retornou: {new Date(g.data_retorno + "T00:00:00").toLocaleDateString("pt-BR")}</span>
                      <span>Válida até: {new Date(g.garantia_ate + "T00:00:00").toLocaleDateString("pt-BR")}</span>
                      {g.custo_final != null && (
                        <span className="inline-flex items-center gap-1">
                          <DollarSign className="h-3 w-3" /> R$ {Number(g.custo_final).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                        </span>
                      )}
                    </div>
                  </div>
                  <Button size="sm" variant="outline" onClick={() => setOsAbertaId(g.os_id)}>
                    <ExternalLink className="h-3.5 w-3.5 mr-1" /> Abrir OS
                  </Button>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      <OrdemDetalheSheet orderId={osAbertaId} onClose={() => setOsAbertaId(null)} />
      <RegistrarRetornoTerceiroDialog
        open={!!retornoAlvo}
        onOpenChange={(o) => !o && setRetornoAlvo(null)}
        terceirizacao={retornoAlvo}
      />
    </div>
  );
}
