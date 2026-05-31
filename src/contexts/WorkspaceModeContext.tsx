import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useModulos } from "@/hooks/useModulos";

export type WorkspaceMode = "assistencia" | "loja" | "atacado";

interface WorkspaceModeContextValue {
  mode: WorkspaceMode;
  setMode: (m: WorkspaceMode) => void;
  availableModes: WorkspaceMode[];
}

const Ctx = createContext<WorkspaceModeContextValue | null>(null);
const STORAGE_KEY = "ditt-workspace-mode";

function readStored(): WorkspaceMode | null {
  if (typeof window === "undefined") return null;
  const s = localStorage.getItem(STORAGE_KEY);
  return s === "assistencia" || s === "loja" || s === "atacado" ? s : null;
}

export function WorkspaceModeProvider({ children }: { children: ReactNode }) {
  const { assistenciaAtivo, lojaAtivo, atacadoAtivo } = useModulos();
  const location = useLocation();
  const navigate = useNavigate();

  const availableModes: WorkspaceMode[] = [];
  if (assistenciaAtivo) availableModes.push("assistencia");
  if (lojaAtivo) availableModes.push("loja");
  if (atacadoAtivo) availableModes.push("atacado");

  const [mode, setModeState] = useState<WorkspaceMode>(() => readStored() ?? "assistencia");

  // Smart default based on URL
  useEffect(() => {
    const p = location.pathname;
    if (p.startsWith("/loja")) setModeState("loja");
    else if (p.startsWith("/atacado")) setModeState("atacado");
    else if (p.startsWith("/assistencia") || p === "/dashboard") setModeState("assistencia");
  }, [location.pathname]);

  // Auto-correct if stored mode isn't available
  useEffect(() => {
    if (availableModes.length > 0 && !availableModes.includes(mode)) {
      setModeState(availableModes[0]);
    }
  }, [availableModes, mode]);

  const setMode = (m: WorkspaceMode) => {
    setModeState(m);
    try {
      localStorage.setItem(STORAGE_KEY, m);
    } catch {}

    const cur = window.location.pathname;
    if (m === "assistencia" && !cur.startsWith("/assistencia") && cur !== "/dashboard") {
      navigate("/dashboard");
    } else if (m === "loja" && !cur.startsWith("/loja")) {
      navigate("/loja/dashboard");
    } else if (m === "atacado" && !cur.startsWith("/atacado")) {
      navigate("/atacado/dashboard");
    }
  };

  // Keyboard shortcuts 1 / 2 / 3 (outside inputs)
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;
      const t = e.target as HTMLElement | null;
      const tag = t?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || t?.isContentEditable) return;
      if (e.key === "1" && availableModes.includes("assistencia")) {
        e.preventDefault();
        setMode("assistencia");
      } else if (e.key === "2" && availableModes.includes("loja")) {
        e.preventDefault();
        setMode("loja");
      } else if (e.key === "3" && availableModes.includes("atacado")) {
        e.preventDefault();
        setMode("atacado");
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [availableModes.join(",")]);

  return (
    <Ctx.Provider value={{ mode, setMode, availableModes }}>{children}</Ctx.Provider>
  );
}

export function useWorkspaceMode() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useWorkspaceMode must be used within WorkspaceModeProvider");
  return ctx;
}
