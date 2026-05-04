import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface KpiTecnico {
  funcionario_id: string;
  nome: string;
  qtd_servicos: number;
  qtd_os: number;
  valor_servicos: number;
  faturamento_os: number;
  comissao_pendente: number;
  comissao_liberada: number;
  comissao_paga: number;
  comissao_total_a_receber: number;
  ticket_medio_os: number;
}

export function useDesempenhoTecnicos(inicio: Date, fim: Date) {
  return useQuery({
    queryKey: ["desempenho-tecnicos", inicio.toISOString(), fim.toISOString()],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("kpi_tecnicos" as any, {
        p_inicio: inicio.toISOString(),
        p_fim: fim.toISOString(),
      });
      if (error) throw error;
      const payload = data as any;
      if (!payload?.success) throw new Error(payload?.error || "Falha ao carregar");
      return (payload.tecnicos ?? []) as KpiTecnico[];
    },
  });
}
