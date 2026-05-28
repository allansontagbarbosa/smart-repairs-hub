import { useState } from "react";
import { Sparkles } from "lucide-react";
import { PainelChatIA } from "./PainelChatIA";

export function BotaoFlutuanteIA() {
  const [aberto, setAberto] = useState(false);

  return (
    <>
      {!aberto && (
        <button
          onClick={() => setAberto(true)}
          className="fixed bottom-[calc(env(safe-area-inset-bottom,0px)+80px)] lg:bottom-6 right-4 lg:right-6 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-[#00C896] text-white shadow-lg shadow-[#00C896]/30 hover:scale-105 active:scale-95 transition-transform"
          aria-label="Abrir assistente IA"
        >
          <Sparkles className="h-6 w-6" />
        </button>
      )}
      <PainelChatIA open={aberto} onClose={() => setAberto(false)} />
    </>
  );
}
