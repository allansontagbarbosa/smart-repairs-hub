import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type OSPendenteAtribuicao = {
  ordem_id: string;
  numero: number;
  status: string;
  data_entrada: string;
  data_conclusao: string | null;
  previsao_entrega: string | null;
  valor_total: number;
  cliente_nome: string;
  cliente_telefone: string;
  aparelho: string;
  qtd_servicos_pendentes: number;
  valor_servicos_pendentes: number;
  servicos: Array<{ servico_id: string; nome: string; valor: number }>;
};

export function useOSPendenteAtribuicao() {
  return useQuery<OSPendenteAtribuicao[]>({
    queryKey: ["os-pendente-atribuicao"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("v_os_pendente_atribuicao")
        .select("*");
      if (error) throw error;
      return (data ?? []) as OSPendenteAtribuicao[];
    },
    refetchInterval: 30 * 1000,
  });
}
