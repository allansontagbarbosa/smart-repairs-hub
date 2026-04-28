import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function useServicosDisponiveis(empresaId: string | null | undefined) {
  return useQuery({
    queryKey: ["servicos-disponiveis", empresaId],
    enabled: !!empresaId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("os_servicos")
        .select(`
          id, nome, valor, comissao, status, ordem_id, created_at,
          ordens_de_servico!inner (
            id, numero, numero_formatado, status, prioridade, previsao_entrega,
            aparelhos ( marca, modelo, cor )
          )
        `)
        .eq("empresa_id", empresaId!)
        .eq("status", "pendente")
        .is("tecnico_id", null)
        .not("ordens_de_servico.status", "in", "(entregue,cancelado)")
        .is("ordens_de_servico.deleted_at", null)
        .order("created_at", { ascending: true })
        .limit(100);
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useMeusServicosEmAndamento(funcionarioId: string | null | undefined) {
  return useQuery({
    queryKey: ["meus-servicos-em-andamento", funcionarioId],
    enabled: !!funcionarioId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("os_servicos")
        .select(`
          id, nome, valor, comissao, status, ordem_id, iniciado_em,
          ordens_de_servico!inner (
            id, numero, numero_formatado, status, prioridade, previsao_entrega,
            aparelhos ( marca, modelo, cor )
          )
        `)
        .eq("tecnico_id", funcionarioId!)
        .eq("status", "em_reparo")
        .order("iniciado_em", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });
}
