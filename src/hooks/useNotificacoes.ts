import { useEffect, useState, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface Notificacao {
  id: string;
  tipo: string;
  titulo: string;
  mensagem: string;
  lida: boolean;
  referencia_id: string | null;
  referencia_tabela: string | null;
  created_at: string;
}

export interface BadgeCounts {
  assistencia: number;
  financeiro: number;
  pecas: number;
}

export function useNotificacoes() {
  const [notificacoes, setNotificacoes] = useState<Notificacao[]>([]);
  const [badgeCounts, setBadgeCounts] = useState<BadgeCounts>({ assistencia: 0, financeiro: 0, pecas: 0 });
  const queryClient = useQueryClient();

  const fetchNotificacoes = useCallback(async () => {
    const { data } = await supabase
      .from("notificacoes")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(50);
    setNotificacoes((data as Notificacao[]) ?? []);
  }, []);

  const fetchBadgeCounts = useCallback(async () => {
    const [osRes, contasRes, pecasRes] = await Promise.all([
      // Assistência: aguardando_aprovacao + prazo_vencido
      Promise.all([
        supabase.from("ordens_de_servico").select("id", { count: "exact", head: true })
          .eq("status", "aguardando_aprovacao").is("deleted_at", null),
        supabase.from("ordens_de_servico").select("id", { count: "exact", head: true })
          .eq("prazo_vencido", true).not("status", "in", '("pronto","entregue")').is("deleted_at", null),
      ]),
      // Financeiro: contas vencidas + comissões pendentes
      Promise.all([
        supabase.from("contas_a_pagar").select("id", { count: "exact", head: true }).eq("status", "vencida"),
        supabase.from("comissoes").select("id", { count: "exact", head: true }).eq("status", "pendente"),
      ]),
      // Peças: estoque baixo
      supabase.from("estoque_itens").select("id", { count: "exact", head: true })
        .is("deleted_at", null)
        .filter("quantidade", "lte", "quantidade_minima" as any),
    ]);

    // For pecas we need a different approach since we can't compare columns directly
    const { data: lowStock } = await supabase
      .from("estoque_itens")
      .select("id, quantidade, quantidade_minima")
      .is("deleted_at", null)
      .gt("quantidade_minima", 0);
    const pecasCount = (lowStock ?? []).filter(i => i.quantidade <= i.quantidade_minima).length;

    setBadgeCounts({
      assistencia: (osRes[0].count ?? 0) + (osRes[1].count ?? 0),
      financeiro: (contasRes[0].count ?? 0) + (contasRes[1].count ?? 0),
      pecas: pecasCount,
    });
  }, []);

  const marcarLida = useCallback(async (id: string) => {
    await supabase.from("notificacoes").update({ lida: true }).eq("id", id);
    setNotificacoes(prev => prev.map(n => n.id === id ? { ...n, lida: true } : n));
  }, []);

  const marcarTodasLidas = useCallback(async () => {
    await supabase.from("notificacoes").update({ lida: true }).eq("lida", false);
    setNotificacoes(prev => prev.map(n => ({ ...n, lida: true })));
  }, []);

  useEffect(() => {
    fetchNotificacoes();
    fetchBadgeCounts();

    const channel = supabase
      .channel("notificacoes-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "notificacoes" }, () => {
        fetchNotificacoes();
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "ordens_de_servico" }, () => {
        fetchBadgeCounts();
        queryClient.invalidateQueries({ queryKey: ["os-aguardando-aprovacao-count"] });
        queryClient.invalidateQueries({ queryKey: ["os-atrasadas-count"] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "contas_a_pagar" }, () => {
        fetchBadgeCounts();
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "estoque_itens" }, () => {
        fetchBadgeCounts();
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "comissoes" }, () => {
        fetchBadgeCounts();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchNotificacoes, fetchBadgeCounts, queryClient]);

  const totalNaoLidas = notificacoes.filter(n => !n.lida).length;

  return { notificacoes, totalNaoLidas, badgeCounts, marcarLida, marcarTodasLidas };
}
