import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type NotificacaoTecnico = {
  id: string;
  tipo: string;
  titulo: string;
  mensagem: string;
  link_interno: string | null;
  ref_id: string | null;
  lida: boolean;
  lida_em: string | null;
  created_at: string;
};

export function useNotificacoesTecnico() {
  return useQuery({
    queryKey: ["notificacoes-tecnico"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_notificacoes_tecnico" as any, {
        p_apenas_nao_lidas: false,
      });
      if (error) throw error;
      return data as { success: boolean; nao_lidas: number; notificacoes: NotificacaoTecnico[] };
    },
    refetchInterval: 60 * 1000,
  });
}

export function useMarcarNotificacaoTecnicoLida() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string | null) => {
      const { error } = await supabase.rpc("marcar_notificacao_tecnico_lida" as any, { p_id: id });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["notificacoes-tecnico"] });
    },
  });
}
