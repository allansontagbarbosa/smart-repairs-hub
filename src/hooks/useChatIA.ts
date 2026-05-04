import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface MensagemChat {
  id: string;
  papel: "user" | "assistant";
  conteudo: string;
  criado_em: string;
}

export function useChatIA(conversaIdInicial?: string) {
  const [conversaId, setConversaId] = useState<string | undefined>(conversaIdInicial);
  const [mensagens, setMensagens] = useState<MensagemChat[]>([]);
  const [enviando, setEnviando] = useState(false);

  const carregarHistorico = useCallback(async (id: string) => {
    const { data, error } = await supabase
      .from("ia_mensagens")
      .select("id, papel, conteudo, criado_em")
      .eq("conversa_id", id)
      .in("papel", ["user", "assistant"])
      .order("criado_em", { ascending: true });

    if (error) {
      toast.error("Erro ao carregar histórico");
      return;
    }
    setConversaId(id);
    setMensagens((data ?? []) as MensagemChat[]);
  }, []);

  const enviar = useCallback(
    async (texto: string) => {
      if (!texto.trim() || enviando) return;

      const tempUser: MensagemChat = {
        id: `temp-${Date.now()}`,
        papel: "user",
        conteudo: texto,
        criado_em: new Date().toISOString(),
      };
      setMensagens((prev) => [...prev, tempUser]);
      setEnviando(true);

      try {
        const { data, error } = await supabase.functions.invoke("chat-ia", {
          body: { conversa_id: conversaId, mensagem: texto },
        });

        if (error) throw error;
        if (data?.error === "limite_atingido") {
          toast.error(
            data.motivo === "teto_atingido"
              ? `Limite mensal de R$ ${Number(data.teto_brl ?? 50).toFixed(2)} atingido.`
              : "Limite diário de mensagens atingido.",
          );
          return;
        }
        if (data?.error) throw new Error(data.error);

        if (!conversaId && data.conversa_id) setConversaId(data.conversa_id);

        const tempAssist: MensagemChat = {
          id: `temp-${Date.now()}-a`,
          papel: "assistant",
          conteudo: data.resposta,
          criado_em: new Date().toISOString(),
        };
        setMensagens((prev) => [...prev, tempAssist]);
      } catch (e: any) {
        toast.error(e?.message ?? "Erro ao enviar mensagem");
      } finally {
        setEnviando(false);
      }
    },
    [conversaId, enviando],
  );

  const novaConversa = useCallback(() => {
    setConversaId(undefined);
    setMensagens([]);
  }, []);

  return { conversaId, mensagens, enviando, enviar, novaConversa, carregarHistorico };
}
