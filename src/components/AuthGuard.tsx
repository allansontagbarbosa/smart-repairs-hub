import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";

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
    supabase
      .from("user_profiles")
      .select("id, empresa_id, ativo")
      .eq("user_id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (cancelled) return;
        if (!data || !data.ativo) {
          setState("no-auth");
        } else if (!data.empresa_id) {
          setState("onboarding");
        } else {
          setState("ok");
        }
      });

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
