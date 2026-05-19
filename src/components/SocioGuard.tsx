import { useQuery } from "@tanstack/react-query";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";

export function SocioGuard({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const { data, isLoading } = useQuery({
    queryKey: ["socio-guard", user?.id],
    queryFn: async () => {
      if (!user?.id) return false;
      const { data: row } = await supabase
        .from("socios")
        .select("id")
        .eq("user_id", user.id)
        .eq("ativo", true)
        .is("deleted_at", null)
        .maybeSingle();
      return !!row;
    },
    enabled: !!user?.id,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!data) return <Navigate to="/sem-acesso" replace />;
  return <>{children}</>;
}
