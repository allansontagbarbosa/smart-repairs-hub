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
    // Usa .lt em previsao_entrega no lugar de prazo_vencido (mais robusto e independe de trigger)
    const nowIso = new Date().toISOString();

    const [osAprov, osPrazo, contasVenc, comissPend, lowStock] = await Promise.all([
      supabase.from("ordens_de_servico").select("id", { count: "exact", head: true })
        .eq("status", "aguardando_aprovacao").is("deleted_at", null),
      supabase.from("ordens_de_servico").select("id", { count: "exact", head: true })
        .lt("previsao_entrega", nowIso)
        .not("status", "in", '("pronto","entregue","cancelado")')
        .is("deleted_at", null),
      supabase.from("contas_a_pagar").select("id", { count: "exact", head: true }).eq("status", "vencida").is("deleted_at", null),
      supabase.from("comissoes").select("id", { count: "exact", head: true }).eq("status", "pendente"),
      // Estoque baixo: PostgREST não suporta col×col, então buscamos no cliente
      supabase.from("estoque_itens")
        .select("id, quantidade, quantidade_minima")
        .is("deleted_at", null)
        .gt("quantidade_minima", 0),
    ]);

    const pecasCount = (lowStock.data ?? []).filter(i => i.quantidade <= i.quantidade_minima).length;

    setBadgeCounts({
      assistencia: (osAprov.count ?? 0) + (osPrazo.count ?? 0),
      financeiro: (contasVenc.count ?? 0) + (comissPend.count ?? 0),
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

    const channel = supabase.channel(`notificacoes-rt-${crypto.randomUUID()}`);

    let cancelled = false;
    void supabase.auth.getUser().then(({ data }) => {
      if (cancelled) return;
      const uid = data?.user?.id;
      // Scope realtime to this user's notifications only (RLS-aligned, prevents cross-user leak)
      if (uid) {
        channel.on(
          "postgres_changes",
          { event: "*", schema: "public", table: "notificacoes", filter: `user_id=eq.${uid}` },
          () => fetchNotificacoes(),
        );
      }
    });

    channel
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
      });

    channel.subscribe();

    return () => {
      cancelled = true;
      void supabase.removeChannel(channel);
    };
  }, [fetchBadgeCounts, fetchNotificacoes, queryClient]);

  const totalNaoLidas = notificacoes.filter(n => !n.lida).length;

  return { notificacoes, totalNaoLidas, badgeCounts, marcarLida, marcarTodasLidas };
}
