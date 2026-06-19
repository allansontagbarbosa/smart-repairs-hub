import { supabase } from "@/integrations/supabase/client";

export type StatusCategoria =
  | "em_estoque"
  | "reservado"
  | "vendido"
  | "em_transito"
  | "em_assistencia";

/**
 * Garante que existe um status no catálogo atacado_status_aparelho da empresa
 * com a categoria desejada. Retorna o `nome` canônico do status.
 * Usa a RPC `atacado_add_status` (SECURITY DEFINER) que reutiliza por nome normalizado.
 */
export async function garantirStatusCategoria(
  _empresaId: string,
  categoria: StatusCategoria,
  fallbackNome: string,
): Promise<string> {
  // 1) Procurar por categoria já existente (escopo do tenant via RLS)
  const { data } = await supabase
    .from("atacado_status_aparelho" as any)
    .select("nome, categoria");

  const existente = (data as any[] | null)?.find(
    (r) => r.categoria === categoria,
  );
  if (existente?.nome) return existente.nome as string;

  // 2) Não existe — criar via RPC (impede duplicado normalizado)
  await supabase.rpc("atacado_add_status" as any, {
    p_nome: fallbackNome,
    p_cor: "#888",
    p_categoria: categoria,
  });
  return fallbackNome;
}

export interface StatusSimilar {
  id: string;
  nome: string;
  categoria: string | null;
  similaridade: number;
  is_exato: boolean;
}

/** Busca status com nome parecido (case/acento/espaço insensitive + trigram). */
export async function buscarStatusSimilar(
  nome: string,
  minSim = 0.6,
): Promise<StatusSimilar[]> {
  const { data, error } = await supabase.rpc(
    "atacado_status_buscar_similar" as any,
    { p_nome: nome, p_min_sim: minSim },
  );
  if (error) return [];
  return (data as StatusSimilar[]) || [];
}
