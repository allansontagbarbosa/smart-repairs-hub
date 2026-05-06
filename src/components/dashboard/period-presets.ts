import {
  startOfDay, endOfDay,
  startOfWeek, endOfWeek,
  startOfMonth, endOfMonth,
  startOfQuarter, endOfQuarter,
  startOfYear, endOfYear,
  subDays, subMonths,
} from "date-fns";

export type PeriodPreset =
  | "hoje"
  | "ontem"
  | "esta_semana"
  | "ultimos_7"
  | "ultimos_30"
  | "este_mes"
  | "mes_passado"
  | "este_trimestre"
  | "este_ano"
  | "personalizado";

export interface PeriodRange {
  from: Date;
  to: Date;
}

const WEEK_STARTS_ON = 0 as const;

export function rangeFromPreset(preset: PeriodPreset, ref: Date = new Date()): PeriodRange | null {
  switch (preset) {
    case "hoje":
      return { from: startOfDay(ref), to: endOfDay(ref) };
    case "ontem": {
      const y = subDays(ref, 1);
      return { from: startOfDay(y), to: endOfDay(y) };
    }
    case "esta_semana":
      return {
        from: startOfWeek(ref, { weekStartsOn: WEEK_STARTS_ON }),
        to: endOfWeek(ref, { weekStartsOn: WEEK_STARTS_ON }),
      };
    case "ultimos_7":
      return { from: startOfDay(subDays(ref, 6)), to: endOfDay(ref) };
    case "ultimos_30":
      return { from: startOfDay(subDays(ref, 29)), to: endOfDay(ref) };
    case "este_mes":
      return { from: startOfMonth(ref), to: endOfMonth(ref) };
    case "mes_passado": {
      const m = subMonths(ref, 1);
      return { from: startOfMonth(m), to: endOfMonth(m) };
    }
    case "este_trimestre":
      return { from: startOfQuarter(ref), to: endOfQuarter(ref) };
    case "este_ano":
      return { from: startOfYear(ref), to: endOfYear(ref) };
    case "personalizado":
      return null;
  }
}

export const PRESET_LABELS: Record<PeriodPreset, string> = {
  hoje: "Hoje",
  ontem: "Ontem",
  esta_semana: "Esta semana",
  ultimos_7: "Últimos 7 dias",
  ultimos_30: "Últimos 30 dias",
  este_mes: "Este mês",
  mes_passado: "Mês passado",
  este_trimestre: "Este trimestre",
  este_ano: "Este ano",
  personalizado: "Personalizado",
};

export const PRESET_GROUPS: PeriodPreset[][] = [
  ["hoje", "ontem", "esta_semana"],
  ["ultimos_7", "ultimos_30"],
  ["este_mes", "mes_passado", "este_trimestre", "este_ano"],
  ["personalizado"],
];
