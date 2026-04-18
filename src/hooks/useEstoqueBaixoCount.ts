import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

export function useEstoqueBaixoCount() {
  const qc = useQueryClient();

  const { data: count = 0 } = useQuery({
    queryKey: ["estoque_baixo_count"],
    queryFn: async () => {
      // PostgREST não suporta comparar duas colunas na URL — filtro feito no cliente
      const { data, error } = await supabase
        .from("estoque_itens")
        .select("id, quantidade, quantidade_minima")
        .is("deleted_at", null)
        .gt("quantidade_minima", 0);

      if (error) throw error;

      return (data ?? []).filter(i => i.quantidade <= i.quantidade_minima).length;
    },
    staleTime: 30_000,
  });

  useEffect(() => {
    const channel = supabase
      .channel("estoque-baixo-sidebar")
      .on("postgres_changes", { event: "*", schema: "public", table: "estoque_itens" }, () => {
        qc.invalidateQueries({ queryKey: ["estoque_baixo_count"] });
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [qc]);

  return count;
}
