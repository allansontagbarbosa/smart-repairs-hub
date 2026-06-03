import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type SocioVisaoAdmin = {
  socio_id: string;
  user_id: string;
  nome: string;
  percentual: number;
  total_creditado: number;
  total_retirado: number;
  saldo: number;
  retiradas_pendentes: number;
  qtd_pendentes: number;
  eh_voce: boolean;
};

export function useSociosVisaoAdmin() {
  return useQuery<SocioVisaoAdmin[]>({
    queryKey: ["socios-visao-admin"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("socios_visao_admin" as any);
      if (error) throw error;
      return ((data as any[]) ?? []).map((r) => ({
        socio_id: r.socio_id,
        user_id: r.user_id,
        nome: r.nome,
        percentual: Number(r.percentual ?? 0),
        total_creditado: Number(r.total_creditado ?? 0),
        total_retirado: Number(r.total_retirado ?? 0),
        saldo: Number(r.saldo ?? 0),
        retiradas_pendentes: Number(r.retiradas_pendentes ?? 0),
        qtd_pendentes: Number(r.qtd_pendentes ?? 0),
        eh_voce: Boolean(r.eh_voce),
      }));
    },
    refetchInterval: 60_000,
  });
}
