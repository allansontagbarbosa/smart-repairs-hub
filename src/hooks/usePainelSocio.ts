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
    custo_terceirizado: number;
    despesas: number;
    comissoes: number;
    lucro_liquido: number;
    reserva_pct: number;
    reserva_val: number;
    distribuivel: number;
    meu_valor_parcial: number;
    fechamento_previsto: number;
    faturamento_previsto: number;
    custo_pecas_previsto: number;
    custo_terceirizado_previsto: number;
    comissoes_previstas: number;
    lucro_liquido_previsto: number;
    reserva_prevista: number;
    distribuivel_previsto: number;
    fator_projecao: number;
    confiabilidade_projecao: "baixa" | "média" | "alta";
  };
  mes_passado: {
    faturamento: number;
    custo_pecas: number;
    custo_terceirizado: number;
    despesas: number;
    comissoes: number;
    lucro_liquido: number;
    distribuivel: number;
    meu_valor: number;
    periodo_ate_dia: string;
    faturamento_periodo: number;
    lucro_liquido_periodo: number;
    distribuivel_periodo: number;
    meu_valor_periodo: number;
  };
  variacao_mes: {
    meu_valor_pct: number;
    meu_valor_abs: number;
    fechamento_pct: number;
    fechamento_abs: number;
    faturamento_pct: number;
    lucro_liquido_pct: number;
  } | null;
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
    valor?: number;
    valor_mes_passado?: number;
    valor_ano_acumulado?: number;
    variacao_pct?: number;
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
    inadimplencia_qtd: number;
    inadimplencia_dias_max: number;
    gastos_fixos_mes_centavos: number;
    saldo_caixa_centavos?: number;
    capital_giro_centavos?: number;
    dias_runway?: number;
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
