import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useMemo } from "react";

export type AparelhoAssistencia = {
  os_id: string;
  os_numero: number;
  cliente_nome: string;
  loja_nome: string | null;
  aparelho_marca: string;
  aparelho_modelo: string;
  aparelho_cor: string | null;
  aparelho_imei: string | null;
  data_entrada: string;
  status: string;
  tecnico: string | null;
  funcionario_nome: string | null;
  previsao_entrega: string | null;
  prazo_vencido: boolean;
  loja_id: string | null;
  funcionario_id: string | null;
};

async function fetchAparelhosAssistencia() {
  const { data, error } = await supabase
    .from("ordens_de_servico")
    .select(`
      id, numero, status, data_entrada, tecnico, previsao_entrega, prazo_vencido,
      loja_id, funcionario_id,
      aparelhos!inner ( marca, modelo, cor, imei, cliente_id, clientes!inner ( nome ) ),
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
    cliente_nome: os.aparelhos?.clientes?.nome ?? "—",
    loja_nome: os.lojas?.nome ?? null,
    aparelho_marca: os.aparelhos?.marca ?? "",
    aparelho_modelo: os.aparelhos?.modelo ?? "",
    aparelho_cor: os.aparelhos?.cor ?? null,
    aparelho_imei: os.aparelhos?.imei ?? null,
    data_entrada: os.data_entrada,
    status: os.status,
    tecnico: os.tecnico,
    funcionario_nome: os.funcionarios?.nome ?? null,
    previsao_entrega: os.previsao_entrega,
    prazo_vencido: os.prazo_vencido,
    loja_id: os.loja_id,
    funcionario_id: os.funcionario_id,
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
