import { useState } from "react";
import { Calendar as CalendarIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
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
