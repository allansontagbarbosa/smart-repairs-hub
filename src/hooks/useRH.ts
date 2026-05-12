import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { FuncionarioRH, Holerite } from "@/types/rh";

export function useListarFuncionariosRH() {
  return useQuery({
    queryKey: ["rh", "funcionarios"],
    queryFn: async () => {
      const { data, error } = await (supabase as any).rpc("listar_funcionarios_rh");
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error ?? "Erro");
      return (data.funcionarios ?? []) as FuncionarioRH[];
    },
    staleTime: 0,
  });
}

export function useListarTodosFuncionarios() {
  return useQuery({
    queryKey: ["rh", "todos-funcionarios"],
    queryFn: async () => {
      const { data, error } = await (supabase as any).rpc("listar_todos_funcionarios");
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error ?? "Erro");
      return (data.funcionarios ?? []) as Array<{
        id: string;
        nome: string;
        email: string | null;
        cargo: string | null;
        tipo_vinculo: string;
        ativo: boolean;
        eh_funcionario_rh: boolean;
      }>;
    },
    staleTime: 0,
  });
}

export function useToggleFuncionarioRH() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { id: string; eh_funcionario_rh: boolean }) => {
      const { error } = await (supabase as any)
        .from("funcionarios")
        .update({ eh_funcionario_rh: input.eh_funcionario_rh } as any)
        .eq("id", input.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["rh"] });
    },
  });
}

export function useExtratoFuncionario(funcionarioId: string | null, dataInicio?: string, dataFim?: string) {
  return useQuery({
    queryKey: ["rh", "extrato", funcionarioId, dataInicio ?? null, dataFim ?? null],
    enabled: !!funcionarioId,
    queryFn: async () => {
      const { data, error } = await (supabase as any).rpc("extrato_funcionario", {
        p_funcionario_id: funcionarioId,
        p_data_inicio: dataInicio || null,
        p_data_fim: dataFim || null,
      });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error ?? "Erro");
      return data;
    },
    staleTime: 0,
  });
}

export function useHolerite(funcionarioId: string | null, competencia: string) {
  return useQuery({
    queryKey: ["rh", "holerite", funcionarioId, competencia],
    enabled: !!funcionarioId,
    queryFn: async () => {
      const { data, error } = await (supabase as any).rpc("holerite_funcionario", {
        p_funcionario_id: funcionarioId,
        p_competencia: competencia,
      });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error ?? "Erro");
      return data as Holerite & { success: boolean };
    },
    staleTime: 0,
  });
}

export function useBancoHoras(funcionarioId: string | null, competencia: string) {
  return useQuery({
    queryKey: ["rh", "banco_horas", funcionarioId, competencia],
    enabled: !!funcionarioId,
    queryFn: async () => {
      const { data, error } = await (supabase as any).rpc("calcular_banco_horas", {
        p_funcionario_id: funcionarioId,
        p_competencia: competencia,
      });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error ?? "Erro");
      return data;
    },
    staleTime: 0,
  });
}

export function useAtualizarFuncionario() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { id: string; campos: Record<string, any> }) => {
      const { error } = await (supabase as any)
        .from("funcionarios")
        .update(input.campos as any)
        .eq("id", input.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["rh"] });
      qc.invalidateQueries({ queryKey: ["funcionarios"] });
      qc.invalidateQueries({ queryKey: ["funcionarios_fin"] });
    },
  });
}

export function useRegistrarFalta() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      funcionario_id: string;
      data: string;
      falta_justificada: boolean;
      atestado_medico: boolean;
      abonada: boolean;
      justificativa?: string;
    }) => {
      const { data, error } = await (supabase as any).rpc("registrar_falta", {
        p_funcionario_id: input.funcionario_id,
        p_data: input.data,
        p_falta_justificada: input.falta_justificada,
        p_atestado_medico: input.atestado_medico,
        p_abonada: input.abonada,
        p_justificativa: input.justificativa || null,
      });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error ?? "Erro");
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["rh"] });
    },
  });
}

export function useGerarFolhaMensal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (competencia: string) => {
      const { data, error } = await (supabase as any).rpc("gerar_folha_mensal_completa", {
        p_competencia: competencia,
        p_dia_vencimento: null,
      });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error ?? "Erro");
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["rh"] });
      qc.invalidateQueries({ queryKey: ["contas-a-pagar"] });
      qc.invalidateQueries({ queryKey: ["financeiro"] });
    },
  });
}

export function usePagarMovimentacoes() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { ids: string[]; forma_pagamento?: string }) => {
      const { data, error } = await (supabase as any).rpc("pagar_movimentacoes", {
        p_movimentacao_ids: input.ids,
        p_forma_pagamento: input.forma_pagamento || "transferencia",
        p_criar_conta_pagar: false,
      });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error ?? "Erro");
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["rh"] });
    },
  });
}

export function useCriarFuncionarioRH() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      nome: string;
      cpf?: string;
      email?: string;
      telefone?: string;
      cargo?: string;
      tipo_vinculo?: string;
      salario_centavos?: number;
      vt_centavos?: number;
      va_centavos?: number;
      carga_horaria_semanal?: number;
      data_admissao?: string;
      valor_diaria_centavos?: number;
    }) => {
      const { data, error } = await (supabase as any).rpc("criar_funcionario_rh", {
        p_nome: input.nome,
        p_cpf: input.cpf || null,
        p_email: input.email || null,
        p_telefone: input.telefone || null,
        p_cargo: input.cargo || null,
        p_tipo_vinculo: input.tipo_vinculo || "clt",
        p_salario_centavos: input.salario_centavos ?? null,
        p_vt_centavos: input.vt_centavos ?? 0,
        p_va_centavos: input.va_centavos ?? 0,
        p_carga_horaria_semanal: input.carga_horaria_semanal ?? null,
        p_data_admissao: input.data_admissao || null,
        p_valor_diaria_centavos: input.valor_diaria_centavos ?? null,
      });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error ?? "Erro ao criar");
      return data as { success: boolean; funcionario_id: string; message: string };
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["rh"] });
      qc.invalidateQueries({ queryKey: ["funcionarios"] });
    },
  });
}

export function useAplicarAcaoBancoHoras() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      funcionario_id: string;
      competencia: string;
      horas: number;
      acao: "pagar_extra" | "manter_banco";
    }) => {
      const { data, error } = await (supabase as any).rpc("aplicar_acao_banco_horas", {
        p_funcionario_id: input.funcionario_id,
        p_competencia: input.competencia,
        p_horas: input.horas,
        p_acao: input.acao,
      });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error ?? "Erro");
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["rh"] });
    },
  });
}
