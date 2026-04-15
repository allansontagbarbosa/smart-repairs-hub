import { useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { buildUserProfileLookup } from "@/lib/userProfileLookup";

export function useAuditoria() {
  const { user } = useAuth();

  const registrar = useCallback(
    async (
      acao: string,
      modulo: string,
      registro_id?: string | null,
      dados_anteriores?: Record<string, any> | null,
      dados_novos?: Record<string, any> | null
    ) => {
      try {
        // Get user display name
        let user_nome = "Sistema";
        if (user) {
          const { data: profile } = await supabase
            .from("user_profiles")
            .select("nome_exibicao")
            .or(buildUserProfileLookup(user.id))
            .maybeSingle();
          user_nome = profile?.nome_exibicao || user.email || "Sistema";
        }

        await supabase.from("auditoria").insert({
          user_id: user?.id || null,
          user_nome,
          acao,
          tabela: modulo,
          modulo,
          registro_id: registro_id || null,
          dados_anteriores: dados_anteriores || null,
          dados_novos: dados_novos || null,
        } as any);
      } catch (err) {
        console.error("Erro ao registrar auditoria:", err);
      }
    },
    [user]
  );

  return { registrar };
}
