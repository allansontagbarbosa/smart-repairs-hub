import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type ClienteSaldoResumo = {
  cliente_id: string;
  id: string;
  nome: string;
  telefone: string;
  whatsapp: string | null;
  email: string | null;
  cpf: string | null;
  observacoes: string | null;
  created_at: string | null;
  tipo_cliente: "lojista_b2b" | "consumidor_b2c";
  total_faturado: number;
  total_recebido: number;
  saldo_devedor: number;
  qtd_oss: number;
  ultima_os_data: string | null;
  ultimo_pagamento_data: string | null;
};

export function useClientesSaldos() {
  return useQuery({
    queryKey: ["clientes-saldos"],
    queryFn: async () => {
      const { data: saldos, error } = await supabase.rpc("get_saldos_clientes_resumo");
      if (error) throw error;

      const ids = (saldos ?? []).map((c) => c.cliente_id);
      const detalhesPorId = new Map<string, {
        telefone: string;
        whatsapp: string | null;
        email: string | null;
        cpf: string | null;
        observacoes: string | null;
        created_at: string | null;
        tipo_cliente: "lojista_b2b" | "consumidor_b2c" | null;
      }>();

      if (ids.length > 0) {
        const { data: detalhes, error: detalhesError } = await supabase
          .from("clientes")
          .select("id, telefone, whatsapp, email, cpf, observacoes, created_at, tipo_cliente")
          .in("id", ids);
        if (detalhesError) throw detalhesError;
        (detalhes ?? []).forEach((cliente) => detalhesPorId.set(cliente.id, cliente));
      }

      return (saldos ?? []).map((cliente) => {
        const detalhes = detalhesPorId.get(cliente.cliente_id);
        return {
          ...cliente,
          id: cliente.cliente_id,
          telefone: detalhes?.telefone ?? "",
          whatsapp: detalhes?.whatsapp ?? null,
          email: detalhes?.email ?? null,
          cpf: detalhes?.cpf ?? null,
          observacoes: detalhes?.observacoes ?? null,
          created_at: detalhes?.created_at ?? null,
          tipo_cliente: (detalhes?.tipo_cliente ?? "consumidor_b2c") as "lojista_b2b" | "consumidor_b2c",
        };
      }) as ClienteSaldoResumo[];
    },
  });
}
