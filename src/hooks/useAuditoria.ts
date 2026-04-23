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
        // NÃO re-throw: a ação principal não pode quebrar por falha de log.
        // Em vez disso, registra em auditoria_falhas para visibilidade ao admin.
        console.error("Erro ao registrar auditoria:", err);
        try {
          await supabase.from("auditoria_falhas").insert({
            user_id: user?.id || null,
            acao,
            modulo,
            registro_id: registro_id || null,
            erro: String((err as any)?.message || err),
          } as any);
        } catch (_) {
          // Se até a tabela de falhas falhar, não há nada a fazer.
        }
      }
    },
    [user]
  );

  return { registrar };
}
