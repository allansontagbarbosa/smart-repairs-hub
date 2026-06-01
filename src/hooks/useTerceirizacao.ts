import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface Terceiro {
  id: string;
  empresa_id: string;
  nome: string;
  contato: string | null;
  especialidade: string | null;
  observacoes: string | null;
  ativo: boolean;
  created_at: string;
}

export interface Terceirizacao {
  id: string;
  empresa_id: string;
  os_id: string;
  terceiro_id: string | null;
  terceiro_nome: string | null;
  servico: string | null;
  custo: number;
  custo_final: number | null;
  servico_realizado: string | null;
  garantia_dias: number | null;
  garantia_ate: string | null;
  data_envio: string;
  previsao_retorno: string | null;
  data_retorno: string | null;
  status: "enviado" | "retornado" | "cancelado";
  observacoes: string | null;
  created_at: string;
}

export interface GarantiaTerceiroVigente {
  terceirizacao_id: string;
  os_id: string;
  terceiro_nome: string | null;
  servico_realizado: string | null;
  custo_final: number | null;
  data_retorno: string;
  garantia_ate: string;
  dias_restantes: number;
}

export interface AparelhoNaRua {
  terceirizacao_id: string;
  os_id: string;
  terceiro_nome: string | null;
  servico: string | null;
  custo: number;
  data_envio: string;
  previsao_retorno: string | null;
  dias_fora: number;
  atrasado: boolean;
}

export function useTerceiros() {
  return useQuery({
    queryKey: ["assistencia_terceiros"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("assistencia_terceiros" as any)
        .select("*")
        .order("ativo", { ascending: false })
        .order("nome");
      if (error) throw error;
      return (data ?? []) as unknown as Terceiro[];
    },
  });
}

export function useSalvarTerceiro() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: Partial<Terceiro> & { nome: string }) => {
      if (input.id) {
        const { error } = await supabase
          .from("assistencia_terceiros" as any)
          .update({
            nome: input.nome,
            contato: input.contato ?? null,
            especialidade: input.especialidade ?? null,
            observacoes: input.observacoes ?? null,
            ativo: input.ativo ?? true,
          })
          .eq("id", input.id);
        if (error) throw error;
        return input.id;
      }
      // Empresa do usuário precisa estar no insert (RLS exige)
      const { data: empresaIdData, error: empErr } = await supabase.rpc("get_my_empresa_id" as any);
      if (empErr) throw empErr;
      const { data, error } = await supabase
        .from("assistencia_terceiros" as any)
        .insert({
          empresa_id: empresaIdData,
          nome: input.nome,
          contato: input.contato ?? null,
          especialidade: input.especialidade ?? null,
          observacoes: input.observacoes ?? null,
          ativo: input.ativo ?? true,
        })
        .select("id")
        .single();
      if (error) throw error;
      return (data as any).id as string;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["assistencia_terceiros"] });
      toast.success("Terceiro salvo");
    },
    onError: (e: any) => toast.error(e?.message || "Erro ao salvar terceiro"),
  });
}

export function useTerceirizacoesDaOS(osId: string | null | undefined) {
  return useQuery({
    queryKey: ["assistencia_terceirizacoes", osId],
    enabled: !!osId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("assistencia_terceirizacoes" as any)
        .select("*, assistencia_terceiros ( nome, contato )")
        .eq("os_id", osId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as (Terceirizacao & { assistencia_terceiros?: { nome: string; contato: string | null } | null })[];
    },
  });
}

export function useEnviarParaTerceiro() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: {
      os_id: string;
      terceiro_id?: string | null;
      terceiro_nome?: string | null;
      servico?: string | null;
      custo: number;
      data_envio?: string | null;
      previsao_retorno?: string | null;
      observacoes?: string | null;
    }) => {
      const { data, error } = await supabase.rpc("os_terceirizar" as any, { p_payload: payload });
      if (error) throw error;
      return data;
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["assistencia_terceirizacoes", vars.os_id] });
      qc.invalidateQueries({ queryKey: ["aparelhos_na_rua"] });
      qc.invalidateQueries({ queryKey: ["ordens"] });
      qc.invalidateQueries({ queryKey: ["ordem", vars.os_id] });
      toast.success("Aparelho enviado para o terceiro");
    },
    onError: (e: any) => toast.error(e?.message || "Erro ao terceirizar"),
  });
}

export function useRegistrarRetornoTerceiro() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { terceirizacao_id: string; os_id: string; novo_status?: string }) => {
      const { data, error } = await supabase.rpc("os_terceiro_retornou" as any, {
        p_terceirizacao_id: input.terceirizacao_id,
        p_novo_status_os: input.novo_status ?? "em_reparo",
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["assistencia_terceirizacoes", vars.os_id] });
      qc.invalidateQueries({ queryKey: ["aparelhos_na_rua"] });
      qc.invalidateQueries({ queryKey: ["ordens"] });
      qc.invalidateQueries({ queryKey: ["ordem", vars.os_id] });
      toast.success("Retorno do terceiro registrado");
    },
    onError: (e: any) => toast.error(e?.message || "Erro ao registrar retorno"),
  });
}

export function useAparelhosNaRua() {
  return useQuery({
    queryKey: ["aparelhos_na_rua"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("assistencia_aparelhos_na_rua" as any);
      if (error) throw error;
      return (data ?? []) as unknown as AparelhoNaRua[];
    },
  });
}
