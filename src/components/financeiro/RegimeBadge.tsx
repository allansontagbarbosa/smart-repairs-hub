import { Calendar, Wallet, FileSpreadsheet, type LucideIcon } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

export type RegimeContabil = "competencia_os" | "caixa" | "competencia_mensal";

interface RegimeConfig {
  label: string;
  icon: LucideIcon;
  description: string;
  colorClass: string;
}

const REGIME_CONFIG: Record<RegimeContabil, RegimeConfig> = {
  competencia_os: {
    label: "Competência da OS",
    icon: Calendar,
    description:
      "Valor pertence ao mês em que a OS foi CONCLUÍDA (data_conclusao). OSs em andamento não entram. Mesmo que o cliente pague depois, a receita conta no mês da conclusão.",
    colorClass: "text-blue-500",
  },
  caixa: {
    label: "Regime de caixa",
    icon: Wallet,
    description:
      "Valor pertence ao dia em que o dinheiro efetivamente entrou ou saiu. Se a despesa foi LANÇADA em maio mas PAGA em junho, conta no caixa de junho.",
    colorClass: "text-emerald-500",
  },
  competencia_mensal: {
    label: "Competência mensal",
    icon: FileSpreadsheet,
    description:
      "Valor pertence ao mês de competência declarado na conta (mes_competencia), independente de quando foi paga. Usado pra fechar DRE mensal mesmo com pagamentos atrasados.",
    colorClass: "text-amber-500",
  },
};

interface Props {
  regime: RegimeContabil;
  size?: number;
}

export function RegimeBadge({ regime, size = 12 }: Props) {
  const cfg = REGIME_CONFIG[regime];
  const Icon = cfg.icon;
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            aria-label={cfg.label}
            className="inline-flex items-center cursor-help focus:outline-none focus-visible:ring-1 focus-visible:ring-ring rounded"
          >
            <Icon className={cfg.colorClass} style={{ width: size, height: size }} />
          </button>
        </TooltipTrigger>
        <TooltipContent className="max-w-xs">
          <p className="text-xs font-semibold mb-1">{cfg.label}</p>
          <p className="text-xs text-muted-foreground">{cfg.description}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

export function getRegimeLabel(regime: RegimeContabil): string {
  return REGIME_CONFIG[regime].label;
}
