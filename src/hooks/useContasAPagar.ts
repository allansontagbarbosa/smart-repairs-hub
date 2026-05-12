import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type FormaPagamentoConta = "pix" | "dinheiro" | "cartao" | "transferencia";

export interface PagamentoConta {
  id: string;
  valor_centavos: number;
  data_pagamento: string;
  forma_pagamento: FormaPagamentoConta;
  observacao: string | null;
  created_at: string;
  estornado_em: string | null;
}

const invalidateAll = (qc: ReturnType<typeof useQueryClient>) => {
  qc.invalidateQueries({ queryKey: ["contas_pagar"] });
  qc.invalidateQueries({ queryKey: ["contas-a-pagar"] });
  qc.invalidateQueries({ queryKey: ["financeiro"] });
  qc.invalidateQueries({ queryKey: ["movimentacoes"] });
};

export function useRegistrarPagamento() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      conta_pagar_id: string;
      valor_centavos: number;
      forma_pagamento: FormaPagamentoConta;
      data_pagamento?: string;
      observacao?: string;
    }) => {
      const { data, error } = await (supabase as any).rpc("registrar_pagamento_conta", {
        p_conta_pagar_id: input.conta_pagar_id,
        p_valor_centavos: input.valor_centavos,
        p_forma_pagamento: input.forma_pagamento,
        p_data_pagamento: input.data_pagamento ?? new Date().toISOString().slice(0, 10),
        p_observacao: input.observacao ?? null,
      });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error ?? "Erro");
      return data as {
        success: true;
        pagamento_id: string;
        movimentacao_id: string;
        valor_pago_centavos: number;
        valor_restante_centavos: number;
        novo_status: "paga" | "parcial";
      };
    },
    onSuccess: () => invalidateAll(qc),
  });
}

export function useHistoricoPagamentos(contaId: string | null) {
  return useQuery({
    queryKey: ["contas-a-pagar", contaId, "pagamentos"],
    enabled: !!contaId,
    queryFn: async () => {
      const { data, error } = await (supabase as any).rpc("historico_pagamentos_conta", {
        p_conta_pagar_id: contaId,
      });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error ?? "Erro");
      return (data.pagamentos ?? []) as PagamentoConta[];
    },
  });
}

export function useEstornarPagamento() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (pagamento_id: string) => {
      const { data, error } = await (supabase as any).rpc("estornar_pagamento_conta", {
        p_pagamento_id: pagamento_id,
      });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error ?? "Erro");
      return data;
    },
    onSuccess: () => invalidateAll(qc),
  });
}
