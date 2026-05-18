import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface PecaUtilizadaItem {
  id: string;
  ordem_id: string;
  peca_id: string;
  quantidade: number;
  custo_unitario: number;
  preco_unitario: number;
  origem_servico_id: string | null;
  created_at: string;
  estoque_itens?: {
    id: string;
    nome: string;
    sku?: string | null;
    quantidade: number;
    custo_medio?: number | null;
    preco_venda?: number | null;
  } | null;
}

export interface PecaDisponivel {
  id: string;
  nome: string;
  sku: string | null;
  quantidade: number;
  custo_medio: number | null;
  preco_venda: number | null;
}

export function usePecasUtilizadasDaOS(ordemId: string | undefined) {
  return useQuery<PecaUtilizadaItem[]>({
    queryKey: ["pecas-utilizadas-os", ordemId],
    enabled: !!ordemId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pecas_utilizadas")
        .select(`
          id, ordem_id, peca_id, quantidade, custo_unitario, preco_unitario,
          origem_servico_id, created_at,
          estoque_itens:peca_id (id, nome, sku, quantidade, custo_medio, preco_venda)
        `)
        .eq("ordem_id", ordemId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data as any) ?? [];
    },
  });
}

export function usePecasDisponiveis() {
  return useQuery<PecaDisponivel[]>({
    queryKey: ["pecas-disponiveis-catalogo"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("estoque_itens")
        .select("id, nome, sku, quantidade, custo_medio, preco_venda")
        .eq("tipo_item", "peca")
        .eq("ativo", true)
        .is("deleted_at", null)
        .order("nome", { ascending: true });
      if (error) throw error;
      return (data as any) ?? [];
    },
  });
}

export function useAdicionarPecaNaOS() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: {
      ordem_id: string;
      peca_id: string;
      quantidade: number;
      custo_unitario: number;
      preco_unitario: number;
      origem_servico_id?: string | null;
    }) => {
      const { data, error } = await supabase
        .from("pecas_utilizadas")
        .insert({
          ordem_id: params.ordem_id,
          peca_id: params.peca_id,
          quantidade: params.quantidade,
          custo_unitario: params.custo_unitario,
          preco_unitario: params.preco_unitario,
          origem_servico_id: params.origem_servico_id ?? null,
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["pecas-utilizadas-os", vars.ordem_id] });
      qc.invalidateQueries({ queryKey: ["pecas-disponiveis-catalogo"] });
      qc.invalidateQueries({ queryKey: ["estoque_itens"] });
    },
  });
}

export function useRemoverPecaDaOS() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: { id: string; ordem_id: string }) => {
      const { error } = await supabase
        .from("pecas_utilizadas")
        .delete()
        .eq("id", params.id);
      if (error) throw error;
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["pecas-utilizadas-os", vars.ordem_id] });
      qc.invalidateQueries({ queryKey: ["pecas-disponiveis-catalogo"] });
      qc.invalidateQueries({ queryKey: ["estoque_itens"] });
    },
  });
}
