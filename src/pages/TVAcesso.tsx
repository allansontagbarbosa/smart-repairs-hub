import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";

export default function TVAcesso() {
  const navigate = useNavigate();
  const [digitos, setDigitos] = useState<string[]>(["", "", "", "", "", ""]);
  const inputsRef = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    inputsRef.current[0]?.focus();
  }, []);

  const submitIfComplete = (arr: string[]) => {
    const codigo = arr.join("");
    if (codigo.length === 6 && arr.every((d) => d !== "")) {
      setTimeout(() => navigate(`/tv/d/${codigo}`), 250);
    }
  };

  const handleChange = (idx: number, val: string) => {
    const novo = val.replace(/\D/g, "").slice(-1);
    const arr = [...digitos];
    arr[idx] = novo;
    setDigitos(arr);
    if (novo && idx < 5) inputsRef.current[idx + 1]?.focus();
    if (idx === 5 && novo) submitIfComplete(arr);
  };

  const handleKeyDown = (idx: number, e: React.KeyboardEvent) => {
    if (e.key === "Backspace" && !digitos[idx] && idx > 0) {
      inputsRef.current[idx - 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const txt = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    if (txt.length === 6) {
      const arr = txt.split("");
      setDigitos(arr);
      submitIfComplete(arr);
    }
  };

  const proximoIdx = digitos.findIndex((x) => !x);

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white flex flex-col items-center justify-center p-6">
      <div className="h-16 w-16 rounded-2xl bg-[#00C896] flex items-center justify-center text-3xl font-black mb-6">
        D
      </div>
      <h1 className="text-3xl font-bold mb-2">Ditt TV</h1>
      <p className="text-sm text-white/60 mb-10 text-center max-w-md">
        Digite o código mostrado no seu painel admin
      </p>

      <div className="flex gap-2 sm:gap-3" onPaste={handlePaste}>
        {digitos.map((d, i) => (
          <input
            key={i}
            ref={(el) => (inputsRef.current[i] = el)}
            type="text"
            inputMode="numeric"
            maxLength={1}
            value={d}
            onChange={(e) => handleChange(i, e.target.value)}
            onKeyDown={(e) => handleKeyDown(i, e)}
            className={`w-12 h-16 sm:w-16 sm:h-20 bg-[#131313] border-2 rounded-xl text-center font-mono text-3xl sm:text-4xl font-bold text-[#00C896] focus:outline-none transition-all ${
              d ? "border-[#00C896]" : "border-[#1f1f1f]"
            } ${proximoIdx === i ? "border-[#00C896] ring-4 ring-[#00C896]/20" : ""}`}
          />
        ))}
      </div>

      <p className="mt-10 text-xs text-white/40 text-center max-w-md leading-relaxed">
        Acesse esta URL em qualquer dispositivo conectado à TV.<br />
        Digite o código de 6 dígitos e pronto.
      </p>
    </div>
  );
}
