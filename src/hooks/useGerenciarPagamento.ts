import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface DadosPagamentoEditavel {
  valor?: number;
  data_pagamento?: string;
  forma_pagamento?: string;
  observacoes?: string | null;
}

function invalidarRelacionados(qc: ReturnType<typeof useQueryClient>, clienteId?: string) {
  qc.invalidateQueries({ queryKey: ["pagamentos-cliente"] });
  qc.invalidateQueries({ queryKey: ["saldo-cliente"] });
  qc.invalidateQueries({ queryKey: ["clientes-saldos"] });
  qc.invalidateQueries({ queryKey: ["extrato-cliente"] });
  qc.invalidateQueries({ queryKey: ["financeiro"] });
  if (clienteId) qc.invalidateQueries({ queryKey: ["cliente", clienteId] });
}

export function useEditarPagamento() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: {
      pagamentoId: string;
      dados: DadosPagamentoEditavel;
      motivo?: string;
      clienteId?: string;
    }) => {
      const { data, error } = await supabase.rpc("editar_pagamento_cliente", {
        p_pagamento_id: args.pagamentoId,
        p_dados: args.dados as never,
        p_motivo: args.motivo ?? null,
      });
      if (error) throw error;
      const r = data as { success?: boolean; error?: string } | null;
      if (!r?.success) throw new Error(r?.error ?? "Erro ao editar");
      return r;
    },
    onSuccess: (_, vars) => {
      invalidarRelacionados(qc, vars.clienteId);
      toast.success("Pagamento atualizado");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useExcluirPagamento() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: { pagamentoId: string; motivo?: string; clienteId?: string }) => {
      const { data, error } = await supabase.rpc("excluir_pagamento_cliente", {
        p_pagamento_id: args.pagamentoId,
        p_motivo: args.motivo ?? null,
      });
      if (error) throw error;
      const r = data as { success?: boolean; error?: string } | null;
      if (!r?.success) throw new Error(r?.error ?? "Erro ao excluir");
      return r;
    },
    onSuccess: (_, vars) => {
      invalidarRelacionados(qc, vars.clienteId);
      toast.success("Pagamento excluído");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}
