import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEmpresa } from "@/contexts/EmpresaContext";

export type EtiquetaTemplate = {
  id: string;
  empresa_id: string;
  nome: string;
  tipo: "os_entrada" | "os_retirada" | "peca_estoque" | "cliente_aparelho" | "custom";
  largura_mm: number;
  altura_mm: number;
  margem_topo_mm: number;
  margem_lateral_mm: number;
  orientacao: "retrato" | "paisagem";
  tipo_impressora: "termica" | "a4_multipla";
  etiquetas_por_linha: number;
  etiquetas_por_coluna: number;
  espacamento_horizontal_mm: number;
  espacamento_vertical_mm: number;
  fonte_familia: string;
  fonte_tamanho_base: number;
  fonte_tamanho_titulo: number;
  fonte_tamanho_pequeno: number;
  campos_visiveis: string[];
  campos_config: any[];
  mostrar_qr_code: boolean;
  qr_code_conteudo: string;
  qr_code_url_base: string | null;
  qr_code_tamanho_mm: number;
  qr_code_posicao: "esquerda" | "direita" | "centro_topo" | "centro_baixo";
  mostrar_codigo_barras: boolean;
  codigo_barras_conteudo: string;
  codigo_barras_altura_mm: number;
  mostrar_logo: boolean;
  logo_posicao: "topo_esquerda" | "topo_centro" | "topo_direita";
  logo_altura_mm: number;
  texto_rodape: string | null;
  mostrar_data_impressao: boolean;
  ativo: boolean;
  e_padrao: boolean;
  created_at?: string;
  updated_at?: string;
  deleted_at?: string | null;
};

export function useEtiquetaTemplates() {
  return useQuery({
    queryKey: ["etiqueta-templates"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("etiqueta_templates" as any)
        .select("*")
        .is("deleted_at", null)
        .order("tipo")
        .order("nome");
      if (error) throw error;
      return (data || []) as unknown as EtiquetaTemplate[];
    },
  });
}

export function useEtiquetaTemplateDefault(tipo: string) {
  return useQuery({
    queryKey: ["etiqueta-template-default", tipo],
    queryFn: async () => {
      const { data } = await supabase
        .from("etiqueta_templates" as any)
        .select("*")
        .is("deleted_at", null)
        .eq("ativo", true)
        .eq("tipo", tipo)
        .eq("e_padrao", true)
        .maybeSingle();
      return (data as unknown as EtiquetaTemplate) || null;
    },
  });
}

export function useSaveEtiquetaTemplate() {
  const qc = useQueryClient();
  const { empresa } = useEmpresa();
  return useMutation({
    mutationFn: async (template: Partial<EtiquetaTemplate>) => {
      const payload: any = { ...template };
      delete payload.created_at;
      delete payload.updated_at;
      const isUpdate = !!payload.id;
      if (!isUpdate) {
        payload.empresa_id = empresa?.id;
      }
      const query = isUpdate
        ? supabase.from("etiqueta_templates" as any).update(payload).eq("id", payload.id)
        : supabase.from("etiqueta_templates" as any).insert(payload);
      const { data, error } = await (query as any).select().single();
      if (error) throw error;

      // Se marcou como padrão, remove o padrão dos outros do mesmo tipo
      if (payload.e_padrao && payload.tipo) {
        await supabase
          .from("etiqueta_templates" as any)
          .update({ e_padrao: false })
          .eq("empresa_id", empresa?.id)
          .eq("tipo", payload.tipo)
          .neq("id", (data as any).id);
      }

      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["etiqueta-templates"] });
      qc.invalidateQueries({ queryKey: ["etiqueta-template-default"] });
    },
  });
}

export function useDeleteEtiquetaTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("etiqueta_templates" as any)
        .update({ deleted_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["etiqueta-templates"] });
      qc.invalidateQueries({ queryKey: ["etiqueta-template-default"] });
    },
  });
}
