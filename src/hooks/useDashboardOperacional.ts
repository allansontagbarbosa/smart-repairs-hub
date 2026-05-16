import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface Bancada {
  funcionario_id: string;
  nome: string;
  qtd_total: number;
  qtd_recebido: number;
  qtd_em_analise: number;
  qtd_aprovacao: number;
  qtd_em_reparo: number;
  qtd_aguardando_peca: number;
}

export interface Contadores {
  recebido: number;
  em_analise: number;
  aprovacao: number;
  em_reparo: number;
  aguardando_peca: number;
  pronto: number;
  entregue_hoje: number;
  total_em_casa: number;
}

export interface CaixaHoje {
  entrada_hoje: number;
  qtd_os_pagas: number;
}

export interface LucroMes {
  regime: string;
  receita: number;
  custo_pecas: number;
  custo_comissao: number;
  lucro: number;
  margem_pct: number;
}

export interface EstoqueResumo {
  total_pecas: number;
  zeradas: number;
  estoque_baixo?: number;
  coluna_usada?: string;
  aviso?: string;
}

export interface RankingTecnico {
  funcionario_id: string;
  nome: string;
  qtd_concluidas: number;
  faturamento: number;
  meta_qtd: number | null;
  meta_faturamento: number | null;
  pct_qtd: number | null;
  pct_faturamento: number | null;
}

export interface RankingMes {
  mes: number;
  ano: number;
  tecnicos: RankingTecnico[];
}

export interface DashboardOperacional {
  bancadas: Bancada[];
  contadores: Contadores;
  caixa_hoje: CaixaHoje;
  lucro_mes: LucroMes;
  estoque: EstoqueResumo;
  ranking: RankingMes;
  atualizado_em: string;
}

interface RPCResponse {
  success: boolean;
  data?: DashboardOperacional;
  error?: string;
}

interface UseDashboardOperacionalReturn {
  data: DashboardOperacional | null;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  lastFetch: Date | null;
}

export function useDashboardOperacional(): UseDashboardOperacionalReturn {
  const [data, setData] = useState<DashboardOperacional | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [lastFetch, setLastFetch] = useState<Date | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const { data: rpcData, error: rpcError } = await supabase.rpc(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        "get_dashboard_operacional" as any
      );

      if (rpcError) {
        throw new Error(`Erro Supabase: ${rpcError.message}`);
      }

      const response = rpcData as unknown as RPCResponse;

      if (!response?.success) {
        throw new Error(response?.error || "Resposta da RPC sem 'success: true'");
      }

      if (!response.data) {
        throw new Error("Resposta da RPC sem campo 'data'");
      }

      setData(response.data);
      setLastFetch(new Date());
    } catch (err) {
      const message = err instanceof Error ? err.message : "Erro desconhecido";
      setError(message);
      console.error("[useDashboardOperacional]", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return {
    data,
    loading,
    error,
    refetch: fetchData,
    lastFetch,
  };
}
