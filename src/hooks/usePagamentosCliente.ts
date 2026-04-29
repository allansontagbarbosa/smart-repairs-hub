import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export function useCriarPagamentoCliente() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (params: {
      cliente_id: string;
      valor: number;
      forma_pagamento?: string;
      data_pagamento?: string;
      observacoes?: string;
    }) => {
      const { data, error } = await supabase.rpc("criar_pagamento_cliente", {
        p_cliente_id: params.cliente_id,
        p_valor: params.valor,
        p_forma: params.forma_pagamento ?? "pix",
        p_data: params.data_pagamento ?? new Date().toISOString().split("T")[0],
        p_obs: params.observacoes ?? null,
      });

      if (error) throw error;
      if (!data || typeof data !== "object" || !(data as { success?: boolean }).success) {
        throw new Error((data as { error?: string } | null)?.error || "Erro ao registrar pagamento");
      }
      return data as { success: boolean; saldo_devedor_atual?: number; pagamento_id?: string };
    },
    onSuccess: (data, params) => {
      const valor = Number(params.valor ?? 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
      const saldo = Number(data.saldo_devedor_atual ?? 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
      toast.success(`Pagamento de ${valor} registrado. Saldo atual: ${saldo}`);
      qc.invalidateQueries({ queryKey: ["clientes-saldos"] });
      qc.invalidateQueries({ queryKey: ["saldo-cliente"] });
      qc.invalidateQueries({ queryKey: ["extrato-cliente"] });
      qc.invalidateQueries({ queryKey: ["pagamentos-cliente"] });
      qc.invalidateQueries({ queryKey: ["financeiro"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });
}
