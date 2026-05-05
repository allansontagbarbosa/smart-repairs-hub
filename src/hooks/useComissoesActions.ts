import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

function invalidate(qc: ReturnType<typeof useQueryClient>) {
  qc.invalidateQueries({ queryKey: ["comissoes"] });
  qc.invalidateQueries({ queryKey: ["minhas-comissoes"] });
  qc.invalidateQueries({ queryKey: ["minhas-comissoes-resumo"] });
  qc.invalidateQueries({ queryKey: ["financeiro"] });
  qc.invalidateQueries({ queryKey: ["desempenho-tecnicos"] });
  qc.invalidateQueries({ queryKey: ["comissoes-tecnico-periodo"] });
}

export function useLiberarComissao() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data, error } = await supabase.rpc("liberar_comissao", { p_comissao_id: id });
      if (error) throw error;
      if (typeof data === "object" && data && "success" in data && !data.success) {
        throw new Error(typeof data.error === "string" ? data.error : "Erro ao liberar");
      }
      return data;
    },
    onSuccess: () => {
      toast.success("Comissão liberada");
      invalidate(qc);
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function usePagarComissao() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data, error } = await supabase.rpc("pagar_comissao", { p_comissao_id: id });
      if (error) throw error;
      if (typeof data === "object" && data && "success" in data && !data.success) {
        throw new Error(typeof data.error === "string" ? data.error : "Erro ao pagar");
      }
      return data;
    },
    onSuccess: (data: any) => {
      toast.success(`Comissão paga: R$ ${Number(data?.valor_pago ?? 0).toFixed(2)}`);
      invalidate(qc);
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function usePagarComissoesLote() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (ids: string[]) => {
      const { data, error } = await supabase.rpc("pagar_comissoes_em_lote", { p_comissao_ids: ids });
      if (error) throw error;
      return data;
    },
    onSuccess: (data: any) => {
      toast.success(`${data?.count_pagas || 0} comissões pagas. Total: R$ ${Number(data?.total_pago ?? 0).toFixed(2)}`);
      if (data?.count_erros > 0) toast.warning(`${data.count_erros} comissões falharam`);
      invalidate(qc);
    },
    onError: (err: Error) => toast.error(err.message),
  });
}
