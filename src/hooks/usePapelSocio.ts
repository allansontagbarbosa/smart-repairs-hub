import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

/** Detecta no servidor se o usuário é ADM e/ou sócio. À prova de bypass. */
export function usePapelSocio() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["papel-socio", user?.id],
    queryFn: async () => {
      const [admRes, socRes] = await Promise.all([
        supabase.rpc("eh_admin" as any),
        supabase.rpc("is_socio" as any),
      ]);
      return {
        ehAdmin: Boolean(admRes.data),
        ehSocio: Boolean(socRes.data),
      };
    },
    enabled: !!user?.id,
    staleTime: 5 * 60 * 1000,
  });
}
