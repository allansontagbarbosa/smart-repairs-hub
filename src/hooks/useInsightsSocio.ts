import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type InsightSocio = {
  tipo: "risco" | "oportunidade" | "alerta";
  titulo: string;
  descricao: string;
  valor_impacto_centavos: number;
  acao_sugerida: string;
};

export type InsightsResponse = {
  sucesso: boolean;
  cached: boolean;
  gerado_em: string;
  insights: { insights: InsightSocio[] };
};

export function useInsightsSocio() {
  return useQuery<InsightsResponse>({
    queryKey: ["insights-socio"],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("gerar-insights-socio", {});
      if (error) throw error;
      return data as InsightsResponse;
    },
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
}
