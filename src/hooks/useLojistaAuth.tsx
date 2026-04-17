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

      // Busca todos os vínculos ativos e prioriza o que tem lojista ativo.
      // Usar .limit() em vez de .maybeSingle() pra não quebrar com duplicatas.
      const { data: vinculos, error } = await supabase
        .from("lojista_usuarios")
        .select("id, lojista_id, nome, email, lojistas!inner(id, nome, razao_social, cnpj, ativo)")
        .eq("user_id", session.user.id)
        .eq("ativo", true)
        .order("created_at", { ascending: false });

      if (error) console.error("[useLojistaAuth] erro:", error);

      const escolhido = (vinculos ?? []).find(
        (v: any) => v.lojistas?.ativo === true,
      ) ?? null;

      if (mounted) {
        if (escolhido) {
          setLojistaUser({
            id: escolhido.id,
            lojista_id: escolhido.lojista_id,
            nome: escolhido.nome,
            email: escolhido.email,
            lojista: (escolhido as any).lojistas ?? undefined,
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
