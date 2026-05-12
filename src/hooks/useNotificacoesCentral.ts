import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface NotificacaoCentral {
  id: string;
  tipo: string;
  titulo: string;
  mensagem: string;
  severidade: "info" | "warning" | "critical" | "success";
  lida: boolean;
  referencia_id: string | null;
  referencia_tabela: string | null;
  link: string | null;
  arquivada_em: string | null;
  created_at: string;
}

export function useNotificacoesCentral(limit = 50) {
  return useQuery({
    queryKey: ["notificacoes-central", limit],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("notificacoes" as any)
        .select("*")
        .is("arquivada_em", null)
        .order("created_at", { ascending: false })
        .limit(limit);
      if (error) throw error;
      return (data ?? []) as unknown as NotificacaoCentral[];
    },
    refetchInterval: 60000,
  });
}

export function useContagemNaoLidas() {
  return useQuery({
    queryKey: ["notificacoes-central", "nao-lidas-count"],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("notificacoes" as any)
        .select("*", { count: "exact", head: true })
        .eq("lida", false)
        .is("arquivada_em", null);
      if (error) throw error;
      return count ?? 0;
    },
    refetchInterval: 60000,
  });
}

export function useMarcarNotificacao() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { id: string; acao: "lida" | "nao_lida" | "arquivar" }) => {
      const { data, error } = await (supabase as any).rpc("marcar_notificacao", {
        p_notif_id: input.id,
        p_acao: input.acao,
      });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error ?? "Erro");
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["notificacoes-central"] });
    },
  });
}

export function useMarcarTodasLidas() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { data, error } = await (supabase as any).rpc("marcar_todas_notificacoes_lidas");
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error ?? "Erro");
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["notificacoes-central"] });
    },
  });
}

export function useProcessarNotificacoes() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { data, error } = await (supabase as any).rpc("processar_notificacoes_diarias");
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error ?? "Erro");
      return data as { success: boolean; notificacoes_criadas: number };
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["notificacoes-central"] });
    },
  });
}
