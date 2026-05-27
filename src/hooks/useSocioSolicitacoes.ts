import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type TipoLancamento = "credito" | "debito" | "pro_labore" | "ajuste";

export type VotoSolicitacao = {
  socio_id: string;
  nome: string;
  voto: "aprovado" | "rejeitado";
  motivo?: string | null;
  voted_at?: string | null;
};

export type SolicitacaoPendente = {
  id: string;
  tipo: TipoLancamento;
  valor: number;
  data_referencia: string;
  descricao: string;
  socio_destino_id: string;
  socio_destino_nome: string;
  criado_por_socio_id: string;
  criado_por_nome: string;
  created_at: string;
  status: string;
  votos_atuais: number;
  votos_necessarios: number;
  eu_ja_votei: boolean;
  eu_criei: boolean;
  votos: VotoSolicitacao[];
};

export type SolicitacoesData = {
  success: boolean;
  meu_socio_id: string;
  solicitacoes: SolicitacaoPendente[];
};

export function useSolicitacoesPendentes() {
  return useQuery<SolicitacoesData>({
    queryKey: ["solicitacoes-pendentes"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_solicitacoes_pendentes" as any);
      if (error) throw error;
      return data as unknown as SolicitacoesData;
    },
    refetchInterval: 60_000,
  });
}

const invalidarTudo = (qc: ReturnType<typeof useQueryClient>) => {
  qc.invalidateQueries({ queryKey: ["solicitacoes-pendentes"] });
  qc.invalidateQueries({ queryKey: ["painel-socio-contas"] });
  qc.invalidateQueries({ queryKey: ["painel-socio"] });
  qc.invalidateQueries({ queryKey: ["extrato-socio"] });
  qc.invalidateQueries({ queryKey: ["socio-notificacoes"] });
};

export function useSolicitarLancamento() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      socio_destino: string;
      tipo: TipoLancamento;
      valor: number;
      data_referencia: string;
      descricao: string;
    }) => {
      const { data, error } = await supabase.rpc("solicitar_lancamento" as any, {
        p_socio_destino: input.socio_destino,
        p_tipo: input.tipo,
        p_valor: input.valor,
        p_data_referencia: input.data_referencia,
        p_descricao: input.descricao,
      });
      if (error) throw error;
      const r = data as any;
      if (!r?.success) throw new Error(r?.error || "Erro ao criar solicitação");
      return r;
    },
    onSuccess: () => invalidarTudo(qc),
  });
}

export function useVotarSolicitacao() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      solicitacao_id: string;
      voto: "aprovado" | "rejeitado";
      motivo?: string;
    }) => {
      const { data, error } = await supabase.rpc("votar_solicitacao" as any, {
        p_solicitacao_id: input.solicitacao_id,
        p_voto: input.voto,
        p_motivo: input.motivo ?? null,
      });
      if (error) throw error;
      const r = data as any;
      if (!r?.success) throw new Error(r?.error || "Erro ao votar");
      return r;
    },
    onSuccess: () => invalidarTudo(qc),
  });
}

export function useCancelarSolicitacao() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (solicitacao_id: string) => {
      const { data, error } = await supabase.rpc("cancelar_solicitacao" as any, {
        p_solicitacao_id: solicitacao_id,
      });
      if (error) throw error;
      const r = data as any;
      if (!r?.success) throw new Error(r?.error || "Erro ao cancelar");
      return r;
    },
    onSuccess: () => invalidarTudo(qc),
  });
}

// ===== Notificações do sócio =====

export type SocioNotificacao = {
  id: string;
  tipo: string;
  titulo: string;
  mensagem: string;
  link_interno: string | null;
  lida: boolean;
  created_at: string;
};

export type SocioNotificacoesData = {
  success: boolean;
  nao_lidas: number;
  notificacoes: SocioNotificacao[];
};

export function useSocioNotificacoes(apenasNaoLidas = false) {
  return useQuery<SocioNotificacoesData>({
    queryKey: ["socio-notificacoes", apenasNaoLidas],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_notificacoes" as any, {
        p_apenas_nao_lidas: apenasNaoLidas,
      });
      if (error) throw error;
      return data as unknown as SocioNotificacoesData;
    },
    refetchInterval: 60_000,
    retry: false,
  });
}

export function useMarcarSocioNotificacao() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string | null) => {
      const { data, error } = await supabase.rpc("marcar_notificacao_lida" as any, {
        p_id: id,
      });
      if (error) throw error;
      const r = data as any;
      if (!r?.success) throw new Error(r?.error || "Erro");
      return r;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["socio-notificacoes"] });
    },
  });
}

export function useEhSocio() {
  return useQuery({
    queryKey: ["eh-socio"],
    queryFn: async () => {
      const { data } = await supabase.rpc("get_notificacoes" as any, { p_apenas_nao_lidas: true });
      return !!(data as any)?.success;
    },
    staleTime: 5 * 60 * 1000,
    retry: false,
  });
}
