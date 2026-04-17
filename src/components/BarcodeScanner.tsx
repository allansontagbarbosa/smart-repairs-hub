import { useEffect, useRef, useState, Suspense } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { X, Camera, AlertTriangle, Loader2, Keyboard } from "lucide-react";

interface Props {
  open: boolean;
  onClose: () => void;
  onScan: (code: string) => void;
  title?: string;
}

type ScannerState = "idle" | "loading" | "scanning" | "denied" | "no-camera" | "error";

/**
 * Scanner contínuo via câmera. Compatível com iOS Safari:
 * - playsInline (não abre fullscreen nativo)
 * - resolução alta (1920x1080) — necessária pra ler códigos finos
 * - facingMode 'environment' — câmera traseira
 * - decodeFromVideoElement em loop contínuo
 */
function ScannerCore({ onScan, onError, onReady }: {
  onScan: (code: string) => void;
  onError: (state: ScannerState, msg?: string) => void;
  onReady: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const controlsRef = useRef<{ stop: () => void } | null>(null);
  const stoppedRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    stoppedRef.current = false;

    (async () => {
      try {
        if (!navigator.mediaDevices?.getUserMedia) {
          onError("no-camera", "Câmera não disponível neste dispositivo/navegador");
          return;
        }

        // Resolução ALTA é crítica pra iOS detectar códigos de barras finos
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: "environment" },
            width: { ideal: 1920 },
            height: { ideal: 1080 },
            // Foco contínuo melhora leitura em Android; iOS ignora silenciosamente
            advanced: [{ focusMode: "continuous" } as any],
          },
          audio: false,
        });

        if (cancelled) {
          stream.getTracks().forEach(t => t.stop());
          return;
        }

        streamRef.current = stream;

        const video = videoRef.current;
        if (video) {
          video.srcObject = stream;
          // Atributos críticos pra iOS Safari não abrir em fullscreen nativo
          video.setAttribute("playsinline", "true");
          video.setAttribute("webkit-playsinline", "true");
          video.setAttribute("muted", "true");
          video.setAttribute("autoplay", "true");
          video.muted = true;
          video.playsInline = true;
          await video.play().catch(() => {});
        }

        // Carregar motor zxing dinamicamente (lazy)
        const [{ BrowserMultiFormatReader }, { DecodeHintType, BarcodeFormat }] = await Promise.all([
          import("@zxing/browser"),
          import("@zxing/library"),
        ]);
        if (cancelled) return;

        // Hints: aceitar formatos comuns + try harder (mais lento porém preciso)
        const hints = new Map();
        hints.set(DecodeHintType.POSSIBLE_FORMATS, [
          BarcodeFormat.CODE_128,
          BarcodeFormat.CODE_39,
          BarcodeFormat.CODE_93,
          BarcodeFormat.EAN_13,
          BarcodeFormat.EAN_8,
          BarcodeFormat.UPC_A,
          BarcodeFormat.UPC_E,
          BarcodeFormat.ITF,
          BarcodeFormat.QR_CODE,
          BarcodeFormat.DATA_MATRIX,
          BarcodeFormat.PDF_417,
          BarcodeFormat.AZTEC,
        ]);
        hints.set(DecodeHintType.TRY_HARDER, true);

        const reader = new BrowserMultiFormatReader(hints);
        onReady();

        // Leitura CONTÍNUA em loop a partir do <video>
        const controls = await reader.decodeFromVideoElement(
          video!,
          (result, err) => {
            if (cancelled || stoppedRef.current) return;
            if (result) {
              const text = result.getText().trim();
              if (text) {
                stoppedRef.current = true;
                try { navigator.vibrate?.(80); } catch {}
                onScan(text);
              }
            }
            // NotFoundException é normal enquanto procura — ignorar
            if (err && err.name && err.name !== "NotFoundException" && err.name !== "ChecksumException" && err.name !== "FormatException") {
              // eslint-disable-next-line no-console
              console.warn("[BarcodeScanner]", err.name, err.message);
            }
          }
        );
        controlsRef.current = controls;
      } catch (e: any) {
        if (cancelled) return;
        // eslint-disable-next-line no-console
        console.error("[BarcodeScanner] init error:", e);
        if (e?.name === "NotAllowedError" || e?.name === "PermissionDeniedError") {
          onError("denied");
        } else if (e?.name === "NotFoundError" || e?.name === "OverconstrainedError") {
          onError("no-camera");
        } else {
          onError("error", e?.message || "Erro ao iniciar a câmera");
        }
      }
    })();

    return () => {
      cancelled = true;
      stoppedRef.current = true;
      try { controlsRef.current?.stop(); } catch {}
      controlsRef.current = null;
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop());
        streamRef.current = null;
      }
      if (videoRef.current) {
        try { videoRef.current.srcObject = null; } catch {}
      }
    };
  }, [onScan, onError, onReady]);

  return (
    <video
      ref={videoRef}
      className="absolute inset-0 h-full w-full object-cover"
      playsInline
      muted
      autoPlay
    />
  );
}

