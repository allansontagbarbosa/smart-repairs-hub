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

    // Se a URL trouxer fragmento de auth (magic link), aguarda o Supabase
    // processar antes de decidir loading=false. Sem isso, o guard redireciona
    // pra /lojista/login antes do token virar sessão.
    const hash = typeof window !== "undefined" ? window.location.hash : "";
    const hasAuthHash = /access_token=|refresh_token=|type=magiclink|type=recovery/i.test(hash);

    async function check(allowEmpty = true) {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) {
        if (mounted && allowEmpty) { setLojistaUser(null); setLoading(false); }
        return;
      }

      const userId = session.user.id;
      const userEmail = (session.user.email || "").toLowerCase();

      // 1) Busca por user_id ativo
      const { data: vinculos, error } = await supabase
        .from("lojista_usuarios")
        .select("id, lojista_id, nome, email, user_id, ativo, lojistas!inner(id, nome, razao_social, cnpj, ativo)")
        .eq("user_id", userId)
        .eq("ativo", true)
        .order("created_at", { ascending: false });

      if (error) console.error("[useLojistaAuth] erro:", error);

      let escolhido = (vinculos ?? []).find(
        (v: any) => v.lojistas?.ativo === true,
      ) ?? null;

      // 2) Fallback: backfill por email (registros pendentes com user_id placeholder)
      if (!escolhido && userEmail) {
        const { data: porEmail } = await supabase
          .from("lojista_usuarios")
          .select("id, lojista_id, nome, email, user_id, ativo, lojistas!inner(id, nome, razao_social, cnpj, ativo)")
          .eq("email", userEmail)
          .order("created_at", { ascending: false });

        const candidato = (porEmail ?? []).find((v: any) => v.lojistas?.ativo === true) ?? null;

        if (candidato) {
          // Vincular user_id real e ativar
          const { data: atualizado, error: updErr } = await supabase
            .from("lojista_usuarios")
            .update({ user_id: userId, ativo: true })
            .eq("id", candidato.id)
            .select("id, lojista_id, nome, email, user_id, ativo, lojistas!inner(id, nome, razao_social, cnpj, ativo)")
            .maybeSingle();

          if (updErr) {
            console.error("[useLojistaAuth] backfill falhou:", updErr);
            escolhido = candidato; // segue com o candidato mesmo sem update
          } else {
            escolhido = atualizado ?? candidato;
          }
        }
      }

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
