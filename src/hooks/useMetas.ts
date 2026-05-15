import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type MetricaMeta =
  | "faturamento" | "qtd_os" | "qtd_servicos" | "ticket_medio" | "comissao_paga"
  | "margem_os" | "tempo_medio_horas" | "retrabalho_taxa"
  | "aprovacao_orcamento_taxa" | "retorno_cliente_30d";

export type EscopoMeta = "empresa" | "tecnico" | "loja";
export type StatusMeta = "ativa" | "pausada" | "concluida_sucesso" | "concluida_falha";
export type SentidoMeta = "maior" | "menor";
export type StatusVisual = "verde" | "amarelo" | "cinza" | "vermelho";

export interface MetaProgresso {
  meta_id: string;
  valor_atual: number;
  valor_alvo: number;
  percentual: number;
  status_visual: StatusVisual;
  periodo_inicio: string;
  periodo_fim: string;
  dias_restantes: number;
  sentido: SentidoMeta;
  metrica: MetricaMeta;
}

export interface Meta {
  id: string;
  nome: string;
  descricao: string | null;
  metrica: MetricaMeta;
  sentido: SentidoMeta;
  periodo_inicio: string;
  periodo_fim: string;
  escopo: EscopoMeta;
  escopo_id: string | null;
  valor_alvo: number;
  valor_atual: number;
  threshold_atencao: number;
  threshold_alerta: number;
  status: StatusMeta;
  created_at: string;
  progresso: { success: boolean } & MetaProgresso;
}

export interface NovaMeta {
  nome: string;
  descricao?: string | null;
  metrica: MetricaMeta;
  sentido: SentidoMeta;
  periodo_inicio: string;
  periodo_fim: string;
  escopo: EscopoMeta;
  escopo_id: string | null;
  valor_alvo: number;
  threshold_atencao?: number;
  threshold_alerta?: number;
}

export const METRICAS_LABEL: Record<MetricaMeta, { label: string; sentido: SentidoMeta; unidade: "moeda"|"qtd"|"percentual"|"horas" }> = {
  faturamento: { label: "Faturamento", sentido: "maior", unidade: "moeda" },
  qtd_os: { label: "Qtd. de OSs concluídas", sentido: "maior", unidade: "qtd" },
  qtd_servicos: { label: "Qtd. de serviços", sentido: "maior", unidade: "qtd" },
  ticket_medio: { label: "Ticket médio", sentido: "maior", unidade: "moeda" },
  comissao_paga: { label: "Comissão paga", sentido: "maior", unidade: "moeda" },
  margem_os: { label: "Margem média por OS", sentido: "maior", unidade: "moeda" },
  tempo_medio_horas: { label: "Tempo médio (h)", sentido: "menor", unidade: "horas" },
  retrabalho_taxa: { label: "Retrabalho (%)", sentido: "menor", unidade: "percentual" },
  aprovacao_orcamento_taxa: { label: "Aprovação de orçamento (%)", sentido: "maior", unidade: "percentual" },
  retorno_cliente_30d: { label: "Retorno de cliente 30d (%)", sentido: "maior", unidade: "percentual" },
};

type RpcResp = { success?: boolean; error?: string } & Record<string, any>;

export function useMetas(status: StatusMeta | "todas" = "ativa") {
  return useQuery({
    queryKey: ["metas", status],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("listar_metas_com_progresso", { p_status: status === "todas" ? null : status });
      if (error) throw error;
      const p = (data ?? {}) as RpcResp;
      if (!p?.success) throw new Error(p?.error || "Falha");
      return (p.metas ?? []) as Meta[];
    },
    staleTime: 30_000,
  });
}

export function useMetaProgresso(metaId: string | null) {
  return useQuery({
    queryKey: ["meta-progresso", metaId],
    enabled: !!metaId,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("calcular_progresso_meta", { p_meta_id: metaId! });
      if (error) throw error;
      const p = (data ?? {}) as RpcResp;
      if (!p?.success) throw new Error(p?.error || "Falha");
      return p as MetaProgresso & { success: boolean };
    },
  });
}

export function useCriarMeta() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (meta: NovaMeta) => {
      const { data: empresa } = await supabase.rpc("get_my_empresa_id");
      const { data, error } = await supabase.from("metas").insert({ ...meta, empresa_id: empresa as string, valor_atual: 0 }).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["metas"] }),
  });
}

export function useAtualizarMeta() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...m }: Partial<Meta> & { id: string }) => {
      const { data, error } = await supabase.from("metas").update(m).eq("id", id).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["metas"] }),
  });
}

export function useExcluirMeta() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("metas").update({ deleted_at: new Date().toISOString() }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["metas"] }),
  });
}
