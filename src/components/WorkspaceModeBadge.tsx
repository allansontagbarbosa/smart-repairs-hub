import { useWorkspaceMode } from "@/contexts/WorkspaceModeContext";
import { Wrench, Store, Building2 } from "lucide-react";
import { cn } from "@/lib/utils";

export function WorkspaceModeBadge({ className }: { className?: string }) {
  const { mode, availableModes } = useWorkspaceMode();
  if (availableModes.length < 2) return null;

  const configs = {
    assistencia: { label: "Assistência", icon: Wrench, cls: "bg-blue-500/10 text-blue-600 border-blue-500/30 dark:text-blue-400" },
    loja: { label: "Loja", icon: Store, cls: "bg-primary/10 text-primary border-primary/30" },
    atacado: { label: "Atacado", icon: Building2, cls: "bg-amber-500/10 text-amber-600 border-amber-500/30 dark:text-amber-400" },
  } as const;
  const config = configs[mode] ?? configs.assistencia;

  const Icon = config.icon;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full border text-[10px] font-semibold uppercase tracking-wider",
        config.cls,
        className
      )}
    >
      <Icon className="h-3 w-3" />
      {config.label}
    </span>
  );
}
