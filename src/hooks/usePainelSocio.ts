import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type PainelSocioData = {
  sucesso: boolean;
  gerado_em: string;
  socio: { id: string; nome: string; percentual: number };
  periodo: {
    inicio_mes: string;
    fim_mes: string;
    hoje: string;
    dias_passados: number;
    dias_no_mes: number;
    progresso_pct: number;
  };
  mes_atual: {
    faturamento: number;
    receita_servicos: number;
    custo_pecas: number;
    despesas: number;
    comissoes: number;
    lucro_liquido: number;
    reserva_pct: number;
    reserva_val: number;
    distribuivel: number;
    meu_valor_parcial: number;
    fechamento_previsto: number;
  };
  mes_passado: { lucro_liquido: number; meu_valor: number };
  variacao_mes: number | null;
  historico: Array<{
    mes: string;
    mes_inicio: string;
    faturamento: number;
    custo_pecas: number;
    despesas: number;
    comissoes: number;
    lucro_liquido: number;
    meu_valor: number;
  }>;
  funcionarios_roi: Array<{
    id: string;
    nome: string;
    cargo: string;
    custo_total_centavos: number;
    receita_centavos: number;
    roi: number | null;
    status: "sem_salario" | "prejuizo" | "atencao" | "ok" | "estrela";
  }>;
  socios: Array<{
    id: string;
    nome: string;
    percentual: number;
    valor_estimado: number;
    eh_voce: boolean;
  }>;
  metas: Array<{
    id: string;
    titulo: string;
    valor_alvo_centavos: number;
    valor_acumulado_centavos: number;
    data_alvo: string | null;
    icone: string;
    cor: string;
    progresso_pct: number;
  }>;
  saude: {
    inadimplencia_centavos: number;
    gastos_fixos_mes_centavos: number;
  };
};

export function usePainelSocio() {
  return useQuery<PainelSocioData>({
    queryKey: ["painel-socio"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_painel_socio_v1" as any);
      if (error) throw error;
      return data as unknown as PainelSocioData;
    },
    refetchInterval: 5 * 60 * 1000,
  });
}
