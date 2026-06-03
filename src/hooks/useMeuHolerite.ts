import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { HoleriteDetalhadoData } from "./useHoleriteDetalhado";

const unwrap = (d: any) => (typeof d === "string" ? JSON.parse(d) : d);

export function useMeuFuncionarioId() {
  return useQuery({
    queryKey: ["meu-funcionario-id"],
    queryFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u?.user?.id) return null;
      const { data } = await supabase
        .from("user_profiles")
        .select("funcionario_id")
        .eq("user_id", u.user.id)
        .eq("ativo", true)
        .maybeSingle();
      return (data?.funcionario_id as string) ?? null;
    },
    staleTime: 60_000,
  });
}

export function useMeuHolerite(competencia: string) {
  const { data: funcId } = useMeuFuncionarioId();
  return useQuery({
    queryKey: ["meu-holerite", funcId, competencia],
    enabled: !!funcId,
    queryFn: async () => {
      const { data, error } = await (supabase as any).rpc("holerite_detalhado", {
        p_funcionario_id: funcId!,
        p_competencia: competencia,
      });
      if (error) throw error;
      const r = unwrap(data);
      if (!r.success) throw new Error(r.error ?? "Erro");
      return r as HoleriteDetalhadoData;
    },
    staleTime: 0,
  });
}
