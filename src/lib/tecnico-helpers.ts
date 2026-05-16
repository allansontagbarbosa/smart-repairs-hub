import { startOfDay, differenceInCalendarDays } from "date-fns";

export type UrgenciaOS = "atrasada" | "vence_hoje" | "aguardando_peca" | "normal";

export function calcularUrgencia(os: {
  status: string;
  previsao_entrega: string | null | undefined;
}): UrgenciaOS {
  if (os.status === "aguardando_peca") return "aguardando_peca";
  if (!os.previsao_entrega) return "normal";

  const previsao = new Date(os.previsao_entrega);
  const hoje = startOfDay(new Date());
  const dias = differenceInCalendarDays(previsao, hoje);

  if (dias < 0) return "atrasada";
  if (dias === 0) return "vence_hoje";
  return "normal";
}

const PRIORIDADE_URGENCIA: Record<UrgenciaOS, number> = {
  atrasada: 0,
  vence_hoje: 1,
  normal: 2,
  aguardando_peca: 3,
};

export function ordenarPorUrgencia<T extends { status: string; previsao_entrega: string | null | undefined }>(
  ordens: T[]
): T[] {
  return [...ordens].sort((a, b) => {
    const ua = calcularUrgencia(a);
    const ub = calcularUrgencia(b);
    return PRIORIDADE_URGENCIA[ua] - PRIORIDADE_URGENCIA[ub];
  });
}

export interface Conquista {
  tipo: "sequencia" | "marco_os" | "podio" | "produtividade";
  label: string;
  icone: string;
  cor: "success" | "info" | "warning";
}

export function calcularConquistas(kpis: {
  qtd_concluidas: number;
  sequencia_dias: number;
  variacao_pct_vs_mes_passado: number | null;
  taxa_retrabalho_pct: number;
}): Conquista[] {
  const conquistas: Conquista[] = [];

  if (kpis.sequencia_dias >= 7) {
    conquistas.push({
      tipo: "sequencia",
      label: `${kpis.sequencia_dias} dias consecutivos`,
      icone: "Flame",
      cor: "success",
    });
  }

  if (kpis.qtd_concluidas >= 100) {
    conquistas.push({
      tipo: "marco_os",
      label: "100+ OS no mês",
      icone: "Trophy",
      cor: "warning",
    });
  } else if (kpis.qtd_concluidas >= 50) {
    conquistas.push({
      tipo: "marco_os",
      label: "50+ OS no mês",
      icone: "Medal",
      cor: "info",
    });
  }

  if (kpis.variacao_pct_vs_mes_passado !== null && kpis.variacao_pct_vs_mes_passado >= 20) {
    conquistas.push({
      tipo: "produtividade",
      label: `+${Math.round(kpis.variacao_pct_vs_mes_passado)}% vs mês passado`,
      icone: "TrendingUp",
      cor: "success",
    });
  }

  if (kpis.taxa_retrabalho_pct === 0 && kpis.qtd_concluidas >= 10) {
    conquistas.push({
      tipo: "produtividade",
      label: "Zero retrabalho",
      icone: "ShieldCheck",
      cor: "info",
    });
  }

  return conquistas;
}

export function formatarTempoMin(min: number): string {
  if (min <= 0) return "—";
  if (min < 60) return `${min}min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m > 0 ? `${h}h ${m}min` : `${h}h`;
}
