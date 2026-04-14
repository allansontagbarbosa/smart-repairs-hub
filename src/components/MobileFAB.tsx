import { useState } from "react";
import { Plus, ClipboardList, User, Package, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface Props {
  onNewOS: () => void;
  onNewClient: () => void;
  onNewEntrada: () => void;
}

export function MobileFAB({ onNewOS, onNewClient, onNewEntrada }: Props) {
  const [expanded, setExpanded] = useState(false);

  const actions = [
    { icon: ClipboardList, label: "Nova OS", action: onNewOS },
    { icon: User, label: "Novo Cliente", action: onNewClient },
    { icon: Package, label: "Entrada Peças", action: onNewEntrada },
  ];

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col-reverse items-end gap-3 sm:hidden">
      {/* Sub-buttons */}
      {actions.map((a, i) => (
        <div
          key={a.label}
          className={cn(
            "flex items-center gap-2 transition-all duration-200",
            expanded
              ? "opacity-100 translate-y-0"
              : "opacity-0 translate-y-4 pointer-events-none"
          )}
          style={{ transitionDelay: expanded ? `${i * 50}ms` : "0ms" }}
        >
          <span className="rounded-md bg-popover px-2 py-1 text-xs shadow-md border text-foreground">
            {a.label}
          </span>
          <Button
            size="icon"
            className="h-11 w-11 rounded-full shadow-lg"
            variant="secondary"
            onClick={() => {
              setExpanded(false);
              a.action();
            }}
          >
            <a.icon className="h-4 w-4" />
          </Button>
        </div>
      ))}

      {/* Main FAB */}
      <Button
        size="icon"
        className="h-14 w-14 rounded-full shadow-xl"
        onClick={() => setExpanded((p) => !p)}
      >
        {expanded ? <X className="h-5 w-5" /> : <Plus className="h-6 w-6" />}
      </Button>
    </div>
  );
}
