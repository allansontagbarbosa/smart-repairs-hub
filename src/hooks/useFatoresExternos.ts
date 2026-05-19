import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type FatoresExternos = {
  sucesso: boolean;
  atualizado_em: string;
  dolar: { valor: number; variacao_30d_pct: number | null } | null;
  eur: { valor: number } | null;
  selic: { valor_anual_pct: number } | null;
  clima: {
    cidade: string;
    estado: string;
    temperatura_atual: number;
    precipitacao_atual_mm: number;
    weather_code_atual: number;
    dias_chuva_proxima_semana: number;
  } | null;
  feriados_proximos: { data: string; nome: string; dias_ate: number }[];
};

export function useFatoresExternos() {
  return useQuery<FatoresExternos>({
    queryKey: ["fatores-externos"],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("get-fatores-externos", {});
      if (error) throw error;
      return data as FatoresExternos;
    },
    refetchInterval: 60 * 60 * 1000,
    staleTime: 30 * 60 * 1000,
  });
}
