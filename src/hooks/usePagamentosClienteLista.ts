import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type PagamentoClienteLista = Database["public"]["Tables"]["pagamentos_clientes"]["Row"];

export function usePagamentosClienteLista(clienteId: string) {
  return useQuery({
    enabled: !!clienteId,
    queryKey: ["pagamentos-cliente", clienteId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pagamentos_clientes")
        .select("*")
        .eq("cliente_id", clienteId)
        .is("deleted_at", null)
        .order("data_pagamento", { ascending: false });

      if (error) throw error;
      return (data ?? []) as PagamentoClienteLista[];
    },
  });
}