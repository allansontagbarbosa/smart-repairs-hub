import { supabase } from "@/integrations/supabase/client";

/**
 * Garante que existe um status no catálogo atacado_status_aparelho da empresa
 * com a categoria desejada. Retorna o `nome` do status a ser usado.
 * RLS: tenant_isolation já restringe inserts/selects à empresa do usuário.
 */
export async function garantirStatusCategoria(
  empresaId: string,
  categoria: "reservado" | "vendido" | "em_transito" | "em_estoque",
  fallbackNome: string,
): Promise<string> {
  const { data } = await supabase
    .from("atacado_status_aparelho" as any)
    .select("nome, categoria")
    .eq("empresa_id", empresaId);

  const existente = (data as any[] | null)?.find(
    (r) => r.categoria === categoria,
  );
  if (existente?.nome) return existente.nome;

  await supabase
    .from("atacado_status_aparelho" as any)
    .insert({
      empresa_id: empresaId,
      nome: fallbackNome,
      categoria,
    } as any);
  return fallbackNome;
}
