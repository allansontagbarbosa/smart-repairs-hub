import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { unwrap, type RpcResp } from "./_shared";

/**
 * Layout do painel TV — JSON livre por design.
 * Cada widget tem `tipo` e props específicas que variam por widget;
 * mantemos `props` como Record<string, unknown> em vez de tentar tipar todas
 * as variantes de widget aqui (o que exigiria refator do TVConfigurar e do
 * TVDisplay).
 */
export interface PainelLayoutWidget {
  id?: string;
  tipo: string;
  posicao?: { x: number; y: number; w: number; h: number };
  props?: Record<string, unknown>;
}

// Algumas RPCs e a tabela `tv_paineis` ainda não constam nos tipos gerados pelo
// supabase (são features novas). Por isso mantemos `as any` apenas no nome da
// RPC/tabela. EXCEÇÃO documentada — remove quando os types forem regenerados.
type RpcName = string;
type TableName = string;

export interface TVPainel {
  id: string;
  nome: string;
  codigo: string;
  tema: "dark" | "light";
  orientacao: "auto" | "landscape" | "portrait";
  widgets: string[];
  intervalo_refresh_segundos: number;
  ativo: boolean;
  ultimo_acesso_em: string | null;
  created_at: string;
  layout: PainelLayoutWidget[];
  logo_url: string | null;
  tamanho_fonte: "P" | "M" | "G";
}

export function useTVPaineis() {
  return useQuery({
    queryKey: ["tv-paineis"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tv_paineis" as unknown as TableName as never)
        .select("*")
        .eq("ativo" as never, true as never)
        .order("created_at" as never, { ascending: false });
      if (error) throw error;
      return ((data ?? []) as unknown) as TVPainel[];
    },
  });
}

export function useCriarTVPainel() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: {
      nome: string;
      widgets: string[];
      tema?: "dark" | "light";
      orientacao?: "auto" | "landscape" | "portrait";
      intervalo_refresh?: number;
    }) => {
      const { data, error } = await supabase.rpc("tv_criar_painel" as RpcName as never, {
        p_nome: params.nome,
        p_widgets: params.widgets,
        p_tema: params.tema ?? "dark",
        p_orientacao: params.orientacao ?? "auto",
        p_intervalo_refresh: params.intervalo_refresh ?? 30,
      } as never);
      if (error) throw error;
      return unwrap<RpcResp<{ codigo?: string }>>(data);
    },
    onSuccess: (data) => {
      if (data?.success) {
        toast.success(`Painel criado! Código: ${data.codigo ?? ""}`);
        qc.invalidateQueries({ queryKey: ["tv-paineis"] });
      } else if (data?.error) {
        toast.error(data.error);
      }
    },
    onError: (err: Error) => toast.error(err.message ?? "Erro ao criar painel"),
  });
}

export function useAtualizarTVPainel() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: {
      painel_id: string;
      nome?: string;
      widgets?: string[];
      tema?: string;
      orientacao?: string;
      intervalo_refresh?: number;
    }) => {
      const { error } = await supabase.rpc("tv_atualizar_painel" as RpcName as never, {
        p_painel_id: params.painel_id,
        p_nome: params.nome ?? null,
        p_widgets: params.widgets ?? null,
        p_tema: params.tema ?? null,
        p_orientacao: params.orientacao ?? null,
        p_intervalo_refresh: params.intervalo_refresh ?? null,
      } as never);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tv-paineis"] });
      toast.success("Painel atualizado");
    },
  });
}

export function useRegenerarCodigoTV() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (painel_id: string) => {
      const { data, error } = await supabase.rpc("tv_regenerar_codigo" as RpcName as never, {
        p_painel_id: painel_id,
      } as never);
      if (error) throw error;
      return unwrap<RpcResp<{ novo_codigo?: string }>>(data);
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["tv-paineis"] });
      toast.success(`Novo código: ${data?.novo_codigo ?? ""}`);
    },
  });
}

export function useExcluirTVPainel() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (painel_id: string) => {
      const { error } = await supabase
        .from("tv_paineis" as unknown as TableName as never)
        .update({ ativo: false } as never)
        .eq("id" as never, painel_id as never);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tv-paineis"] });
      toast.success("Painel removido");
    },
  });
}

export function useTVPainelDados(codigo: string | null, intervaloMs = 30000) {
  return useQuery({
    queryKey: ["tv-painel-dados", codigo],
    queryFn: async () => {
      if (!codigo) return null;
      const { data, error } = await supabase.rpc("tv_get_painel_data" as RpcName as never, {
        p_codigo: codigo,
      } as never);
      if (error) throw error;
      return data as unknown as Record<string, unknown>;
    },
    enabled: !!codigo,
    refetchInterval: intervaloMs,
    staleTime: Math.max(intervaloMs - 5000, 5000),
  });
}

export function useAtualizarLayoutTV() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: {
      painel_id: string;
      layout?: PainelLayoutWidget[];
      tamanho_fonte?: "P" | "M" | "G";
      logo_url?: string;
    }) => {
      const { error } = await supabase.rpc("tv_atualizar_layout" as RpcName as never, {
        p_painel_id: params.painel_id,
        p_layout: params.layout ?? [],
        p_tamanho_fonte: params.tamanho_fonte ?? null,
        p_logo_url: params.logo_url ?? null,
      } as never);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tv-paineis"] });
      toast.success("Layout salvo");
    },
    onError: (err: Error) => toast.error(err.message ?? "Erro ao salvar"),
  });
}

export function useUploadLogoTV() {
  return useMutation({
    mutationFn: async (params: { empresa_id: string; file: File }) => {
      const ext = params.file.name.split(".").pop();
      const fileName = `${params.empresa_id}/${Date.now()}.${ext}`;
      const { error } = await supabase.storage
        .from("tv-logos")
        .upload(fileName, params.file, { upsert: false });
      if (error) throw error;
      const { data } = supabase.storage.from("tv-logos").getPublicUrl(fileName);
      return data.publicUrl;
    },
  });
}
