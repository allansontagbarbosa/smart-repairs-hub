import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type ContasSocioSocio = {
  id: string;
  nome: string;
  percentual: number;
  eh_voce: boolean;
  saldo_a_retirar: number;
  total_retirado: number;
  creditado_no_ano: number;
};

export type ContasSocioFechamento = {
  id: string;
  mes: string;
  faturamento: number;
  lucro_liquido: number;
  reserva_val: number;
  distribuivel: number;
  fechado_em: string;
  meu_valor: number;
};

export type ContasSocioData = {
  success: boolean;
  socio_id_logado: string;
  socios: ContasSocioSocio[];
  fechamentos: ContasSocioFechamento[];
  meses_disponiveis_pra_fechar: string[];
};

export function useContasSocio() {
  return useQuery<ContasSocioData>({
    queryKey: ["painel-socio-contas"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_painel_socio_contas" as any);
      if (error) throw error;
      return data as unknown as ContasSocioData;
    },
    refetchInterval: 5 * 60 * 1000,
  });
}

export type ExtratoMovimento = {
  id: string;
  tipo: "credito_fechamento" | "debito_retirada" | "estorno_fechamento" | "estorno_retirada" | "pro_labore" | "ajuste";
  valor: number;
  descricao: string;
  data_movimento: string;
  mes_ref: string | null;
  fechamento_id: string | null;
  retirada_id: string | null;
  saldo_apos: number;
  created_at: string;
};

export type ExtratoData = {
  success: boolean;
  saldo: number;
  movimentos: ExtratoMovimento[];
};

export type ExtratoFiltro = "todos" | "creditos" | "debitos" | "pro_labore";

export function useExtratoSocio(filtro: ExtratoFiltro) {
  return useQuery<ExtratoData>({
    queryKey: ["extrato-socio", filtro],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_extrato_socio" as any, { p_filtro: filtro });
      if (error) throw error;
      return data as unknown as ExtratoData;
    },
  });
}
