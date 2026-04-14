import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const [isInternal, setIsInternal] = useState<boolean | null>(null);

  useEffect(() => {
    if (!user) {
      setIsInternal(null);
      return;
    }

    let cancelled = false;
    supabase
      .from("user_profiles")
      .select("id")
      .eq("user_id", user.id)
      .eq("ativo", true)
      .maybeSingle()
      .then(({ data }) => {
        if (!cancelled) setIsInternal(!!data);
      });

    return () => { cancelled = true; };
  }, [user]);

  if (loading || (user && isInternal === null)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="h-6 w-6 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  if (!user || !isInternal) return <Navigate to="/login" replace />;

  return <>{children}</>;
}
