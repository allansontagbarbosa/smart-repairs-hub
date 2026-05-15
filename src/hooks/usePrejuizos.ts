import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  TipoPrejuizo,
  Prejuizo,
  PrejuizoTipoAgrupado,
  PrejuizoResumoPeriodo,
} from "@/types/prejuizo";

interface FiltrosPrejuizo {
  data_inicio?: string;
  data_fim?: string;
  tipo?: TipoPrejuizo | null;
  origem?: string | null;
}

export function useListarPrejuizos(filtros: FiltrosPrejuizo, page: number = 0) {
  return useQuery({
    queryKey: [
      "prejuizos",
      "list",
      filtros.data_inicio ?? null,
      filtros.data_fim ?? null,
      filtros.tipo ?? null,
      filtros.origem ?? null,
      page,
    ],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("listar_prejuizos", {
        p_data_inicio: filtros.data_inicio || null,
        p_data_fim: filtros.data_fim || null,
        p_tipo: filtros.tipo || null,
        p_origem: filtros.origem || null,
        p_limit: 50,
        p_offset: page * 50,
      });
      if (error) throw error;
      const r = (data ?? {}) as { success?: boolean; error?: string; [k: string]: any };
      if (!r?.success) throw new Error(r?.error ?? "Erro");
      return {
        total: r.total as number,
        prejuizos: (r.prejuizos ?? []) as Prejuizo[],
      };
    },
    staleTime: 0,
  });
}

export function useResumoPrejuizos(data_inicio?: string, data_fim?: string) {
  return useQuery({
    queryKey: ["prejuizos", "resumo", data_inicio ?? null, data_fim ?? null],
    queryFn: async () => {
      const { data, error } = await supabase.rpc(
        "prejuizos_resumo_periodo",
        {
          p_data_inicio: data_inicio || null,
          p_data_fim: data_fim || null,
        }
      );
      if (error) throw error;
      const r = (data ?? {}) as { success?: boolean; error?: string; [k: string]: any };
      if (!r?.success) throw new Error(r?.error ?? "Erro");
      return r as PrejuizoResumoPeriodo & { success: boolean };
    },
    staleTime: 0,
  });
}

export function usePrejuizosPorTipo(data_inicio?: string, data_fim?: string) {
  return useQuery({
    queryKey: ["prejuizos", "por-tipo", data_inicio ?? null, data_fim ?? null],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("prejuizos_por_tipo", {
        p_data_inicio: data_inicio || null,
        p_data_fim: data_fim || null,
      });
      if (error) throw error;
      const r = (data ?? {}) as { success?: boolean; error?: string; [k: string]: any };
      if (!r?.success) throw new Error(r?.error ?? "Erro");
      return (r.tipos ?? []) as PrejuizoTipoAgrupado[];
    },
    staleTime: 0,
  });
}

export interface CriarPrejuizoInput {
  tipo: TipoPrejuizo;
  valor_centavos: number;
  descricao?: string;
  observacoes?: string;
  os_origem_id?: string;
  os_retrabalho_id?: string;
  data_evento?: string;
}

export function useCriarPrejuizo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: CriarPrejuizoInput) => {
      const { data, error } = await supabase.rpc("criar_prejuizo", {
        p_tipo: input.tipo,
        p_valor_centavos: input.valor_centavos,
        p_descricao: input.descricao || null,
        p_observacoes: input.observacoes || null,
        p_os_origem_id: input.os_origem_id || null,
        p_os_retrabalho_id: input.os_retrabalho_id || null,
        p_data_evento: input.data_evento || null,
        p_origem: "manual",
      });
      if (error) throw error;
      const r = (data ?? {}) as { success?: boolean; error?: string; [k: string]: any };
      if (!r?.success) throw new Error(r?.error ?? "Erro ao criar prejuízo");
      return r;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["prejuizos"] });
      qc.invalidateQueries({ queryKey: ["movimentacoes-financeiras"] });
      qc.invalidateQueries({ queryKey: ["dre"] });
    },
  });
}

export function useDeletarPrejuizo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data: prejuizo } = await supabase
        .from("prejuizos")
        .select("movimentacao_financeira_id")
        .eq("id", id)
        .single();

      const { error } = await supabase
        .from("prejuizos")
        .update({ deleted_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;

      const movId = (prejuizo as { movimentacao_financeira_id?: string } | null)?.movimentacao_financeira_id;
      if (movId) {
        await supabase
          .from("movimentacoes_financeiras")
          .update({ estornada_em: new Date().toISOString() })
          .eq("id", movId);
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["prejuizos"] });
      qc.invalidateQueries({ queryKey: ["movimentacoes-financeiras"] });
    },
  });
}
