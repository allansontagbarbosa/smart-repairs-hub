import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type ExtratoClienteItem = {
  data: string;
  tipo: "os" | "pagamento";
  referencia_id: string;
  descricao: string;
  debito: number;
  credito: number;
  saldo_apos: number;
};

export function useExtratoCliente(clienteId: string, inicio?: string, fim?: string) {
  return useQuery({
    enabled: !!clienteId,
    queryKey: ["extrato-cliente", clienteId, inicio, fim],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_extrato_cliente", {
        p_cliente_id: clienteId,
        p_inicio: inicio ?? null,
        p_fim: fim ?? null,
      });

      if (error) throw error;
      return (data ?? []) as ExtratoClienteItem[];
    },
  });
}