import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

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
  layout: any[];
  logo_url: string | null;
  tamanho_fonte: "P" | "M" | "G";
}

export function useTVPaineis() {
  return useQuery({
    queryKey: ["tv-paineis"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tv_paineis" as any)
        .select("*")
        .eq("ativo", true)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return ((data ?? []) as any[]) as TVPainel[];
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
      const { data, error } = await supabase.rpc("tv_criar_painel" as any, {
        p_nome: params.nome,
        p_widgets: params.widgets as any,
        p_tema: params.tema ?? "dark",
        p_orientacao: params.orientacao ?? "auto",
        p_intervalo_refresh: params.intervalo_refresh ?? 30,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data: any) => {
      if (data?.success) {
        toast.success(`Painel criado! Código: ${data.codigo}`);
        qc.invalidateQueries({ queryKey: ["tv-paineis"] });
      } else if (data?.error) {
        toast.error(data.error);
      }
    },
    onError: (err: any) => toast.error(err.message ?? "Erro ao criar painel"),
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
      const { error } = await supabase.rpc("tv_atualizar_painel" as any, {
        p_painel_id: params.painel_id,
        p_nome: params.nome ?? null,
        p_widgets: (params.widgets ?? null) as any,
        p_tema: params.tema ?? null,
        p_orientacao: params.orientacao ?? null,
        p_intervalo_refresh: params.intervalo_refresh ?? null,
      });
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
      const { data, error } = await supabase.rpc("tv_regenerar_codigo" as any, {
        p_painel_id: painel_id,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data: any) => {
      qc.invalidateQueries({ queryKey: ["tv-paineis"] });
      toast.success(`Novo código: ${data?.novo_codigo}`);
    },
  });
}

export function useExcluirTVPainel() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (painel_id: string) => {
      const { error } = await supabase
        .from("tv_paineis" as any)
        .update({ ativo: false })
        .eq("id", painel_id);
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
      const { data, error } = await supabase.rpc("tv_get_painel_data" as any, {
        p_codigo: codigo,
      });
      if (error) throw error;
      return data as any;
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
      layout?: any[];
      tamanho_fonte?: "P" | "M" | "G";
      logo_url?: string;
    }) => {
      const { error } = await supabase.rpc("tv_atualizar_layout" as any, {
        p_painel_id: params.painel_id,
        p_layout: (params.layout ?? []) as any,
        p_tamanho_fonte: params.tamanho_fonte ?? null,
        p_logo_url: params.logo_url ?? null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tv-paineis"] });
      toast.success("Layout salvo");
    },
    onError: (err: any) => toast.error(err.message ?? "Erro ao salvar"),
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
