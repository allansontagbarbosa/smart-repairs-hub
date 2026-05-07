import { Link } from "react-router-dom";
import { Building, User, Store, Check, AlertTriangle, Flame } from "lucide-react";
import { Meta, StatusVisual } from "@/hooks/useMetas";
import { formatValorMeta, corStatus } from "./utils";

const ICN = { empresa: Building, tecnico: User, loja: Store };
const LBL = { empresa: "Empresa toda", tecnico: "Por técnico", loja: "Por loja" };

interface Props { meta: Meta; escopoNome?: string; }

export function MetaCard({ meta, escopoNome }: Props) {
  const p = meta.progresso;
  const status = (p?.status_visual ?? "cinza") as StatusVisual;
  const cores = corStatus[status];
  const Icon = ICN[meta.escopo];
  const SIcon = status === "verde" ? Check : status === "amarelo" ? AlertTriangle : status === "vermelho" ? Flame : null;
  const pct = Math.min(100, Math.max(0, p?.percentual ?? 0));
  const fimDate = new Date(meta.periodo_fim + "T23:59:59");
  const dias = p?.dias_restantes ?? 0;
  const isMenor = meta.sentido === "menor";

  let ritmoLabel = "";
  if (status !== "vermelho" && dias > 0 && !isMenor) {
    const falta = Math.max(0, meta.valor_alvo - p.valor_atual);
    if (falta > 0) ritmoLabel = `precisa ${formatValorMeta(falta / dias, meta.metrica)}/dia`;
  }
  const faltaLabel = isMenor
    ? (p.valor_atual > meta.valor_alvo ? `${formatValorMeta(p.valor_atual - meta.valor_alvo, meta.metrica)} acima` : "no alvo")
    : `Faltam ${formatValorMeta(Math.max(0, meta.valor_alvo - p.valor_atual), meta.metrica)}`;
  const borda = status === "verde" ? "border-primary/40 border-[1.5px]" : status === "vermelho" ? "border-red-300" : "border-border";
  const corNum = status === "verde" ? "text-primary" : status === "vermelho" ? "text-red-700" : "";

  return (
    <Link
      to={`/metas/${meta.id}`}
      className={`block rounded-lg border ${borda} bg-card p-4 hover:shadow-sm transition-shadow`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="font-medium text-sm truncate">{meta.nome}</div>
          <div className="flex items-center gap-1 text-[11px] text-muted-foreground mt-0.5">
            <Icon className="h-3 w-3" />
            <span className="truncate">
              {LBL[meta.escopo]}{escopoNome ? ` · ${escopoNome}` : ""} · até {fimDate.toLocaleDateString("pt-BR")}
            </span>
          </div>
        </div>
        <div className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${cores.pillBg} ${cores.pillText}`}>
          {SIcon && <SIcon className="h-3 w-3" />}
          {isMenor ? formatValorMeta(p.valor_atual, meta.metrica) : `${pct.toFixed(0)}%`}
        </div>
      </div>

      <div className="mt-3 flex items-baseline gap-1">
        <span className={`text-xl font-semibold ${corNum}`}>{formatValorMeta(p?.valor_atual ?? 0, meta.metrica)}</span>
        <span className="text-xs text-muted-foreground">/ {isMenor ? "alvo ≤ " : ""}{formatValorMeta(meta.valor_alvo, meta.metrica)}</span>
      </div>

      <div className="mt-2 h-1.5 w-full bg-muted rounded-full overflow-hidden">
        <div className={`h-full ${cores.bar} transition-all`} style={{ width: `${pct}%` }} />
      </div>

      <div className="mt-2 flex items-center justify-between text-[11px] text-muted-foreground">
        <span>{faltaLabel} · {dias} dia{dias !== 1 ? "s" : ""}</span>
        {ritmoLabel && <span>{ritmoLabel}</span>}
      </div>
    </Link>
  );
}