export function BarcodeScanner({ open, onClose, onScan, title = "Escanear código" }: Props) {
  const [state, setState] = useState<ScannerState>("idle");
  const [errorMsg, setErrorMsg] = useState<string | undefined>();
  const [manualMode, setManualMode] = useState(false);
  const [manualValue, setManualValue] = useState("");

  useEffect(() => {
    if (open) {
      setState("loading");
      setErrorMsg(undefined);
      setManualMode(false);
      setManualValue("");
    } else {
      setState("idle");
    }
  }, [open]);

  const handleScan = (code: string) => {
    onScan(code);
    onClose();
  };

  const handleError = (s: ScannerState, msg?: string) => {
    setState(s);
    setErrorMsg(msg);
  };

  const submitManual = () => {
    const v = manualValue.trim();
    if (!v) return;
    onScan(v);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent
        className="p-0 max-w-full sm:max-w-md w-screen sm:w-full h-[100dvh] sm:h-auto sm:max-h-[90vh] sm:rounded-lg overflow-hidden bg-black border-0 sm:border gap-0"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <div className="relative h-full w-full flex flex-col">
          {/* Header */}
          <div className="absolute top-0 left-0 right-0 z-20 flex items-center justify-between p-3 bg-gradient-to-b from-black/70 to-transparent text-white">
            <div className="flex items-center gap-2">
              <Camera className="h-4 w-4" />
              <span className="text-sm font-medium">{title}</span>
            </div>
            <Button
              size="icon"
              variant="ghost"
              className="text-white hover:bg-white/10 h-9 w-9"
              onClick={onClose}
              aria-label="Fechar scanner"
            >
              <X className="h-5 w-5" />
            </Button>
          </div>

          {/* Conteúdo */}
          <div className="relative flex-1 min-h-[60vh] sm:min-h-[420px] bg-black">
            {!manualMode && open && (state === "loading" || state === "scanning") && (
              <Suspense fallback={null}>
                <ScannerCore
                  onScan={handleScan}
                  onError={handleError}
                  onReady={() => setState("scanning")}
                />
              </Suspense>
            )}

            {/* Loading */}
            {state === "loading" && !manualMode && (
              <div className="absolute inset-0 flex flex-col items-center justify-center text-white gap-3 z-10">
                <Loader2 className="h-8 w-8 animate-spin" />
                <p className="text-sm">Iniciando câmera...</p>
              </div>
            )}

            {/* Mira */}
            {state === "scanning" && !manualMode && (
              <div className="absolute inset-0 z-10 pointer-events-none flex items-center justify-center">
                <div className="relative w-[80%] max-w-sm aspect-[4/3]">
                  <div className="absolute inset-0 border-2 border-white/30 rounded-lg" />
                  <div className="absolute -top-px -left-px w-8 h-8 border-t-4 border-l-4 border-primary rounded-tl-lg" />
                  <div className="absolute -top-px -right-px w-8 h-8 border-t-4 border-r-4 border-primary rounded-tr-lg" />
                  <div className="absolute -bottom-px -left-px w-8 h-8 border-b-4 border-l-4 border-primary rounded-bl-lg" />
                  <div className="absolute -bottom-px -right-px w-8 h-8 border-b-4 border-r-4 border-primary rounded-br-lg" />
                  <div className="absolute left-2 right-2 top-1/2 h-0.5 bg-primary/80 animate-pulse" />
                </div>
              </div>
            )}

            {/* Erros */}
            {(state === "denied" || state === "no-camera" || state === "error") && !manualMode && (
              <div className="absolute inset-0 z-10 flex flex-col items-center justify-center p-6 text-center text-white gap-4">
                <AlertTriangle className="h-10 w-10 text-warning" />
                {state === "denied" && (
                  <>
                    <h3 className="font-semibold text-lg">Permissão negada</h3>
                    <p className="text-sm text-white/80 max-w-xs">
                      Habilite o acesso à câmera nas configurações do navegador (cadeado ao lado da URL) e tente novamente.
                    </p>
                  </>
                )}
                {state === "no-camera" && (
                  <>
                    <h3 className="font-semibold text-lg">Câmera indisponível</h3>
                    <p className="text-sm text-white/80 max-w-xs">
                      Não encontramos uma câmera neste dispositivo. Use o modo manual.
                    </p>
                  </>
                )}
                {state === "error" && (
                  <>
                    <h3 className="font-semibold text-lg">Erro ao iniciar câmera</h3>
                    <p className="text-sm text-white/80 max-w-xs">{errorMsg}</p>
                  </>
                )}
                <div className="flex gap-2">
                  {state !== "no-camera" && (
                    <Button onClick={() => { setState("loading"); setErrorMsg(undefined); }}>
                      Tentar novamente
                    </Button>
                  )}
                  <Button variant="secondary" onClick={() => setManualMode(true)}>
                    <Keyboard className="h-4 w-4 mr-2" /> Digitar
                  </Button>
                </div>
              </div>
            )}

            {/* Manual */}
            {manualMode && (
              <div className="absolute inset-0 z-10 flex flex-col items-center justify-center p-6 gap-4 bg-background text-foreground">
                <Keyboard className="h-8 w-8 text-muted-foreground" />
                <h3 className="font-semibold">Digitar código manualmente</h3>
                <Input
                  autoFocus
                  value={manualValue}
                  onChange={(e) => setManualValue(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && submitManual()}
                  placeholder="Ex.: 7891234567890"
                  className="max-w-xs"
                />
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => setManualMode(false)}>Voltar à câmera</Button>
                  <Button onClick={submitManual} disabled={!manualValue.trim()}>Confirmar</Button>
                </div>
              </div>
            )}
          </div>

          {/* Rodapé com botão manual */}
          {state === "scanning" && !manualMode && (
            <div className="absolute bottom-0 left-0 right-0 z-20 p-3 bg-gradient-to-t from-black/70 to-transparent flex justify-center">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setManualMode(true)}
                className="bg-white/15 text-white hover:bg-white/25 border-0 backdrop-blur"
              >
                <Keyboard className="h-4 w-4 mr-2" /> Digitar manualmente
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default BarcodeScanner;
