import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useListarFuncionariosRH } from "./useRH";

export interface FolhaMensalItem {
  funcionario_id: string;
  funcionario_nome: string;
  cargo: string | null;
  tipo_vinculo: string;
  total_proventos_centavos: number;
  total_descontos_centavos: number;
  liquido_centavos: number;
  movimentacoes_pendentes: number;
  faltas: number;
  horas_trabalhadas: number;
}

export function useFolhaMensal(competencia: string) {
  const { data: funcionarios = [] } = useListarFuncionariosRH();

  return useQuery({
    queryKey: ["rh", "folha-mensal", competencia, funcionarios.map(f => f.id).join(",")],
    enabled: funcionarios.length > 0,
    queryFn: async () => {
      const ativos = funcionarios.filter(f => f.ativo);
      const promises = ativos.map(async (f) => {
        const { data, error } = await (supabase as any).rpc("holerite_funcionario", {
          p_funcionario_id: f.id,
          p_competencia: competencia,
        });
        if (error || !data?.success) return null;

        const pendentes = (data.movimentacoes ?? []).filter((m: any) => m.status === "pendente").length;

        return {
          funcionario_id: f.id,
          funcionario_nome: f.nome,
          cargo: f.cargo,
          tipo_vinculo: f.tipo_vinculo,
          total_proventos_centavos: data.total_proventos_centavos ?? 0,
          total_descontos_centavos: data.total_descontos_centavos ?? 0,
          liquido_centavos: data.liquido_centavos ?? 0,
          movimentacoes_pendentes: pendentes,
          faltas: data.faltas ?? 0,
          horas_trabalhadas: data.horas_trabalhadas ?? 0,
        } as FolhaMensalItem;
      });

      const resultados = await Promise.all(promises);
      return resultados.filter(Boolean) as FolhaMensalItem[];
    },
    staleTime: 0,
  });
}
