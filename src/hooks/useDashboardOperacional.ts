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
      const { data: rpcRaw, error: rpcError } = await supabase.rpc(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        "get_dashboard_operacional" as any
      );

      console.log("[DashboardDebug] RPC raw response:", rpcRaw);
      console.log("[DashboardDebug] RPC error:", rpcError);

      if (rpcError) {
        throw new Error(`Erro Supabase: ${rpcError.message}`);
      }

      const response = rpcRaw as unknown as { success?: boolean; data?: DashboardOperacional; error?: string };

      console.log("[DashboardDebug] response.success:", response?.success);
      console.log("[DashboardDebug] response.data type:", typeof response?.data);
      console.log("[DashboardDebug] response.data.bancadas:", response?.data?.bancadas);
      console.log("[DashboardDebug] bancadas isArray:", Array.isArray(response?.data?.bancadas));
      console.log("[DashboardDebug] bancadas length:", response?.data?.bancadas?.length);

      if (!response?.success) {
        throw new Error(response?.error || "Resposta da RPC sem 'success: true'");
      }

      if (!response.data) {
        throw new Error("Resposta da RPC sem campo 'data'");
      }

      const normalized: DashboardOperacional = {
        bancadas: Array.isArray(response.data.bancadas) ? response.data.bancadas : [],
        contadores: response.data.contadores ?? {
          recebido: 0, em_analise: 0, aprovacao: 0, em_reparo: 0,
          aguardando_peca: 0, pronto: 0, entregue_hoje: 0, total_em_casa: 0
        },
        caixa_hoje: response.data.caixa_hoje ?? { entrada_hoje: 0, qtd_os_pagas: 0 },
        lucro_mes: response.data.lucro_mes ?? {
          regime: "competencia", receita: 0, custo_pecas: 0,
          custo_comissao: 0, lucro: 0, margem_pct: 0
        },
        estoque: response.data.estoque ?? { total_pecas: 0, zeradas: 0 },
        ranking: response.data.ranking ?? { mes: 0, ano: 0, tecnicos: [] },
        atualizado_em: response.data.atualizado_em ?? new Date().toISOString(),
      };

      console.log("[DashboardDebug] normalized bancadas length:", normalized.bancadas.length);
      console.log("[DashboardDebug] normalized ranking.mes:", normalized.ranking.mes);
      console.log("[DashboardDebug] normalized contadores:", normalized.contadores);

      setData(normalized);
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
