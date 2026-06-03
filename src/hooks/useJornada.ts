import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type JornadaDia = {
  dia_semana: number;
  ent1: string | null;
  sai1: string | null;
  ent2: string | null;
  sai2: string | null;
  horas_previstas: number | null;
  folga: boolean;
};

const unwrap = (d: unknown) => (d ?? {}) as { success?: boolean; error?: string } & Record<string, any>;

export function useJornadaFuncionario(funcionarioId: string | null) {
  return useQuery({
    queryKey: ["rh", "jornada", funcionarioId],
    enabled: !!funcionarioId,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("jornada_listar", { p_funcionario_id: funcionarioId! });
      if (error) throw error;
      const r = unwrap(data);
      if (!r.success) throw new Error(r.error ?? "Erro");
      return (r.jornada ?? []) as JornadaDia[];
    },
    staleTime: 0,
  });
}

export function useSalvarJornada() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { funcionario_id: string; jornada: JornadaDia[] }) => {
      const { data, error } = await supabase.rpc("jornada_salvar", {
        p_funcionario_id: input.funcionario_id,
        p_jornada: input.jornada as any,
      });
      if (error) throw error;
      const r = unwrap(data);
      if (!r.success) throw new Error(r.error ?? "Erro");
      return r;
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["rh", "jornada", vars.funcionario_id] });
      qc.invalidateQueries({ queryKey: ["rh", "banco_horas"] });
    },
  });
}

export function useMeuBancoHoras(competencia: string) {
  return useQuery({
    queryKey: ["meu", "banco_horas", competencia],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("meu_banco_horas", { p_competencia: competencia });
      if (error) throw error;
      const r = unwrap(data);
      if (!r.success) throw new Error(r.error ?? "Erro");
      return r;
    },
    staleTime: 0,
  });
}

export function useMeuEspelhoPonto(competencia: string) {
  return useQuery({
    queryKey: ["meu", "espelho_ponto", competencia],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("meu_espelho_ponto", { p_competencia: competencia });
      if (error) throw error;
      const r = unwrap(data);
      if (!r.success) throw new Error(r.error ?? "Erro");
      return r;
    },
    staleTime: 0,
  });
}
