import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { buildUserProfileLookup } from "@/lib/userProfileLookup";

type GuardState = "loading" | "no-auth" | "onboarding" | "ok";

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const [state, setState] = useState<GuardState>("loading");

  useEffect(() => {
    if (loading) return;
    if (!user) {
      setState("no-auth");
      return;
    }

    let cancelled = false;
    setState("loading");

    const validateAccess = async () => {
      try {
        // Bloquear lojistas de acessar rotas internas
        const { data: lojistaCheck } = await supabase
          .from("lojista_usuarios")
          .select("id")
          .eq("user_id", user.id)
          .eq("ativo", true)
          .maybeSingle();

        if (lojistaCheck) {
          window.location.replace("/lojista");
          return;
        }

        const { data, error } = await supabase
          .from("user_profiles")
          .select("id, empresa_id, ativo")
          .or(buildUserProfileLookup(user.id))
          .maybeSingle();

        if (cancelled) return;

        if (error) {
          console.error("AuthGuard error:", error);
          setState("no-auth");
          return;
        }

        if (!data || !data.ativo) {
          setState("no-auth");
        } else if (!data.empresa_id) {
          setState("onboarding");
        } else {
          setState("ok");
        }
      } catch (error) {
        if (cancelled) return;
        console.error("AuthGuard unexpected error:", error);
        setState("no-auth");
      }
    };

    void validateAccess();

    return () => { cancelled = true; };
  }, [user, loading]);

  if (state === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="h-6 w-6 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  if (state === "no-auth") return <Navigate to="/login" replace />;
  if (state === "onboarding") return <Navigate to="/onboarding" replace />;

  return <>{children}</>;
}
