import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

interface PermissaoModulo {
  ver: boolean;
  criar: boolean;
  editar: boolean;
  excluir: boolean;
}

export interface Permissoes {
  dashboard: boolean;
  assistencia: PermissaoModulo;
  financeiro: PermissaoModulo;
  pecas: PermissaoModulo;
  clientes: PermissaoModulo;
  relatorios: boolean;
  configuracoes: boolean;
  fila_ia: boolean;
}

const ADMIN_PERMISSOES: Permissoes = {
  dashboard: true,
  assistencia: { ver: true, criar: true, editar: true, excluir: true },
  financeiro: { ver: true, criar: true, editar: true, excluir: true },
  pecas: { ver: true, criar: true, editar: true, excluir: true },
  clientes: { ver: true, criar: true, editar: true, excluir: true },
  relatorios: true,
  configuracoes: true,
  fila_ia: true,
};

const EMPTY_MODULO: PermissaoModulo = { ver: false, criar: false, editar: false, excluir: false };

const DEFAULT_PERMISSOES: Permissoes = {
  dashboard: false,
  assistencia: EMPTY_MODULO,
  financeiro: EMPTY_MODULO,
  pecas: EMPTY_MODULO,
  clientes: EMPTY_MODULO,
  relatorios: false,
  configuracoes: false,
  fila_ia: false,
};

function parsePermissoes(raw: any): Permissoes {
  if (!raw || typeof raw !== "object") return DEFAULT_PERMISSOES;
  const ensureModulo = (m: any): PermissaoModulo => {
    if (typeof m === "boolean") return { ver: m, criar: m, editar: m, excluir: m };
    if (!m || typeof m !== "object") return EMPTY_MODULO;
    return { ver: !!m.ver, criar: !!m.criar, editar: !!m.editar, excluir: !!m.excluir };
  };
  return {
    dashboard: !!raw.dashboard,
    assistencia: ensureModulo(raw.assistencia),
    financeiro: ensureModulo(raw.financeiro),
    pecas: ensureModulo(raw.pecas),
    clientes: ensureModulo(raw.clientes),
    relatorios: !!raw.relatorios,
    configuracoes: !!raw.configuracoes,
    fila_ia: !!raw.fila_ia,
  };
}

type CachedState = {
  userId: string;
  permissoes: Permissoes;
  isAdmin: boolean;
  isGerente: boolean;
  perfil: string;
  loadedAt: number;
};
let CACHE: CachedState | null = null;
const CACHE_TTL_MS = 5 * 60 * 1000;

export function usePermissoes() {
  const { user } = useAuth();
  const userId = user?.id ?? null;

  const initial = CACHE && CACHE.userId === userId ? CACHE : null;

  const [permissoes, setPermissoes] = useState<Permissoes>(initial?.permissoes ?? DEFAULT_PERMISSOES);
  const [perfil, setPerfil] = useState<string>(initial?.perfil ?? "");
  const [isAdmin, setIsAdmin] = useState(initial?.isAdmin ?? false);
  const [isGerente, setIsGerente] = useState(initial?.isGerente ?? false);
  const [loading, setLoading] = useState(!initial);

  const fetchInProgress = useRef(false);

  useEffect(() => {
    if (!userId) {
      CACHE = null;
      setPermissoes(DEFAULT_PERMISSOES);
      setIsAdmin(false);
      setIsGerente(false);
      setPerfil("");
      setLoading(false);
      return;
    }

    if (CACHE && CACHE.userId === userId && (Date.now() - CACHE.loadedAt) < CACHE_TTL_MS) {
      setPermissoes(CACHE.permissoes);
      setIsAdmin(CACHE.isAdmin);
      setIsGerente(CACHE.isGerente);
      setPerfil(CACHE.perfil);
      setLoading(false);
      return;
    }

    if (fetchInProgress.current) return;
    fetchInProgress.current = true;

    const fetchPermissoes = async () => {
      try {
        const { data, error } = await supabase.rpc("get_my_permissoes");

        if (error || !data) {
          console.error("Erro ao carregar permissões:", error);
          if (!CACHE) {
            setPermissoes(DEFAULT_PERMISSOES);
            setIsAdmin(false);
            setIsGerente(false);
            setPerfil("sem_perfil");
          }
          return;
        }

        const payload = data as any;
        const newIsAdmin = !!payload.is_admin;
        const newIsGerente = !!payload.is_gerente;
        const newPerfil = payload.role || "sem_perfil";
        const newPermissoes = newIsAdmin ? ADMIN_PERMISSOES : parsePermissoes(payload.permissoes);

        CACHE = {
          userId,
          permissoes: newPermissoes,
          isAdmin: newIsAdmin,
          isGerente: newIsGerente,
          perfil: newPerfil,
          loadedAt: Date.now(),
        };

        setIsAdmin(newIsAdmin);
        setIsGerente(newIsGerente);
        setPerfil(newPerfil);
        setPermissoes(newPermissoes);
      } catch (err) {
        console.error("Falha em get_my_permissoes:", err);
        if (!CACHE) {
          setPermissoes(DEFAULT_PERMISSOES);
          setIsAdmin(false);
          setIsGerente(false);
          setPerfil("sem_perfil");
        }
      } finally {
        setLoading(false);
        fetchInProgress.current = false;
      }
    };

    fetchPermissoes();
  }, [userId]);

  const can = (modulo: keyof Permissoes, acao?: keyof PermissaoModulo): boolean => {
    if (loading) return false;
    const val = permissoes[modulo];
    if (typeof val === "boolean") return val;
    if (!acao) return val.ver;
    return val[acao];
  };

  return { permissoes, perfil, isAdmin, isGerente, can, loading };
}

export function invalidatePermissoesCache() {
  CACHE = null;
}
