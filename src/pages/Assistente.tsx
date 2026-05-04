import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useSearchParams } from "react-router-dom";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { Plus, MessageSquare, Sparkles } from "lucide-react";
import { PainelChatIA } from "@/components/ia/PainelChatIA";

interface Conversa {
  id: string;
  titulo: string | null;
  atualizado_em: string;
}

export default function Assistente() {
  const [conversas, setConversas] = useState<Conversa[]>([]);
  const [params, setParams] = useSearchParams();
  const conversaSelecionada = params.get("c") ?? undefined;
  const [painelAberto, setPainelAberto] = useState(true);

  const carregar = async () => {
    const { data } = await supabase
      .from("ia_conversas")
      .select("id, titulo, atualizado_em")
      .is("deleted_at", null)
      .order("atualizado_em", { ascending: false })
      .limit(50);
    setConversas((data ?? []) as Conversa[]);
  };

  useEffect(() => {
    carregar();
  }, []);

  return (
    <div className="grid grid-cols-1 md:grid-cols-[280px_1fr] gap-4 h-[calc(100vh-8rem)]">
      {/* Sidebar de conversas */}
      <aside className="border rounded-xl bg-card p-3 flex flex-col min-h-0">
        <Button
          onClick={() => {
            setParams({});
            setPainelAberto(true);
          }}
          className="w-full mb-3"
          variant="outline"
        >
          <Plus className="h-4 w-4 mr-2" /> Nova conversa
        </Button>
        <div className="space-y-1 overflow-y-auto flex-1">
          {conversas.map((c) => (
            <button
              key={c.id}
              onClick={() => {
                setParams({ c: c.id });
                setPainelAberto(true);
              }}
              className={`block w-full text-left rounded-lg px-3 py-2 hover:bg-muted text-sm transition-colors ${
                conversaSelecionada === c.id ? "bg-muted" : ""
              }`}
            >
              <div className="flex items-center gap-2">
                <MessageSquare className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                <span className="truncate">{c.titulo ?? "Sem título"}</span>
              </div>
              <div className="text-[10px] text-muted-foreground mt-0.5 ml-5">
                {format(new Date(c.atualizado_em), "dd/MM HH:mm", { locale: ptBR })}
              </div>
            </button>
          ))}
          {conversas.length === 0 && (
            <p className="text-xs text-muted-foreground text-center py-6">
              Nenhuma conversa ainda.
            </p>
          )}
        </div>
      </aside>

      {/* Painel do chat */}
      <div className="relative">
        <PainelChatIA
          open={painelAberto}
          onClose={() => setPainelAberto(false)}
          conversaIdInicial={conversaSelecionada}
        />
        {!painelAberto && (
          <div className="border rounded-xl bg-card flex items-center justify-center h-full">
            <div className="text-center text-muted-foreground">
              <Sparkles className="h-10 w-10 mx-auto mb-3 text-[#00C896]" />
              <p className="text-sm">Selecione uma conversa ou inicie uma nova.</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
