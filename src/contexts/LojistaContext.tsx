import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./AuthContext";

export interface Loja {
  id: string;
  nome: string;
  razao_social?: string | null;
  cnpj?: string | null;
  email?: string | null;
  telefone?: string | null;
  ativo?: boolean;
}

type Tipo = "grupo" | "individual" | "nao_lojista" | "anonimo" | "loading";

interface LojistaContextValue {
  tipo: Tipo;
  grupoId?: string;
  grupoNome?: string;
  empresaId?: string;
  lojistaId?: string;
  lojistaNome?: string;
  lojas: Loja[];
  lojaAtivaId: string | null;
  setLojaAtivaId: (id: string | null) => void;
  lojaAtiva: Loja | null;
  ehGrupo: boolean;
  modoConsolidado: boolean;
  isLoading: boolean;
}

const Ctx = createContext<LojistaContextValue | null>(null);

const STORAGE_KEY = "lojista-loja-ativa";

export function LojistaProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();

  const [lojaAtivaId, setLojaAtivaIdState] = useState<string | null>(() => {
    try { return localStorage.getItem(STORAGE_KEY) || null; } catch { return null; }
  });

  const setLojaAtivaId = (id: string | null) => {
    setLojaAtivaIdState(id);
    try {
      if (id) localStorage.setItem(STORAGE_KEY, id);
      else localStorage.removeItem(STORAGE_KEY);
    } catch { /* ignore */ }
  };

  const { data, isLoading } = useQuery({
    queryKey: ["lojista-contexto", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_lojista_contexto" as any);
      if (error) throw error;
      return data as any;
    },
    enabled: !!user?.id,
    staleTime: 5 * 60 * 1000,
  });

  // Para lojista individual: força lojaAtivaId pra única loja.
  // Para grupo: se id salvo não está mais nas lojas, reseta pra "todas".
  useEffect(() => {
    if (!data) return;
    const lojas: Loja[] = data.lojas || [];
    if (data.tipo === "individual" && lojas[0]) {
      setLojaAtivaIdState(lojas[0].id);
    } else if (data.tipo === "grupo") {
      if (lojaAtivaId && !lojas.some(l => l.id === lojaAtivaId)) {
        setLojaAtivaId(null);
      }
      // Marca o grupo como ativo na primeira vez que o usuário acessa
      supabase.rpc("marcar_grupo_aceito" as any).then(() => {}, () => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);

  const lojas: Loja[] = data?.lojas || [];
  const tipo: Tipo = isLoading ? "loading" : (data?.tipo || "anonimo");
  const ehGrupo = tipo === "grupo";
  const modoConsolidado = ehGrupo && lojaAtivaId === null;
  const lojaAtiva = lojas.find(l => l.id === lojaAtivaId) || null;

  return (
    <Ctx.Provider value={{
      tipo,
      grupoId: data?.grupo_id,
      grupoNome: data?.grupo_nome,
      empresaId: data?.empresa_id,
      lojistaId: data?.lojista_id,
      lojistaNome: data?.lojista_nome,
      lojas,
      lojaAtivaId,
      setLojaAtivaId,
      lojaAtiva,
      ehGrupo,
      modoConsolidado,
      isLoading,
    }}>
      {children}
    </Ctx.Provider>
  );
}

export function useLojistaContext() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useLojistaContext fora do LojistaProvider");
  return ctx;
}

/**
 * Helper para queries que filtram por loja.
 * - Lojista individual: array com 1 id
 * - Grupo + "Todas": array com todos ids do grupo (modoConsolidado=true)
 * - Grupo + loja selecionada: array com 1 id
 */
export function useLojaFilter() {
  const { modoConsolidado, lojas, lojaAtivaId, tipo } = useLojistaContext();

  if (tipo === "loading" || tipo === "anonimo" || tipo === "nao_lojista") {
    return { lojaIds: [] as string[], modoConsolidado: false, pronto: false };
  }

  if (tipo === "grupo") {
    if (modoConsolidado) {
      return { lojaIds: lojas.map(l => l.id), modoConsolidado: true, pronto: lojas.length > 0 };
    }
    return { lojaIds: lojaAtivaId ? [lojaAtivaId] : [], modoConsolidado: false, pronto: !!lojaAtivaId };
  }

  // individual
  return { lojaIds: lojaAtivaId ? [lojaAtivaId] : [], modoConsolidado: false, pronto: !!lojaAtivaId };
}
