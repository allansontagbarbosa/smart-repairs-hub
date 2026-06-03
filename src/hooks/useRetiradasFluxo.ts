import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type RetiradaFluxoStatus = "pendente" | "aprovada" | "rejeitada" | "cancelada" | "efetivada";

export type RetiradaFluxo = {
  id: string;
  socio_id: string;
  socio_user_id: string | null;
  socio_nome: string;
  valor: number;
  descricao: string | null;
  status: RetiradaFluxoStatus;
  data_retirada: string;
  criado_por: string | null;
  criado_em: string;
  aprovado_por: string | null;
  aprovado_em: string | null;
  motivo_rejeicao: string | null;
  motivo_cancelamento: string | null;
  pode_aprovar: boolean;
  pode_cancelar: boolean;
};

const invalidar = (qc: ReturnType<typeof useQueryClient>) => {
  qc.invalidateQueries({ queryKey: ["socio-retiradas-fluxo"] });
  qc.invalidateQueries({ queryKey: ["painel-socio-contas"] });
  qc.invalidateQueries({ queryKey: ["painel-socio"] });
  qc.invalidateQueries({ queryKey: ["extrato-socio"] });
};

export function useRetiradasFluxo() {
  return useQuery<RetiradaFluxo[]>({
    queryKey: ["socio-retiradas-fluxo"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("socio_retiradas_listar" as any);
      if (error) throw error;
      return (data as any[]) ?? [];
    },
    refetchInterval: 60_000,
  });
}

export function useSolicitarRetirada() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { socio_id: string; valor: number; descricao?: string | null }) => {
      const { data, error } = await supabase.rpc("socio_retirada_solicitar" as any, {
        p_socio_id: input.socio_id,
        p_valor: input.valor,
        p_descricao: input.descricao ?? null,
      });
      if (error) throw error;
      const r = data as any;
      if (!r?.success) throw new Error(r?.error || "Erro ao solicitar retirada");
      return r;
    },
    onSuccess: () => invalidar(qc),
  });
}

export function useAprovarRetirada() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data, error } = await supabase.rpc("socio_retirada_aprovar" as any, { p_id: id });
      if (error) throw error;
      const r = data as any;
      if (!r?.success) throw new Error(r?.error || "Erro ao aprovar");
      return r;
    },
    onSuccess: () => invalidar(qc),
  });
}

export function useRejeitarRetirada() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { id: string; motivo?: string }) => {
      const { data, error } = await supabase.rpc("socio_retirada_rejeitar" as any, {
        p_id: input.id,
        p_motivo: input.motivo ?? null,
      });
      if (error) throw error;
      const r = data as any;
      if (!r?.success) throw new Error(r?.error || "Erro ao rejeitar");
      return r;
    },
    onSuccess: () => invalidar(qc),
  });
}

export function useCancelarRetirada() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { id: string; motivo?: string }) => {
      const { data, error } = await supabase.rpc("socio_retirada_cancelar" as any, {
        p_id: input.id,
        p_motivo: input.motivo ?? null,
      });
      if (error) throw error;
      const r = data as any;
      if (!r?.success) throw new Error(r?.error || "Erro ao cancelar");
      return r;
    },
    onSuccess: () => invalidar(qc),
  });
}
