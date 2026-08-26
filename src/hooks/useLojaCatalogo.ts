import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEmpresa } from "@/contexts/EmpresaContext";

export interface CatalogoItem {
  id: string;
  nome: string;
  marca_id?: string | null;
}

/**
 * Catálogo compartilhado (marcas / modelos / cores / capacidades) usado no
 * cadastro de aparelhos da Loja, com criação inline.
 */
export function useLojaCatalogo() {
  const qc = useQueryClient();
  const { empresaId } = useEmpresa();

  const { data: marcas = [] } = useQuery({
    queryKey: ["marcas"],
    queryFn: async () => {
      const { data } = await supabase.from("marcas").select("id, nome").order("nome");
      return (data || []) as CatalogoItem[];
    },
  });

  const { data: modelos = [] } = useQuery({
    queryKey: ["modelos"],
    queryFn: async () => {
      const { data } = await supabase.from("modelos").select("id, nome, marca_id");
      const { sortByNomeNatural } = await import("@/lib/naturalSort");
      return sortByNomeNatural((data || []) as any[]) as CatalogoItem[];
    },
  });

  const { data: cores = [] } = useQuery({
    queryKey: ["cores"],
    queryFn: async () => {
      const { data } = await supabase.from("cores").select("id, nome");
      const { sortByNomeNatural } = await import("@/lib/naturalSort");
      return sortByNomeNatural((data || []) as any[]) as CatalogoItem[];
    },
  });

  const { data: capacidades = [] } = useQuery({
    queryKey: ["capacidades"],
    queryFn: async () => {
      const { data } = await supabase.from("capacidades").select("id, nome");
      const { sortCapacidades } = await import("@/lib/naturalSort");
      return sortCapacidades((data || []) as any[]) as CatalogoItem[];
    },
  });

  const criarMarca = async (nome: string): Promise<CatalogoItem | null> => {
    const { data, error } = await supabase
      .from("marcas")
      .insert({ nome, empresa_id: empresaId ?? null })
      .select("id, nome")
      .single();
    if (error) throw error;
    await qc.invalidateQueries({ queryKey: ["marcas"] });
    return data as CatalogoItem;
  };

  const criarModelo = async (nome: string, marcaId: string): Promise<CatalogoItem | null> => {
    const { data, error } = await supabase
      .from("modelos")
      .insert({ nome, marca_id: marcaId, empresa_id: empresaId ?? null })
      .select("id, nome, marca_id")
      .single();
    if (error) throw error;
    await qc.invalidateQueries({ queryKey: ["modelos"] });
    return data as CatalogoItem;
  };

  const criarCor = async (nome: string): Promise<CatalogoItem | null> => {
    const { data, error } = await supabase
      .from("cores")
      .insert({ nome, empresa_id: empresaId ?? null })
      .select("id, nome")
      .single();
    if (error) throw error;
    await qc.invalidateQueries({ queryKey: ["cores"] });
    return data as CatalogoItem;
  };

  const criarCapacidade = async (nome: string): Promise<CatalogoItem | null> => {
    const { data, error } = await supabase
      .from("capacidades")
      .insert({ nome, empresa_id: empresaId ?? null, ordem: 0 })
      .select("id, nome")
      .single();
    if (error) throw error;
    await qc.invalidateQueries({ queryKey: ["capacidades"] });
    return data as CatalogoItem;
  };

  return { marcas, modelos, cores, capacidades, criarMarca, criarModelo, criarCor, criarCapacidade };
}
