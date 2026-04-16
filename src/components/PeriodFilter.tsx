import { useState, useMemo } from "react";
import { format, startOfMonth, endOfMonth, subDays, subMonths } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CalendarIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

export type PeriodPreset = "este_mes" | "30_dias" | "trimestre" | "personalizado";

export interface PeriodRange {
  start: Date;
  end: Date;
  preset: PeriodPreset;
}

const presets: { value: PeriodPreset; label: string }[] = [
  { value: "este_mes", label: "Este mês" },
  { value: "30_dias", label: "Últimos 30 dias" },
  { value: "trimestre", label: "Último trimestre" },
  { value: "personalizado", label: "Personalizado" },
];

function getRange(preset: PeriodPreset): { start: Date; end: Date } {
  const now = new Date();
  switch (preset) {
    case "este_mes":
      return { start: startOfMonth(now), end: endOfMonth(now) };
    case "30_dias":
      return { start: subDays(now, 30), end: now };
    case "trimestre":
      return { start: subMonths(now, 3), end: now };
    default:
      return { start: startOfMonth(now), end: endOfMonth(now) };
  }
}

export function usePeriodFilter(defaultPreset: PeriodPreset = "este_mes") {
  const [preset, setPreset] = useState<PeriodPreset>(defaultPreset);
  const [customStart, setCustomStart] = useState<Date>(startOfMonth(new Date()));
  const [customEnd, setCustomEnd] = useState<Date>(endOfMonth(new Date()));

  const range = useMemo<PeriodRange>(() => {
    if (preset === "personalizado") {
      return { start: customStart, end: customEnd, preset };
    }
    return { ...getRange(preset), preset };
  }, [preset, customStart, customEnd]);

  return { range, preset, setPreset, customStart, setCustomStart, customEnd, setCustomEnd };
}

export function PeriodFilter({
  preset,
  onPresetChange,
  customStart,
  customEnd,
  onCustomStartChange,
  onCustomEndChange,
}: {
  preset: PeriodPreset;
  onPresetChange: (p: PeriodPreset) => void;
  customStart?: Date;
  customEnd?: Date;
  onCustomStartChange?: (d: Date) => void;
  onCustomEndChange?: (d: Date) => void;
}) {
  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      {presets.map((p) => (
        <button
          key={p.value}
          onClick={() => onPresetChange(p.value)}
          className={cn(
            "shrink-0 rounded-full px-3 py-1 text-xs font-medium transition-colors border",
            preset === p.value
              ? "bg-primary text-primary-foreground border-primary"
              : "bg-card text-muted-foreground border-border hover:bg-muted"
          )}
        >
          {p.label}
        </button>
      ))}

      {preset === "personalizado" && (
        <div className="flex items-center gap-1.5">
          <DatePickerMini value={customStart} onChange={onCustomStartChange} placeholder="Início" />
          <span className="text-xs text-muted-foreground">até</span>
          <DatePickerMini value={customEnd} onChange={onCustomEndChange} placeholder="Fim" />
        </div>
      )}
    </div>
  );
}

function DatePickerMini({
  value,
  onChange,
  placeholder,
}: {
  value?: Date;
  onChange?: (d: Date) => void;
  placeholder: string;
}) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={cn(
            "h-7 px-2 text-xs font-normal",
            !value && "text-muted-foreground"
          )}
        >
          <CalendarIcon className="mr-1 h-3 w-3" />
          {value ? format(value, "dd/MM/yy", { locale: ptBR }) : placeholder}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={value}
          onSelect={(d) => d && onChange?.(d)}
          initialFocus
          className={cn("p-3 pointer-events-auto")}
        />
      </PopoverContent>
    </Popover>
  );
}
