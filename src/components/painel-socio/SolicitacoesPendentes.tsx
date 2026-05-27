import { useState } from "react";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Clock, Check, X, Loader2 } from "lucide-react";
import {
  useSolicitacoesPendentes,
  useVotarSolicitacao,
  useCancelarSolicitacao,
  type SolicitacaoPendente,
} from "@/hooks/useSocioSolicitacoes";
import { RejeitarSolicitacaoDialog } from "./RejeitarSolicitacaoDialog";

const reaisToBRL = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(v ?? 0));

const fmtData = (iso: string) => {
  if (!iso) return "—";
  const d = new Date(iso.length <= 10 ? iso + "T00:00:00" : iso);
  return d.toLocaleDateString("pt-BR");
};

const fmtMesRef = (iso: string) => {
  if (!iso) return "—";
  const d = new Date(iso.length <= 10 ? iso + "T00:00:00" : iso);
  return `${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
};

const tempoRel = (iso: string) => {
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return "agora";
  if (min < 60) return `${min}min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `há ${h}h`;
  const d = Math.floor(h / 24);
  if (d === 1) return "ontem";
  if (d < 7) return `há ${d}d`;
  return new Date(iso).toLocaleDateString("pt-BR");
};

const TIPO_LABEL: Record<string, string> = {
  credito: "Crédito",
  debito: "Débito",
  pro_labore: "Pró-labore",
  ajuste: "Ajuste",
};

export function SolicitacoesPendentes() {
  const { data, isLoading } = useSolicitacoesPendentes();
  const [rejeitarId, setRejeitarId] = useState<string | null>(null);

  if (isLoading) return null;
  const lista = data?.solicitacoes ?? [];
  if (lista.length === 0) return null;

  return (
    <section className="space-y-3">
      <h2 className="text-xs uppercase tracking-wider text-muted-foreground">
        Solicitações pendentes ({lista.length})
      </h2>
      <div className="space-y-3">
        {lista.map((s) => (
          <SolicitacaoCard key={s.id} solicitacao={s} onRejeitar={() => setRejeitarId(s.id)} />
        ))}
      </div>
      <RejeitarSolicitacaoDialog
        open={!!rejeitarId}
        onOpenChange={(v) => !v && setRejeitarId(null)}
        solicitacaoId={rejeitarId}
      />
    </section>
  );
}

function SolicitacaoCard({
  solicitacao,
  onRejeitar,
}: {
  solicitacao: SolicitacaoPendente;
  onRejeitar: () => void;
}) {
  const votar = useVotarSolicitacao();
  const cancelar = useCancelarSolicitacao();

  const tipoLbl = TIPO_LABEL[solicitacao.tipo] || solicitacao.tipo;

  const handleAprovar = async () => {
    try {
      const r = await votar.mutateAsync({ solicitacao_id: solicitacao.id, voto: "aprovado" });
      if (r.status === "aprovado") toast.success("Solicitação aprovada e lançada no extrato");
      else toast.success("Voto registrado");
    } catch (e: any) {
      toast.error(e?.message || "Erro ao aprovar");
    }
  };

  const handleCancelar = async () => {
    if (!confirm("Cancelar essa solicitação?")) return;
    try {
      await cancelar.mutateAsync(solicitacao.id);
      toast.success("Solicitação cancelada");
    } catch (e: any) {
      toast.error(e?.message || "Erro ao cancelar");
    }
  };

  const pendente = solicitacao.votos_necessarios - solicitacao.votos_atuais;
  const tipoCredito = solicitacao.tipo === "credito" || solicitacao.tipo === "ajuste";

  return (
    <Card className="border-l-4 border-l-amber-500">
      <CardContent className="p-4 space-y-3">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant={tipoCredito ? "secondary" : "outline"} className="text-[10px]">
                {tipoLbl}
              </Badge>
              <span className="text-lg font-bold tabular-nums">{reaisToBRL(solicitacao.valor)}</span>
            </div>
            <div className="text-xs text-muted-foreground">
              Pra: <span className="font-medium text-foreground">{solicitacao.socio_destino_nome}</span>
              {" · "}Referência: <span className="font-medium text-foreground">{fmtMesRef(solicitacao.data_referencia)}</span>
              {" "}({fmtData(solicitacao.data_referencia)})
            </div>
            <div className="text-xs text-muted-foreground">
              Criado por <span className="font-medium text-foreground">{solicitacao.criado_por_nome}</span>
            </div>
          </div>
          <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
            <Clock className="h-3 w-3" />
            {tempoRel(solicitacao.created_at)}
          </div>
        </div>

        <div className="text-sm italic text-muted-foreground border-l-2 border-border pl-3">
          "{solicitacao.descricao}"
        </div>

        <div className="flex items-center gap-3 flex-wrap text-xs">
          <span className="text-muted-foreground">Votos:</span>
          {solicitacao.votos?.map((v) => (
            <span key={v.socio_id} className="inline-flex items-center gap-1">
              <span className={v.voto === "aprovado" ? "text-emerald-600" : "text-rose-600"}>
                {v.voto === "aprovado" ? "🟢" : "🔴"}
              </span>
              {v.nome}
              {v.socio_id === solicitacao.criado_por_socio_id && (
                <span className="text-muted-foreground">(criador)</span>
              )}
            </span>
          ))}
          {pendente > 0 && (
            <span className="text-muted-foreground">
              ⚪ aguardando {pendente} voto{pendente > 1 ? "s" : ""}
            </span>
          )}
        </div>

        <div className="flex items-center justify-between gap-2 pt-1 flex-wrap">
          <div className="flex gap-2">
            {!solicitacao.eu_ja_votei && (
              <>
                <Button size="sm" onClick={handleAprovar} disabled={votar.isPending}>
                  {votar.isPending ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <Check className="h-3 w-3 mr-1" />}
                  Aprovar
                </Button>
                <Button size="sm" variant="outline" onClick={onRejeitar}>
                  <X className="h-3 w-3 mr-1" />
                  Rejeitar
                </Button>
              </>
            )}
            {solicitacao.eu_ja_votei && !solicitacao.eu_criei && (
              <span className="text-xs text-muted-foreground italic">Você já votou</span>
            )}
          </div>
          {solicitacao.eu_criei && (
            <Button size="sm" variant="ghost" onClick={handleCancelar} disabled={cancelar.isPending}>
              {cancelar.isPending && <Loader2 className="h-3 w-3 mr-1 animate-spin" />}
              Cancelar pedido
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
