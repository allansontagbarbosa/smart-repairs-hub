import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface BulkAction {
  id: string;
  label: string;
  icon?: React.ReactNode;
  variant?: "default" | "destructive" | "outline" | "secondary" | "ghost";
  onClick: () => void;
  disabled?: boolean;
}

interface BulkActionBarProps {
  count: number;
  onClear: () => void;
  actions: BulkAction[];
  entityLabel?: string;
}

export function BulkActionBar({
  count,
  onClear,
  actions,
  entityLabel = "itens",
}: BulkActionBarProps) {
  if (count === 0) return null;

  return (
    <div
      className={cn(
        "sticky top-2 z-20 flex flex-wrap items-center gap-2 rounded-lg border bg-card/95 backdrop-blur",
        "px-3 py-2 shadow-sm animate-in fade-in slide-in-from-top-2",
      )}
    >
      <Button
        variant="ghost"
        size="icon"
        className="h-7 w-7 shrink-0"
        onClick={onClear}
        aria-label="Limpar seleção"
      >
        <X className="h-4 w-4" />
      </Button>
      <span className="text-sm font-medium">
        {count} {entityLabel} selecionad{count === 1 ? "o" : "os"}
      </span>
      <div className="ml-auto flex flex-wrap items-center gap-1.5">
        {actions.map(a => (
          <Button
            key={a.id}
            variant={a.variant ?? "outline"}
            size="sm"
            className="h-8 gap-1.5"
            disabled={a.disabled}
            onClick={a.onClick}
          >
            {a.icon}
            {a.label}
          </Button>
        ))}
      </div>
    </div>
  );
}
