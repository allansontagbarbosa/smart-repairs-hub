import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Sparkles, Send, Loader2, X, Plus, Copy, MessageCircle } from "lucide-react";
import { useChatIA, MensagemChat } from "@/hooks/useChatIA";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

function ehExportavel(texto: string): boolean {
  return texto.length > 200 && /\d|R\$|•|-/.test(texto);
}

function copiar(texto: string) {
  navigator.clipboard.writeText(texto);
  toast.success("Copiado!");
}

function abrirWhatsApp(texto: string) {
  const url = `https://wa.me/?text=${encodeURIComponent(texto)}`;
  window.open(url, "_blank");
}

interface Props {
  open: boolean;
  onClose: () => void;
  conversaIdInicial?: string;
  promptInicial?: string;
  contextoOrigem?: string;
}

export function PainelChatIA({
  open,
  onClose,
  conversaIdInicial,
  promptInicial,
  contextoOrigem,
}: Props) {
  const { mensagens, enviando, enviar, novaConversa, carregarHistorico } =
    useChatIA(conversaIdInicial);
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const promptInicialEnviado = useRef(false);

  useEffect(() => {
    if (conversaIdInicial) carregarHistorico(conversaIdInicial);
  }, [conversaIdInicial, carregarHistorico]);

  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [mensagens, enviando]);

  useEffect(() => {
    if (open && promptInicial && !promptInicialEnviado.current) {
      promptInicialEnviado.current = true;
      enviar(promptInicial);
    }
    if (!open) promptInicialEnviado.current = false;
  }, [open, promptInicial, enviar]);

  if (!open) return null;

  const handleSubmit = () => {
    enviar(input);
    setInput("");
  };

  const sugestoes = [
    "Qual meu faturamento esta semana?",
    "Quais OS estão em risco de atraso?",
    "Lista de compras de peças que estão acabando",
    "Por que a margem caiu este mês?",
  ];

  return (
    <div className="fixed inset-0 sm:inset-auto sm:right-4 sm:bottom-4 sm:top-4 z-50 flex w-full sm:w-full sm:max-w-md flex-col rounded-none sm:rounded-2xl border bg-card shadow-2xl">
      {/* Header */}
      <header className="flex items-center justify-between gap-2 border-b px-4 py-3">
        <div className="flex items-center gap-2 min-w-0">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#00C896]/15 text-[#00C896]">
            <Sparkles className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <h2 className="text-sm font-semibold leading-tight">Assistente Ditt</h2>
            {contextoOrigem && (
              <p className="text-[10px] text-muted-foreground truncate">
                Contexto: {contextoOrigem}
              </p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1">
          <Button
            size="icon"
            variant="ghost"
            className="h-8 w-8"
            onClick={novaConversa}
            title="Nova conversa"
          >
            <Plus className="h-4 w-4" />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            className="h-8 w-8"
            onClick={onClose}
            title="Fechar"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </header>

      {/* Mensagens */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
        {mensagens.length === 0 && !enviando && (
          <div className="flex flex-col items-center justify-center h-full text-center gap-4 py-8">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#00C896]/15 text-[#00C896]">
              <Sparkles className="h-6 w-6" />
            </div>
            <p className="text-sm text-muted-foreground max-w-xs">
              Olá! Como posso ajudar hoje?
            </p>
            <div className="w-full space-y-1.5">
              {sugestoes.map((s) => (
                <button
                  key={s}
                  onClick={() => enviar(s)}
                  className="block w-full rounded-lg border border-border bg-muted/30 px-3 py-2 text-left text-sm hover:bg-muted transition-colors"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {mensagens.map((m: MensagemChat) => (
          <div
            key={m.id}
            className={cn(
              "flex",
              m.papel === "user" ? "justify-end" : "justify-start",
            )}
          >
            <div
              className={cn(
                "max-w-[85%] rounded-2xl px-3 py-2 text-sm whitespace-pre-wrap break-words",
                m.papel === "user"
                  ? "bg-[#00C896] text-white rounded-br-sm"
                  : "bg-muted text-foreground rounded-bl-sm",
              )}
            >
              {m.conteudo}
            </div>
          </div>
        ))}

        {enviando && (
          <div className="flex justify-start">
            <div className="rounded-2xl rounded-bl-sm bg-muted px-3 py-2">
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <footer className="border-t px-3 py-2">
        <div className="flex items-end gap-2">
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSubmit();
              }
            }}
            placeholder="Pergunte algo..."
            rows={1}
            className="min-h-[40px] resize-none"
            disabled={enviando}
          />
          <Button
            onClick={handleSubmit}
            disabled={enviando || !input.trim()}
            size="icon"
            className="bg-[#00C896] hover:bg-[#00C896]/90"
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
        <p className="mt-1.5 text-[10px] text-muted-foreground text-center">
          Respostas geradas por IA podem conter erros. Confira sempre.
        </p>
      </footer>
    </div>
  );
}
