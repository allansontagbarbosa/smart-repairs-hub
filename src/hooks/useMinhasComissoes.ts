import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type MinhaComissao = {
  id: string;
  valor: number;
  status: "pendente" | "liberada" | "paga" | "estornada";
  data_pagamento: string | null;
  mes_competencia: string | null;
  observacoes: string | null;
  created_at: string;
  ordem_id: string | null;
  os_servico_id: string | null;
  ordens_de_servico: {
    numero: number | null;
    numero_formatado: string | null;
    aparelhos: { marca: string | null; modelo: string | null } | null;
  } | null;
  os_servicos: {
    nome: string | null;
    status: string | null;
  } | null;
};

type PeriodoComissao = string | string[] | null | undefined;

function mesAtual() {
  return `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, "0")}`;
}

function normalizarMeses(mesCompetencia?: PeriodoComissao) {
  if (Array.isArray(mesCompetencia)) return mesCompetencia.filter(Boolean);
  return [mesCompetencia ?? mesAtual()].filter(Boolean) as string[];
}

export function useMinhasComissoes(
  funcionarioId: string | null | undefined,
  mesCompetencia?: PeriodoComissao,
) {
  const meses = normalizarMeses(mesCompetencia);

  return useQuery({
    queryKey: ["minhas-comissoes", funcionarioId, meses],
    enabled: !!funcionarioId,
    queryFn: async (): Promise<MinhaComissao[]> => {
      let query = supabase
        .from("comissoes")
        .select(`
          id, valor, status, data_pagamento, mes_competencia, observacoes, created_at,
          ordem_id, os_servico_id,
          ordens_de_servico ( numero, numero_formatado, aparelhos ( marca, modelo ) ),
          os_servicos ( nome, status )
        `)
        .eq("funcionario_id", funcionarioId!)
        .is("estornada_em", null)
        .order("created_at", { ascending: false });

      query = meses.length > 1
        ? query.in("mes_competencia", meses)
        : query.eq("mes_competencia", meses[0]);

      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []) as any;
    },
  });
}

export function useMinhasComissoesResumo(
  funcionarioId: string | null | undefined,
  mesCompetencia?: PeriodoComissao,
) {
  const meses = normalizarMeses(mesCompetencia);

  return useQuery({
    queryKey: ["minhas-comissoes-resumo", funcionarioId, meses],
    enabled: !!funcionarioId,
    queryFn: async () => {
      let query = supabase
        .from("comissoes")
        .select("valor, status")
        .eq("funcionario_id", funcionarioId!)
        .is("estornada_em", null);

      query = meses.length > 1
        ? query.in("mes_competencia", meses)
        : query.eq("mes_competencia", meses[0]);

      const { data, error } = await query;
      if (error) throw error;

      const items = data ?? [];
      const porStatus = (status: MinhaComissao["status"]) =>
        items.filter((c: any) => c.status === status).reduce((s: number, c: any) => s + Number(c.valor), 0);
      const countStatus = (status: MinhaComissao["status"]) =>
        items.filter((c: any) => c.status === status).length;

      const totalPendente = porStatus("pendente");
      const totalLiberada = porStatus("liberada");
      const totalPaga = porStatus("paga");
      const totalReceber = totalPendente + totalLiberada;
      const totalGeral = totalReceber + totalPaga;

      return {
        totalPendente,
        totalLiberada,
        totalPaga,
        totalReceber,
        totalGeral,
        countPendente: countStatus("pendente"),
        countLiberada: countStatus("liberada"),
        countPaga: countStatus("paga"),
        countTotal: items.length,
      };
    },
  });
}