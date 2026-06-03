import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface Dependente {
  id: string;
  funcionario_id: string;
  nome: string;
  data_nascimento: string | null;
  parentesco: string | null;
  cpf: string | null;
  conta_irrf: boolean;
  conta_salario_familia: boolean;
}

export function useDependentes(funcionarioId: string | null) {
  return useQuery({
    queryKey: ["rh", "dependentes", funcionarioId],
    enabled: !!funcionarioId,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("funcionario_dependentes")
        .select("*")
        .eq("funcionario_id", funcionarioId)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as Dependente[];
    },
  });
}

export function useSalvarDependente() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      id?: string;
      funcionario_id: string;
      empresa_id: string;
      nome: string;
      data_nascimento: string | null;
      parentesco: string | null;
      cpf: string | null;
      conta_irrf: boolean;
      conta_salario_familia: boolean;
    }) => {
      const payload: any = { ...input };
      if (input.id) {
        const { id, ...rest } = payload;
        const { error } = await (supabase as any)
          .from("funcionario_dependentes")
          .update(rest)
          .eq("id", id);
        if (error) throw error;
      } else {
        const { error } = await (supabase as any)
          .from("funcionario_dependentes")
          .insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: (_d, v) => qc.invalidateQueries({ queryKey: ["rh", "dependentes", v.funcionario_id] }),
  });
}

export function useRemoverDependente() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { id: string; funcionario_id: string }) => {
      const { error } = await (supabase as any)
        .from("funcionario_dependentes")
        .delete()
        .eq("id", input.id);
      if (error) throw error;
    },
    onSuccess: (_d, v) => qc.invalidateQueries({ queryKey: ["rh", "dependentes", v.funcionario_id] }),
  });
}
