import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { buildUserProfileLookup } from "@/lib/userProfileLookup";

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
  const p = { ...DEFAULT_PERMISSOES };
  const modules: (keyof Permissoes)[] = ["dashboard", "assistencia", "financeiro", "pecas", "clientes", "relatorios", "configuracoes", "fila_ia"];
  for (const key of modules) {
    const val = raw[key];
    if (typeof val === "boolean") {
      (p as any)[key] = val;
    } else if (typeof val === "object" && val !== null) {
      (p as any)[key] = {
        ver: !!val.ver,
        criar: !!val.criar,
        editar: !!val.editar,
        excluir: !!val.excluir,
      };
    }
  }
  return p;
}

export function usePermissoes() {
  const { user } = useAuth();
  // SECURITY: fail-closed. Estado inicial é VAZIO; só vira admin após confirmação do backend.
  const [permissoes, setPermissoes] = useState<Permissoes>(DEFAULT_PERMISSOES);
  const [perfil, setPerfil] = useState<string>("");
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setPermissoes(DEFAULT_PERMISSOES);
      setIsAdmin(false);
      setPerfil("");
      setLoading(false);
      return;
    }

    const fetchPermissoes = async () => {
      try {
        const { data: profile } = await supabase
          .from("user_profiles")
          .select("perfil_id, perfis_acesso(nome_perfil, permissoes)")
          .or(buildUserProfileLookup(user.id))
          .eq("ativo", true)
          .maybeSingle();

        if (profile?.perfis_acesso) {
          const pa = profile.perfis_acesso as any;
          const nome = pa.nome_perfil || "";
          setPerfil(nome);
          setIsAdmin(nome === "admin" || nome === "Administrador");
          setPermissoes(parsePermissoes(pa.permissoes));
        } else {
          // Sem perfil atribuído → acesso mínimo, NÃO admin
          setPerfil("sem_perfil");
          setIsAdmin(false);
          setPermissoes(DEFAULT_PERMISSOES);
        }
      } catch (err) {
        // Erro de rede/RLS → fail-closed, NÃO admin
        console.error("Erro ao carregar permissões:", err);
        setPermissoes(DEFAULT_PERMISSOES);
        setIsAdmin(false);
        setPerfil("sem_perfil");
      } finally {
        setLoading(false);
      }
    };

    fetchPermissoes();
  }, [user]);

  const can = (modulo: keyof Permissoes, acao?: keyof PermissaoModulo): boolean => {
    // SECURITY: enquanto carrega, nega tudo (fail-closed). Evita flicker de botões admin.
    if (loading) return false;
    const val = permissoes[modulo];
    if (typeof val === "boolean") return val;
    if (!acao) return val.ver;
    return val[acao];
  };

  // SECURITY: isAdmin efetivo só após loading terminar.
  const effectiveIsAdmin = loading ? false : isAdmin;

  return { permissoes, perfil, isAdmin: effectiveIsAdmin, can, loading };
}
