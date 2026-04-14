import { useEffect } from "react";
import { useNavigate } from "react-router-dom";

interface ShortcutHandlers {
  onNewOS?: () => void;
  onNewClient?: () => void;
  onGlobalSearch?: () => void;
  onPrint?: () => void;
}

const NAV_MAP: Record<string, string> = {
  "1": "/",
  "2": "/assistencia",
  "3": "/financeiro",
  "4": "/pecas",
  "5": "/clientes",
  "6": "/relatorios",
  "7": "/configuracoes",
};

export function useKeyboardShortcuts(handlers: ShortcutHandlers) {
  const navigate = useNavigate();

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement)?.tagName?.toLowerCase();
      const isEditable =
        tag === "input" || tag === "textarea" || tag === "select" ||
        (e.target as HTMLElement)?.isContentEditable;

      // Ctrl+K — always intercept
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        handlers.onGlobalSearch?.();
        return;
      }

      // Ctrl+P — print
      if ((e.ctrlKey || e.metaKey) && e.key === "p") {
        e.preventDefault();
        handlers.onPrint?.();
        return;
      }

      // Alt+number — navigation
      if (e.altKey && NAV_MAP[e.key]) {
        e.preventDefault();
        navigate(NAV_MAP[e.key]);
        return;
      }

      // Skip single-key shortcuts when in editable fields
      if (isEditable) return;

      switch (e.key.toLowerCase()) {
        case "n":
          e.preventDefault();
          handlers.onNewOS?.();
          break;
        case "c":
          e.preventDefault();
          handlers.onNewClient?.();
          break;
        case "f":
          e.preventDefault();
          // Focus the first search input on the page
          const searchInput = document.querySelector<HTMLInputElement>(
            'input[type="search"], input[placeholder*="Buscar"], input[placeholder*="buscar"], input[placeholder*="Pesquisar"]'
          );
          searchInput?.focus();
          break;
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [handlers, navigate]);
}
