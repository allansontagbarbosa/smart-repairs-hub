import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function useMeusServicosAtribuidos(funcionarioId: string | null | undefined) {
  return useQuery({
    queryKey: ["meus-servicos-atribuidos", funcionarioId],
    enabled: !!funcionarioId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("os_servicos")
        .select(`
          id, nome, valor, comissao, status, ordem_id, created_at, updated_at,
          ordens_de_servico!inner (
            id, numero, numero_formatado, status, prioridade, previsao_entrega,
            aparelhos ( marca, modelo, cor )
          )
        `)
        .eq("tecnico_id", funcionarioId!)
        .eq("status", "pendente")
        .not("ordens_de_servico.status", "in", "(entregue,cancelado)")
        .is("ordens_de_servico.deleted_at", null)
        .order("updated_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
}
