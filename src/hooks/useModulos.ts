import { useQuery } from "@tanstack/react-query";
import { useEmpresa } from "@/contexts/EmpresaContext";
import { supabase } from "@/integrations/supabase/client";

export function useModulos() {
  const { empresaId } = useEmpresa();

  const { data, isLoading } = useQuery({
    queryKey: ["empresa-modulos", empresaId],
    queryFn: async () => {
      if (!empresaId) return null;
      const { data, error } = await supabase
        .from("empresas" as any)
        .select("modulo_loja_ativo, modulo_assistencia_ativo")
        .eq("id", empresaId)
        .single();
      if (error) throw error;
      return data as any;
    },
    enabled: !!empresaId,
    staleTime: 5 * 60_000,
  });

  const lojaAtivo = data?.modulo_loja_ativo ?? false;
  const assistenciaAtivo = data?.modulo_assistencia_ativo ?? true;

  return {
    isLoading,
    lojaAtivo,
    assistenciaAtivo,
    combo: lojaAtivo && assistenciaAtivo,
  };
}
