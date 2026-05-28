import { Home, ClipboardList, DollarSign, Menu, Plus } from "lucide-react";
import { useNavigate, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";

interface Props {
  onNewOS: () => void;
  onMoreClick: () => void;
}

type NavItem =
  | { key: string; label: string; icon: typeof Home; path: string; isMore?: false }
  | { key: string; label: string; icon: typeof Menu; path: null; isMore: true };

export function MobileBottomNav({ onNewOS, onMoreClick }: Props) {
  const navigate = useNavigate();
  const { pathname } = useLocation();

  const isActive = (prefix: string) => pathname.startsWith(prefix);

  const items: (NavItem | null)[] = [
    { key: "home", label: "Início", icon: Home, path: "/dashboard" },
    { key: "os", label: "OS", icon: ClipboardList, path: "/assistencia" },
    null, // espaço pro FAB central
    { key: "fin", label: "Financeiro", icon: DollarSign, path: "/financeiro" },
    { key: "more", label: "Mais", icon: Menu, path: null, isMore: true },
  ];

  return (
    <nav
      className="lg:hidden fixed bottom-0 inset-x-0 z-40 border-t bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <div className="relative flex items-stretch h-16 max-w-md mx-auto px-1">
        {items.map((item, i) => {
          if (item === null) {
            return (
              <div key="fab-slot" className="flex-1 flex items-start justify-center">
                <button
                  type="button"
                  aria-label="Nova OS"
                  onClick={onNewOS}
                  className="-mt-5 h-14 w-14 rounded-full bg-primary text-primary-foreground shadow-lg flex items-center justify-center active:scale-95 transition-transform"
                >
                  <Plus className="h-6 w-6" strokeWidth={2.5} />
                </button>
              </div>
            );
          }
          const Icon = item.icon;
          const active = item.path ? isActive(item.path) : false;
          return (
            <button
              key={item.key}
              type="button"
              onClick={() => (item.path ? navigate(item.path) : onMoreClick())}
              className={cn(
                "flex-1 flex flex-col items-center justify-center gap-0.5 py-2 transition-colors",
                active ? "text-primary" : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Icon className="h-5 w-5" />
              <span className={cn("text-[10px] font-medium leading-none", active && "font-semibold")}>
                {item.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
