import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

interface PermissaoModulo {
  ver: boolean;
  criar: boolean;
  editar: boolean;
  excluir: boolean;
}

export type PermissoesCrud = PermissaoModulo;

export interface Permissoes {
  // Módulos booleanos (existentes)
  dashboard: boolean;
  relatorios: boolean;
  configuracoes: boolean;
  fila_ia: boolean;
  assistencia: PermissaoModulo;
  financeiro: PermissaoModulo;
  pecas: PermissaoModulo;
  clientes: PermissaoModulo;
  aparelhos: PermissaoModulo;
  compras: PermissaoModulo;
  fornecedores: PermissaoModulo;
  faturas_b2b: PermissaoModulo;
  metas: PermissaoModulo;
  rh: PermissaoModulo;
  desempenho_tecnicos: boolean;
  paineis_tv: boolean;
  // Módulo Loja (booleanos)
  loja_dashboard: boolean;
  loja_pdv: boolean;
  loja_vendas: boolean;
  loja_aparelhos: boolean;
  loja_compras: boolean;
  loja_trade_in: boolean;
  loja_crediario: boolean;
  loja_clientes: boolean;
  loja_vendedores: boolean;
  loja_metas: boolean;
  loja_tv: boolean;
  loja_financeiro: boolean;
  loja_relatorios: boolean;
  loja_configuracoes: boolean;
}

const FULL_MODULO: PermissaoModulo = { ver: true, criar: true, editar: true, excluir: true };

const ADMIN_PERMISSOES: Permissoes = {
  dashboard: true,
  relatorios: true,
  configuracoes: true,
  fila_ia: true,
  assistencia: FULL_MODULO,
  financeiro: FULL_MODULO,
  pecas: FULL_MODULO,
  clientes: FULL_MODULO,
  aparelhos: FULL_MODULO,
  compras: FULL_MODULO,
  fornecedores: FULL_MODULO,
  faturas_b2b: FULL_MODULO,
  metas: FULL_MODULO,
  rh: FULL_MODULO,
  desempenho_tecnicos: true,
  paineis_tv: true,
  loja_dashboard: true,
  loja_pdv: true,
  loja_vendas: true,
  loja_aparelhos: true,
  loja_compras: true,
  loja_trade_in: true,
  loja_crediario: true,
  loja_clientes: true,
  loja_vendedores: true,
  loja_metas: true,
  loja_tv: true,
  loja_financeiro: true,
  loja_relatorios: true,
  loja_configuracoes: true,
};

const EMPTY_MODULO: PermissaoModulo = { ver: false, criar: false, editar: false, excluir: false };

const DEFAULT_PERMISSOES: Permissoes = {
  dashboard: false,
  relatorios: false,
  configuracoes: false,
  fila_ia: false,
  assistencia: EMPTY_MODULO,
  financeiro: EMPTY_MODULO,
  pecas: EMPTY_MODULO,
  clientes: EMPTY_MODULO,
  aparelhos: EMPTY_MODULO,
  compras: EMPTY_MODULO,
  fornecedores: EMPTY_MODULO,
  faturas_b2b: EMPTY_MODULO,
  metas: EMPTY_MODULO,
  rh: EMPTY_MODULO,
  desempenho_tecnicos: false,
  paineis_tv: false,
  loja_dashboard: false,
  loja_pdv: false,
  loja_vendas: false,
  loja_aparelhos: false,
  loja_compras: false,
  loja_trade_in: false,
  loja_crediario: false,
  loja_clientes: false,
  loja_vendedores: false,
  loja_metas: false,
  loja_tv: false,
  loja_financeiro: false,
  loja_relatorios: false,
  loja_configuracoes: false,
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
    relatorios: !!raw.relatorios,
    configuracoes: !!raw.configuracoes,
    fila_ia: !!raw.fila_ia,
    assistencia: ensureModulo(raw.assistencia),
    financeiro: ensureModulo(raw.financeiro),
    pecas: ensureModulo(raw.pecas),
    clientes: ensureModulo(raw.clientes),
    aparelhos: ensureModulo(raw.aparelhos),
    compras: ensureModulo(raw.compras),
    fornecedores: ensureModulo(raw.fornecedores),
    faturas_b2b: ensureModulo(raw.faturas_b2b),
    metas: ensureModulo(raw.metas),
    rh: ensureModulo(raw.rh),
    desempenho_tecnicos: !!raw.desempenho_tecnicos,
    paineis_tv: !!raw.paineis_tv,
    loja_dashboard: !!raw.loja_dashboard,
    loja_pdv: !!raw.loja_pdv,
    loja_vendas: !!raw.loja_vendas,
    loja_aparelhos: !!raw.loja_aparelhos,
    loja_compras: !!raw.loja_compras,
    loja_trade_in: !!raw.loja_trade_in,
    loja_crediario: !!raw.loja_crediario,
    loja_clientes: !!raw.loja_clientes,
    loja_vendedores: !!raw.loja_vendedores,
    loja_metas: !!raw.loja_metas,
    loja_tv: !!raw.loja_tv,
    loja_financeiro: !!raw.loja_financeiro,
    loja_relatorios: !!raw.loja_relatorios,
    loja_configuracoes: !!raw.loja_configuracoes,
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
  const { user, loading: authLoading } = useAuth();
  const userId = user?.id ?? null;

  const initial = CACHE && CACHE.userId === userId ? CACHE : null;

  const [permissoes, setPermissoes] = useState<Permissoes>(initial?.permissoes ?? DEFAULT_PERMISSOES);
  const [perfil, setPerfil] = useState<string>(initial?.perfil ?? "");
  const [isAdmin, setIsAdmin] = useState(initial?.isAdmin ?? false);
  const [isGerente, setIsGerente] = useState(initial?.isGerente ?? false);
  const [loading, setLoading] = useState(authLoading || !initial);

  const fetchInProgress = useRef(false);

  useEffect(() => {
    // Se auth ainda carregando, espera próximo render
    if (authLoading) {
      setLoading(true);
      return;
    }

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

    if (fetchInProgress.current) {
      // Outra instância já está buscando — aguarda cache popular
      let cancelled = false;
      const poll = setInterval(() => {
        if (cancelled) return;
        if (CACHE && CACHE.userId === userId) {
          setPermissoes(CACHE.permissoes);
          setIsAdmin(CACHE.isAdmin);
          setIsGerente(CACHE.isGerente);
          setPerfil(CACHE.perfil);
          setLoading(false);
          clearInterval(poll);
        }
      }, 50);
      const safety = setTimeout(() => {
        cancelled = true;
        clearInterval(poll);
        setLoading(false);
      }, 10000);
      return () => {
        cancelled = true;
        clearInterval(poll);
        clearTimeout(safety);
      };
    }
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
  }, [userId, authLoading]);

  const can = (modulo: keyof Permissoes, acao?: keyof PermissaoModulo): boolean => {
    if (loading || authLoading) return false;

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
