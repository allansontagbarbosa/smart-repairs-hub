import { useMemo } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { ArrowLeft, Trash2, Building, User, Store, Check, AlertTriangle, Flame, Clock } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, ReferenceLine, ResponsiveContainer, Tooltip as RTooltip } from "recharts";
import { Button } from "@/components/ui/button";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { useMetas, useExcluirMeta, METRICAS_LABEL, StatusVisual } from "@/hooks/useMetas";
import { formatValorMeta, corStatus } from "@/components/metas/utils";
import { toast } from "sonner";

const ICN = { empresa: Building, tecnico: User, loja: Store };
const LBL = { empresa: "Empresa toda", tecnico: "Técnico", loja: "Loja" };

export default function MetaDetalhe() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const excluir = useExcluirMeta();
  const { data: metas = [] } = useMetas("todas");
  const meta = metas.find(m => m.id === id);

  if (!meta) {
    return (
      <div className="p-6 space-y-3">
        <p className="text-sm text-muted-foreground">Meta não encontrada.</p>
        <Button asChild variant="outline" size="sm">
          <Link to="/metas">Voltar</Link>
        </Button>
      </div>
    );
  }

  const p = meta.progresso;
  const status = (p?.status_visual ?? "cinza") as StatusVisual;
  const cores = corStatus[status];
  const Icon = ICN[meta.escopo];
  const SIcon = status === "verde" ? Check : status === "amarelo" ? AlertTriangle : status === "vermelho" ? Flame : Clock;
  const pct = Math.min(100, Math.max(0, p?.percentual ?? 0));
  const dias = p?.dias_restantes ?? 0;
  const isMenor = meta.sentido === "menor";
  const info = METRICAS_LABEL[meta.metrica];

  const onExcluir = async () => {
    if (!confirm(`Excluir meta "${meta.nome}"?`)) return;
    try {
      await excluir.mutateAsync(meta.id);
      toast.success("Meta excluída");
      navigate("/metas");
    } catch (e: any) {
      toast.error(e.message || "Erro");
    }
  };

  return (
    <div className="space-y-4 p-4 md:p-6 max-w-3xl mx-auto">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <SidebarTrigger />
          <Button variant="ghost" size="icon" onClick={() => navigate("/metas")}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-xl font-semibold">{meta.nome}</h1>
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <Icon className="h-3 w-3" />
              {LBL[meta.escopo]} · {info.label}
            </p>
          </div>
        </div>
        <Button variant="outline" size="icon" onClick={onExcluir}>
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>

      <div className="rounded-lg border border-border bg-card p-5">
        <div className="flex items-center justify-between gap-3">
          <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium ${cores.pillBg} ${cores.pillText}`}>
            <SIcon className="h-3.5 w-3.5" />
            {isMenor ? formatValorMeta(p?.valor_atual ?? 0, meta.metrica) : `${pct.toFixed(0)}%`}
          </div>
          <span className="text-xs text-muted-foreground">{dias} dia{dias !== 1 ? "s" : ""} restantes</span>
        </div>

        <div className="mt-4 flex items-baseline gap-1">
          <span className="text-3xl font-semibold">{formatValorMeta(p?.valor_atual ?? 0, meta.metrica)}</span>
          <span className="text-sm text-muted-foreground">/ {isMenor ? "alvo ≤ " : ""}{formatValorMeta(meta.valor_alvo, meta.metrica)}</span>
        </div>

        <div className="mt-3 h-2 w-full bg-muted rounded-full overflow-hidden">
          <div className={`h-full ${cores.bar} transition-all`} style={{ width: `${pct}%` }} />
        </div>
      </div>

      <div className="rounded-lg border border-border bg-card p-4 space-y-2">
        <h2 className="text-sm font-medium mb-2">Configuração</h2>
        <Linha label="Período" valor={`${new Date(meta.periodo_inicio + "T00:00:00").toLocaleDateString("pt-BR")} → ${new Date(meta.periodo_fim + "T00:00:00").toLocaleDateString("pt-BR")}`} />
        <Linha label="Sentido" valor={meta.sentido === "maior" ? "Quanto maior, melhor" : "Quanto menor, melhor"} />
        <Linha label="Threshold amarelo" valor={`≥ ${meta.threshold_alerta}%`} />
        <Linha label="Threshold cinza" valor={`≥ ${meta.threshold_atencao}%`} />
      </div>
    </div>
  );
}

function Linha({ label, valor }: { label: string; valor: string }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{valor}</span>
    </div>
  );
}
