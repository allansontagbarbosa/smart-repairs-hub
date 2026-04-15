import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { buildUserProfileLookup, getSingleRelation } from "@/lib/userProfileLookup";

interface Empresa {
  id: string;
  nome: string;
  slug: string;
  cnpj: string | null;
  telefone: string | null;
  email: string | null;
  logo_url: string | null;
  endereco: any;
  plano: string;
  plano_ativo: boolean;
  trial_expira_em: string | null;
  criado_em: string | null;
  owner_id: string;
}

interface EmpresaContextType {
  empresa: Empresa | null;
  empresaId: string | null;
  plano: string;
  isTrialAtivo: boolean;
  diasRestantesTrial: number;
  loading: boolean;
}

const EmpresaContext = createContext<EmpresaContextType>({
  empresa: null,
  empresaId: null,
  plano: "basico",
  isTrialAtivo: false,
  diasRestantesTrial: 0,
  loading: true,
});

export const useEmpresa = () => useContext(EmpresaContext);

export function EmpresaProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [empresa, setEmpresa] = useState<Empresa | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setEmpresa(null);
      setLoading(false);
      return;
    }

    const fetchEmpresa = async () => {
      setLoading(true);

      try {
        const { data, error } = await supabase
          .from("user_profiles")
          .select("empresa_id, ativo, empresas(*)")
          .or(buildUserProfileLookup(user.id))
          .maybeSingle();

        if (error) {
          console.error("EmpresaContext error:", error);
          setEmpresa(null);
          return;
        }

        if (!data || data.ativo === false) {
          setEmpresa(null);
          return;
        }

        const empresaRelacionada = getSingleRelation((data as any).empresas);
        if (empresaRelacionada) {
          setEmpresa(empresaRelacionada as any);
          return;
        }

        if (data.empresa_id) {
          const { data: emp, error: empresaError } = await supabase
            .from("empresas" as any)
            .select("*")
            .eq("id", data.empresa_id)
            .maybeSingle();

          if (empresaError) {
            console.error("EmpresaContext empresa error:", empresaError);
          }

          if (emp) {
            setEmpresa(emp as any);
            return;
          }
        }

        setEmpresa(null);
      } catch (err) {
        console.error("Erro ao carregar empresa:", err);
        setEmpresa(null);
      } finally {
        setLoading(false);
      }
    };

    fetchEmpresa();
  }, [user]);

  const now = new Date();
  const trialEnd = empresa?.trial_expira_em ? new Date(empresa.trial_expira_em) : null;
  const diasRestantesTrial = trialEnd
    ? Math.max(0, Math.ceil((trialEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)))
    : 0;
  const isTrialAtivo = empresa?.plano_ativo === true && diasRestantesTrial > 0;

  return (
    <EmpresaContext.Provider
      value={{
        empresa,
        empresaId: empresa?.id || null,
        plano: empresa?.plano || "basico",
        isTrialAtivo,
        diasRestantesTrial,
        loading,
      }}
    >
      {children}
    </EmpresaContext.Provider>
  );
}
