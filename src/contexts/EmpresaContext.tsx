import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

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
      try {
        // Get empresa_id from user_profiles
        const { data: profile } = await supabase
          .from("user_profiles")
          .select("empresa_id")
          .eq("user_id", user.id)
          .eq("ativo", true)
          .maybeSingle();

        if (profile?.empresa_id) {
          const { data: emp } = await supabase
            .from("empresas" as any)
            .select("*")
            .eq("id", profile.empresa_id)
            .maybeSingle();

          if (emp) {
            setEmpresa(emp as any);
          }
        }
      } catch (err) {
        console.error("Erro ao carregar empresa:", err);
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
