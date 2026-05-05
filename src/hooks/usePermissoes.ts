import { useEffect, useState } from "react";
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

function ensureModulo(m: any): PermissaoModulo {
  if (typeof m === "boolean") return { ver: m, criar: m, editar: m, excluir: m };
  if (!m || typeof m !== "object") return EMPTY_MODULO;
  return { ver: !!m.ver, criar: !!m.criar, editar: !!m.editar, excluir: !!m.excluir };
}

function parsePermissoes(raw: any): Permissoes {
  if (!raw || typeof raw !== "object") return DEFAULT_PERMISSOES;
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

export function usePermissoes() {
  const { user } = useAuth();
  const [permissoes, setPermissoes] = useState<Permissoes>(DEFAULT_PERMISSOES);
  const [perfil, setPerfil] = useState<string>("");
  const [isAdmin, setIsAdmin] = useState(false);
  const [isGerente, setIsGerente] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setPermissoes(DEFAULT_PERMISSOES);
      setIsAdmin(false);
      setIsGerente(false);
      setPerfil("");
      setLoading(false);
      return;
    }

    const fetchPermissoes = async () => {
      try {
        const { data, error } = await supabase.rpc("get_my_permissoes");
        if (error || !data) {
          console.error("Erro ao carregar permissões:", error);
          setPermissoes(DEFAULT_PERMISSOES);
          setIsAdmin(false);
          setIsGerente(false);
          setPerfil("sem_perfil");
          return;
        }
        const payload = data as any;
        setIsAdmin(!!payload.is_admin);
        setIsGerente(!!payload.is_gerente);
        setPerfil(payload.role || "sem_perfil");
        if (payload.is_admin) {
          setPermissoes(ADMIN_PERMISSOES);
        } else {
          setPermissoes(parsePermissoes(payload.permissoes));
        }
      } catch (err) {
        console.error("Falha em get_my_permissoes:", err);
        setPermissoes(DEFAULT_PERMISSOES);
        setIsAdmin(false);
        setIsGerente(false);
        setPerfil("sem_perfil");
      } finally {
        setLoading(false);
      }
    };

    fetchPermissoes();
  }, [user]);

  const can = (modulo: keyof Permissoes, acao?: keyof PermissaoModulo): boolean => {
    if (loading) return false;
    const val = permissoes[modulo];
    if (typeof val === "boolean") return val;
    if (!acao) return val.ver;
    return val[acao];
  };

  const effectiveIsAdmin = loading ? false : isAdmin;

  return { permissoes, perfil, isAdmin: effectiveIsAdmin, isGerente, can, loading };
}
