import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function useEhAdmin() {
  return useQuery({
    queryKey: ["eh_admin"],
    queryFn: async () => {
      const { data: userData } = await supabase.auth.getUser();
      const uid = userData.user?.id;
      if (!uid) return false;
      const { data, error } = await supabase.rpc("is_admin_user", { _user_id: uid });
      if (error) return false;
      return Boolean(data);
    },
    staleTime: 5 * 60 * 1000,
  });
}
