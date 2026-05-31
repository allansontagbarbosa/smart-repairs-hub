import { useWorkspaceMode, type WorkspaceMode } from "@/contexts/WorkspaceModeContext";
import { Wrench, Store, Building2, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

const MODES: { id: WorkspaceMode; label: string; icon: LucideIcon; shortcut: string }[] = [
  { id: "assistencia", label: "Assist", icon: Wrench, shortcut: "1" },
  { id: "loja", label: "Loja", icon: Store, shortcut: "2" },
  { id: "atacado", label: "Atacado", icon: Building2, shortcut: "3" },
];

export function WorkspaceSwitcher({ collapsed }: { collapsed?: boolean }) {
  const { mode, setMode, availableModes } = useWorkspaceMode();

  if (availableModes.length < 2) return null;
  const visible = MODES.filter((m) => availableModes.includes(m.id));

  if (collapsed) {
    return (
      <div className="px-1.5 pb-2 flex flex-col gap-1">
        {visible.map((m) => {
          const Icon = m.icon;
          const active = mode === m.id;
          return (
            <button
              key={m.id}
              type="button"
              onClick={() => setMode(m.id)}
              title={`${m.label} (${m.shortcut})`}
              className={cn(
                "w-full flex items-center justify-center h-9 rounded-md transition-all",
                active
                  ? "bg-primary text-primary-foreground shadow-sm scale-[1.03]"
                  : "text-sidebar-foreground/60 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground"
              )}
            >
              <Icon className="h-4 w-4" />
            </button>
          );
        })}
      </div>
    );
  }

  return (
    <div className="px-3 pb-3">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1.5 px-0.5">
        Módulo ativo
      </div>
      <div className="flex items-center gap-1 p-1 rounded-lg bg-sidebar-accent/30 border border-sidebar-border">
        {visible.map((m) => {
          const Icon = m.icon;
          const active = mode === m.id;
          return (
            <button
              key={m.id}
              type="button"
              onClick={() => setMode(m.id)}
              title={`${m.label} (atalho: ${m.shortcut})`}
              className={cn(
                "flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-md text-xs font-semibold transition-all",
                active
                  ? "bg-primary text-primary-foreground shadow-sm scale-[1.02]"
                  : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground"
              )}
            >
              <Icon className="h-3.5 w-3.5" />
              {m.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
