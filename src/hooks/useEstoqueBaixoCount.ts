import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

export function useEstoqueBaixoCount() {
  const qc = useQueryClient();

  const { data: count = 0 } = useQuery({
    queryKey: ["estoque_baixo_count"],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("estoque_itens")
        .select("id", { count: "exact", head: true })
        .is("deleted_at", null)
        .gt("quantidade_minima", 0)
        .lte("quantidade", 0); // will be refined below

      if (error) throw error;

      // Supabase doesn't support lte(col, other_col), so fetch and filter
      const { data } = await supabase
        .from("estoque_itens")
        .select("id, quantidade, quantidade_minima")
        .is("deleted_at", null)
        .gt("quantidade_minima", 0);

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
