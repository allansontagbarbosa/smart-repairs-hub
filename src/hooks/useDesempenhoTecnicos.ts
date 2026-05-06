import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface KpiTecnico {
  funcionario_id: string;
  nome: string;
  qtd_servicos: number;
  qtd_os: number;
  valor_servicos: number;
  faturamento_os: number;
  tempo_medio_horas: number;
  comissao_pendente: number;
  comissao_liberada: number;
  comissao_paga: number;
  comissao_total_a_receber: number;
  ticket_medio_os: number;
}

export interface ComissaoDetalhe {
  comissao_id: string;
  valor: number;
  status: "pendente" | "liberada" | "paga" | "estornada";
  mes_competencia: string | null;
  data_pagamento: string | null;
  created_at: string;
  os_numero: number | null;
  os_numero_formatado: string | null;
  servico_nome: string | null;
  aparelho: string | null;
  cliente_nome: string | null;
}

export function useDesempenhoTecnicos(inicio: Date, fim: Date, lojaId?: string | null) {
  return useQuery({
    queryKey: ["desempenho-tecnicos", inicio.toISOString(), fim.toISOString(), lojaId ?? null],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("kpi_tecnicos" as any, {
        p_inicio: inicio.toISOString(),
        p_fim: fim.toISOString(),
        p_loja_id: lojaId ?? null,
      });
      if (error) throw error;
      const payload = data as any;
      if (!payload?.success) throw new Error(payload?.error || "Falha ao carregar");
      return (payload.tecnicos ?? []) as KpiTecnico[];
    },
  });
}

export function useComissoesTecnicoPeriodo(
  funcionarioId: string | null,
  inicio: Date,
  fim: Date,
) {
  return useQuery({
    queryKey: ["comissoes-tecnico-periodo", funcionarioId, inicio.toISOString(), fim.toISOString()],
    enabled: !!funcionarioId,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("comissoes_tecnico_periodo" as any, {
        p_funcionario_id: funcionarioId!,
        p_inicio: inicio.toISOString(),
        p_fim: fim.toISOString(),
      });
      if (error) throw error;
      const payload = data as any;
      if (!payload?.success) throw new Error(payload?.error || "Falha ao carregar");
      return (payload.comissoes ?? []) as ComissaoDetalhe[];
    },
  });
}
