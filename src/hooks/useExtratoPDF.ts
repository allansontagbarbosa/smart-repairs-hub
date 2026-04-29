import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEmpresa } from "@/contexts/EmpresaContext";
import { useClientesSaldos, type ClienteSaldoResumo } from "@/hooks/useClientesSaldos";
import { useExtratoCliente } from "@/hooks/useExtratoCliente";
import type { ExtratoPDFPayload } from "@/lib/pdf/gerarExtratoPDF";

type SaldoRPC = {
  total_faturado?: number;
  total_recebido?: number;
  saldo_devedor?: number;
  qtd_oss_faturadas?: number;
  qtd_pagamentos?: number;
  ultima_os_data?: string | null;
  ultimo_pagamento_data?: string | null;
};

export function useExtratoPDF(clienteId: string, inicio: string, fim: string) {
  const { empresa } = useEmpresa();
  const { data: clientes = [], isLoading: loadingClientes } = useClientesSaldos();
  const cliente = clientes.find((item) => item.id === clienteId || item.cliente_id === clienteId);
  const extratoQuery = useExtratoCliente(clienteId, inicio || undefined, fim || undefined);

  const saldoQuery = useQuery({
    enabled: !!clienteId,
    queryKey: ["saldo-cliente", clienteId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_saldo_cliente", { p_cliente_id: clienteId });
      if (error) throw error;
      return (data ?? {}) as SaldoRPC;
    },
  });

  const payload = useMemo<ExtratoPDFPayload | null>(() => {
    if (!cliente || !inicio || !fim) return null;
    const extrato = extratoQuery.data ?? [];
    const totalFaturadoPeriodo = extrato.reduce((sum, item) => sum + Number(item.debito ?? 0), 0);
    const totalRecebidoPeriodo = extrato.reduce((sum, item) => sum + Number(item.credito ?? 0), 0);
    const saldo = saldoQuery.data?.saldo_devedor ?? cliente.saldo_devedor ?? 0;

    return {
      cliente: mapCliente(cliente),
      periodo: { inicio, fim },
      extrato,
      resumo: {
        totalFaturadoPeriodo,
        totalRecebidoPeriodo,
        saldoDevedorAtual: Number(saldo),
      },
      empresa: empresa ? {
        nome: empresa.nome,
        telefone: empresa.telefone,
        email: empresa.email,
        cnpj: empresa.cnpj,
        endereco: empresa.endereco,
      } : null,
    };
  }, [cliente, empresa, extratoQuery.data, fim, inicio, saldoQuery.data]);

  return {
    payload,
    cliente,
    extrato: extratoQuery.data ?? [],
    isLoading: loadingClientes || extratoQuery.isLoading || saldoQuery.isLoading,
    error: extratoQuery.error || saldoQuery.error,
    refetch: () => {
      extratoQuery.refetch();
      saldoQuery.refetch();
    },
  };
}

function mapCliente(cliente: ClienteSaldoResumo) {
  return {
    id: cliente.id,
    nome: cliente.nome,
    telefone: cliente.telefone,
    whatsapp: cliente.whatsapp,
    email: cliente.email,
    cpf: cliente.cpf,
  };
}
