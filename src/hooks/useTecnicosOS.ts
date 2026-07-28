import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type TecnicoOS = { id: string; nome: string; cargo?: string | null };

/**
 * Lista os funcionários ativos da empresa para atribuição de técnico na OS.
 * Usa a RPC `listar_tecnicos_os` (SECURITY DEFINER) porque a RLS de
 * `funcionarios` só permite leitura para admin/RH — atendentes ficavam com a
 * lista vazia ("Nenhum técnico cadastrado").
 */
export function useTecnicosOS() {
  return useQuery<TecnicoOS[]>({
    queryKey: ["tecnicos-os"],
    queryFn: async () => {
      const { data, error } = await (supabase as any).rpc("listar_tecnicos_os");
      if (error) throw error;
      const lista = ((data ?? []) as any[]).map((f) => ({
        id: f.id,
        nome: f.nome,
        cargo: f.cargo ?? null,
      }));
      // Prioriza quem tem cargo de técnico, mas nunca esconde os demais.
      const isTec = (c?: string | null) =>
        (c || "").toLowerCase().includes("tecnic") || (c || "").toLowerCase().includes("técnic");
      return [...lista.filter((f) => isTec(f.cargo)), ...lista.filter((f) => !isTec(f.cargo))];
    },
  });
}
