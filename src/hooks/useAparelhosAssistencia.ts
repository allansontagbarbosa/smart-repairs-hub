import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useMemo } from "react";

export type AparelhoAssistencia = {
  os_id: string;
  os_numero: number;
  os_numero_formatado: string | null;
  cliente_nome: string;
  cliente_telefone: string;
  loja_nome: string | null;
  aparelho_marca: string;
  aparelho_modelo: string;
  aparelho_cor: string | null;
  aparelho_imei: string | null;
  aparelho_capacidade: string | null;
  defeito_relatado: string;
  data_entrada: string;
  status: string;
  tecnico: string | null;
  funcionario_nome: string | null;
  previsao_entrega: string | null;
  prazo_vencido: boolean;
  loja_id: string | null;
  funcionario_id: string | null;
  valor: number | null;
  valor_total: number | null;
  sinal_pago: number | null;
  aprovacao_orcamento: string | null;
};

async function fetchAparelhosAssistencia() {
  const { data, error } = await supabase
    .from("ordens_de_servico")
    .select(`
      id, numero, numero_formatado, status, data_entrada, tecnico, previsao_entrega, prazo_vencido,
      loja_id, funcionario_id, defeito_relatado, valor, valor_total, sinal_pago, aprovacao_orcamento,
      aparelhos!inner ( marca, modelo, cor, imei, capacidade, cliente_id, clientes!inner ( nome, telefone ) ),
      lojas ( nome ),
      funcionarios ( nome )
    `)
    .is("deleted_at", null)
    .not("status", "eq", "entregue")
    .order("data_entrada", { ascending: false });

  if (error) throw error;

  return (data ?? []).map((os: any) => ({
    os_id: os.id,
    os_numero: os.numero,
    os_numero_formatado: os.numero_formatado ?? null,
    cliente_nome: os.aparelhos?.clientes?.nome ?? "—",
    cliente_telefone: os.aparelhos?.clientes?.telefone ?? "",
    loja_nome: os.lojas?.nome ?? null,
    aparelho_marca: os.aparelhos?.marca ?? "",
    aparelho_modelo: os.aparelhos?.modelo ?? "",
    aparelho_cor: os.aparelhos?.cor ?? null,
    aparelho_imei: os.aparelhos?.imei ?? null,
    aparelho_capacidade: os.aparelhos?.capacidade ?? null,
    defeito_relatado: os.defeito_relatado ?? "",
    data_entrada: os.data_entrada,
    status: os.status,
    tecnico: os.tecnico,
    funcionario_nome: os.funcionarios?.nome ?? null,
    previsao_entrega: os.previsao_entrega,
    prazo_vencido: os.prazo_vencido,
    loja_id: os.loja_id,
    funcionario_id: os.funcionario_id,
    valor: os.valor,
    valor_total: os.valor_total ?? os.valor ?? null,
    sinal_pago: os.sinal_pago ?? null,
    aprovacao_orcamento: os.aprovacao_orcamento ?? null,
  })) as AparelhoAssistencia[];
}

export function useAparelhosAssistencia() {
  const query = useQuery({
    queryKey: ["aparelhos_assistencia"],
    queryFn: fetchAparelhosAssistencia,
  });

  const aparelhos = query.data ?? [];

  const kpis = useMemo(() => {
    const total = aparelhos.length;
    const emAnalise = aparelhos.filter(a => a.status === "em_analise").length;
    const aguardandoPeca = aparelhos.filter(a => a.status === "aguardando_peca").length;
    const emReparo = aparelhos.filter(a => a.status === "em_reparo").length;
    const prontos = aparelhos.filter(a => a.status === "pronto").length;
    const atrasados = aparelhos.filter(a => a.prazo_vencido).length;
    return { total, emAnalise, aguardandoPeca, emReparo, prontos, atrasados };
  }, [aparelhos]);

  // Unique values for filters
  const lojas = useMemo(() => {
    const set = new Map<string, string>();
    aparelhos.forEach(a => { if (a.loja_id && a.loja_nome) set.set(a.loja_id, a.loja_nome); });
    return Array.from(set.entries()).map(([id, nome]) => ({ id, nome }));
  }, [aparelhos]);

  const tecnicos = useMemo(() => {
    const set = new Set<string>();
    aparelhos.forEach(a => { if (a.funcionario_nome) set.add(a.funcionario_nome); });
    return Array.from(set).sort();
  }, [aparelhos]);

  return {
    aparelhos,
    kpis,
    lojas,
    tecnicos,
    isLoading: query.isLoading,
    refetch: query.refetch,
  };
}
