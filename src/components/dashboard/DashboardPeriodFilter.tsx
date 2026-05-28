import { useState } from "react";
import { Calendar as CalendarIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  type PeriodPreset,
  type PeriodRange,
  PRESET_LABELS,
  PRESET_GROUPS,
  rangeFromPreset,
} from "./period-presets";

interface Props {
  preset: PeriodPreset;
  range: PeriodRange;
  onChange: (preset: PeriodPreset, range: PeriodRange) => void;
}

export function DashboardPeriodFilter({ preset, range, onChange }: Props) {
  const [calendarOpen, setCalendarOpen] = useState(false);
  const isMobile = useIsMobile();

  function handlePresetClick(p: PeriodPreset) {
    if (p === "personalizado") {
      setCalendarOpen(true);
      return;
    }
    const r = rangeFromPreset(p);
    if (r) onChange(p, r);
  }

  function handleCustomRange(r: { from?: Date; to?: Date } | undefined) {
    if (r?.from && r?.to) {
      onChange("personalizado", { from: r.from, to: r.to });
      setCalendarOpen(false);
    }
  }

  const activeClass = "bg-[#00C896] text-white border-[#00C896] hover:bg-[#00C896]/90 hover:text-white";

  if (isMobile) {
    const presetsFlat = PRESET_GROUPS.flat().filter((p) => p !== "personalizado");
    const isCustom = preset === "personalizado";
    return (
      <div className="flex items-center gap-2 w-full">
        <Select
          value={isCustom ? "" : preset}
          onValueChange={(v) => handlePresetClick(v as PeriodPreset)}
        >
          <SelectTrigger className="h-11 flex-1 text-sm">
            <SelectValue placeholder={isCustom ? `${format(range.from, "dd/MM/yy")} – ${format(range.to, "dd/MM/yy")}` : "Selecionar período"} />
          </SelectTrigger>
          <SelectContent>
            {presetsFlat.map((p) => (
              <SelectItem key={p} value={p}>
                {PRESET_LABELS[p]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
          <PopoverTrigger asChild>
            <Button
              variant={isCustom ? "default" : "outline"}
              size="icon"
              className={cn("h-11 w-11 shrink-0", isCustom && activeClass)}
              aria-label="Período personalizado"
            >
              <CalendarIcon className="h-5 w-5" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="end">
            <Calendar
              mode="range"
              selected={{ from: range.from, to: range.to }}
              onSelect={handleCustomRange}
              numberOfMonths={1}
              initialFocus
              className={cn("p-3 pointer-events-auto")}
            />
          </PopoverContent>
        </Popover>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {PRESET_GROUPS.map((group, gi) => (
        <div key={gi} className="flex flex-wrap items-center gap-1.5">
          {group.map((p) => {
            const isActive = preset === p;
            const isCustom = p === "personalizado";

            if (isCustom) {
              return (
                <Popover key={p} open={calendarOpen} onOpenChange={setCalendarOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant={isActive ? "default" : "outline"}
                      size="sm"
                      className={cn("h-8 text-xs gap-1.5", isActive && activeClass)}
                    >
                      <CalendarIcon className="h-3.5 w-3.5" />
                      {isActive
                        ? `${format(range.from, "dd/MM/yy")} – ${format(range.to, "dd/MM/yy")}`
                        : PRESET_LABELS[p]}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="end">
                    <Calendar
                      mode="range"
                      selected={{ from: range.from, to: range.to }}
                      onSelect={handleCustomRange}
                      numberOfMonths={2}
                      initialFocus
                      className={cn("p-3 pointer-events-auto")}
                    />
                  </PopoverContent>
                </Popover>
              );
            }

            return (
              <Button
                key={p}
                variant={isActive ? "default" : "outline"}
                size="sm"
                className={cn("h-8 text-xs", isActive && activeClass)}
                onClick={() => handlePresetClick(p)}
              >
                {PRESET_LABELS[p]}
              </Button>
            );
          })}
          {gi < PRESET_GROUPS.length - 1 && (
            <span className="hidden sm:block h-5 w-px bg-border mx-1" aria-hidden />
          )}
        </div>
      ))}
    </div>
  );
}
