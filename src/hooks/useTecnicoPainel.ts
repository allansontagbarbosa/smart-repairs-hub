import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface KpisAvancado {
  qtd_concluidas: number;
  qtd_concluidas_hoje: number;
  qtd_concluidas_mes_passado: number;
  variacao_pct_vs_mes_passado: number | null;
  tempo_medio_min: number;
  taxa_retrabalho_pct: number;
  sequencia_dias: number;
  meta: {
    meta_qtd_os: number;
    meta_faturamento: number;
  } | null;
}

export function useTecnicoKpisAvancado(funcionarioId: string | undefined | null) {
  return useQuery<KpisAvancado | null>({
    queryKey: ["tecnico-kpis-avancado", funcionarioId],
    enabled: !!funcionarioId,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_tecnico_kpis_avancado" as any, {
        p_funcionario_id: funcionarioId,
      });
      if (error) throw error;
      const resp = data as { success?: boolean; data?: KpisAvancado; error?: string };
      if (!resp?.success) throw new Error(resp?.error ?? "Erro ao buscar KPIs");
      return resp.data ?? null;
    },
  });
}

export interface SessaoAtual {
  id: string;
  funcionario_id: string;
  status: "trabalhando" | "pausa" | "almoco";
  iniciado_em: string;
}

export function useMinhaSessao() {
  return useQuery<SessaoAtual | null>({
    queryKey: ["minha-sessao-atual"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_minha_sessao_atual" as any);
      if (error) throw error;
      const resp = data as { success?: boolean; data?: SessaoAtual };
      return resp?.data ?? null;
    },
  });
}

export function useTrocarMeuStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (novoStatus: "trabalhando" | "pausa" | "almoco" | "encerrado") => {
      const { data, error } = await supabase.rpc("trocar_meu_status" as any, {
        p_novo_status: novoStatus,
      });
      if (error) throw error;
      const resp = data as { success?: boolean; error?: string };
      if (!resp?.success) throw new Error(resp?.error ?? "Erro ao trocar status");
      return resp;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["minha-sessao-atual"] });
    },
  });
}

export function usePegarOS() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (osId: string) => {
      const { data, error } = await supabase.rpc("pegar_os" as any, { p_os_id: osId });
      if (error) throw error;
      const resp = data as { success?: boolean; error?: string };
      if (!resp?.success) throw new Error(resp?.error ?? "Erro ao pegar OS");
      return resp;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tecnico-minhas-os"] });
      qc.invalidateQueries({ queryKey: ["tecnico-kpis-avancado"] });
    },
  });
}
