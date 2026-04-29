import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type OSServicoItem = {
  id?: string;
  servico_id: string;
  tecnico_id: string | null;
  valor: number;
  comissao: number;
  nome?: string;
  tecnico_nome?: string | null;
};

export function useOSServicos(ordemId: string | null | undefined) {
  return useQuery<OSServicoItem[]>({
    queryKey: ["os-servicos-v2", ordemId],
    enabled: !!ordemId,
    queryFn: async () => {
      if (!ordemId) return [];
      const { data, error } = await supabase
        .from("os_servicos")
        .select("id, servico_id, tecnico_id, nome, valor, comissao, funcionarios:tecnico_id ( nome ), tipos_servico:servico_id ( nome )")
        .eq("ordem_id", ordemId)
        .order("created_at", { ascending: true });

      if (error) throw error;

      return (data ?? []).map((item: any) => ({
        id: item.id,
        servico_id: item.servico_id,
        tecnico_id: item.tecnico_id ?? null,
        valor: Number(item.valor) || 0,
        comissao: Number(item.comissao) || 0,
        nome: item.tipos_servico?.nome ?? item.nome,
        tecnico_nome: item.funcionarios?.nome ?? null,
      }));
    },
  });
}
