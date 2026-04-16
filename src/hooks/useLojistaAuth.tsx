import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

interface LojistaUser {
  id: string;
  lojista_id: string;
  nome: string;
  email: string;
  lojista?: {
    id: string;
    nome: string;
    razao_social: string | null;
    cnpj: string | null;
  };
}

export function useLojistaAuth() {
  const [lojistaUser, setLojistaUser] = useState<LojistaUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    async function check() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) {
        if (mounted) { setLojistaUser(null); setLoading(false); }
        return;
      }

      const { data } = await supabase
        .from("lojista_usuarios")
        .select("id, lojista_id, nome, email, lojistas(id, nome, razao_social, cnpj)")
        .eq("user_id", session.user.id)
        .eq("ativo", true)
        .maybeSingle();

      if (mounted) {
        if (data) {
          setLojistaUser({
            id: data.id,
            lojista_id: data.lojista_id,
            nome: data.nome,
            email: data.email,
            lojista: (data as any).lojistas ?? undefined,
          });
        } else {
          setLojistaUser(null);
        }
        setLoading(false);
      }
    }

    check();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => {
      check();
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  async function lojistaSignOut() {
    await supabase.auth.signOut();
    setLojistaUser(null);
  }

  return { lojistaUser, loading, lojistaSignOut };
}

export function LojistaGuard({ children }: { children: React.ReactNode }) {
  const { lojistaUser, loading } = useLojistaAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !lojistaUser) {
      navigate("/lojista/login", { replace: true });
    }
  }, [loading, lojistaUser, navigate]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="h-6 w-6 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  if (!lojistaUser) return null;

  return <>{children}</>;
}
