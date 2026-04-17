import { useEffect, useRef, useState, Suspense, useCallback } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { X, Camera, AlertTriangle, Loader2, Keyboard, Check, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { playScanBeep } from "@/lib/audio-feedback";

interface Props {
  open: boolean;
  onClose: () => void;
  /** Modo single: chamado a cada leitura (e fecha). Modo batch: opcional. */
  onScan?: (code: string) => void;
  /** Modo batch: chamado ao concluir com a lista de códigos únicos. */
  onBatchComplete?: (codes: string[]) => void;
  mode?: "single" | "batch";
  title?: string;
}

type ScannerState = "idle" | "loading" | "scanning" | "denied" | "no-camera" | "error";

/**
 * Scanner contínuo via câmera. Compatível com iOS Safari.
 * Suporta modo "single" (uma leitura, fecha) e "batch" (várias leituras em sequência).
 */
function ScannerCore({
  onDetect,
  onError,
  onReady,
}: {
  onDetect: (code: string) => boolean; // retorna true se deve PARAR o loop
  onError: (state: ScannerState, msg?: string) => void;
  onReady: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const controlsRef = useRef<{ stop: () => void } | null>(null);
  const stoppedRef = useRef(false);
  const onDetectRef = useRef(onDetect);
  onDetectRef.current = onDetect;

  useEffect(() => {
    let cancelled = false;
    stoppedRef.current = false;

    (async () => {
      try {
        if (!navigator.mediaDevices?.getUserMedia) {
          onError("no-camera", "Câmera não disponível neste dispositivo/navegador");
          return;
        }

        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: "environment" },
            width: { ideal: 1920 },
            height: { ideal: 1080 },
            advanced: [{ focusMode: "continuous" } as any],
          },
          audio: false,
        });

        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }

        streamRef.current = stream;

        const video = videoRef.current;
        if (video) {
          video.srcObject = stream;
          video.setAttribute("playsinline", "true");
          video.setAttribute("webkit-playsinline", "true");
          video.setAttribute("muted", "true");
          video.setAttribute("autoplay", "true");
          video.muted = true;
          video.playsInline = true;
          await video.play().catch(() => {});
        }

        const [{ BrowserMultiFormatReader }, { DecodeHintType, BarcodeFormat }] = await Promise.all([
          import("@zxing/browser"),
          import("@zxing/library"),
        ]);
        if (cancelled) return;

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

        const controls = await reader.decodeFromVideoElement(video!, (result, err) => {
          if (cancelled || stoppedRef.current) return;
          if (result) {
            const text = result.getText().trim();
            if (text) {
              const shouldStop = onDetectRef.current(text);
              if (shouldStop) {
                stoppedRef.current = true;
              }
            }
          }
          if (
            err &&
            err.name &&
            err.name !== "NotFoundException" &&
            err.name !== "ChecksumException" &&
            err.name !== "FormatException"
          ) {
            // eslint-disable-next-line no-console
            console.warn("[BarcodeScanner]", err.name, err.message);
          }
        });
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
      try {
        controlsRef.current?.stop();
      } catch {}
      controlsRef.current = null;
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }
      if (videoRef.current) {
        try {
          videoRef.current.srcObject = null;
        } catch {}
      }
    };
  }, [onError, onReady]);

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

export function BarcodeScanner({
  open,
  onClose,
  onScan,
  onBatchComplete,
  mode = "single",
  title = "Escanear código",
}: Props) {
  const [state, setState] = useState<ScannerState>("idle");
  const [errorMsg, setErrorMsg] = useState<string | undefined>();
  const [manualMode, setManualMode] = useState(false);
  const [manualValue, setManualValue] = useState("");
  const [capturedCodes, setCapturedCodes] = useState<string[]>([]);
  const [flashCode, setFlashCode] = useState<string | null>(null);
  const lastScanRef = useRef<{ code: string; time: number } | null>(null);

  useEffect(() => {
    if (open) {
      setState("loading");
      setErrorMsg(undefined);
      setManualMode(false);
      setManualValue("");
      setCapturedCodes([]);
      setFlashCode(null);
      lastScanRef.current = null;
    } else {
      setState("idle");
    }
  }, [open]);

  const handleError = useCallback((s: ScannerState, msg?: string) => {
    setState(s);
    setErrorMsg(msg);
  }, []);

  const handleReady = useCallback(() => setState("scanning"), []);

  // Retorna true para parar o loop (apenas no modo single).
  const handleDetect = useCallback(
    (code: string): boolean => {
      const now = Date.now();
      // Anti-duplicata: mesma leitura em < 2s
      if (lastScanRef.current?.code === code && now - lastScanRef.current.time < 2000) {
        return false;
      }
      lastScanRef.current = { code, time: now };

      if (mode === "single") {
        playScanBeep();
        try {
          navigator.vibrate?.(80);
        } catch {}
        onScan?.(code);
        onClose();
        return true;
      }

      // Batch
      setCapturedCodes((prev) => {
        if (prev.includes(code)) {
          toast.warning("Código já escaneado", { description: code });
          return prev;
        }
        playScanBeep();
        try {
          navigator.vibrate?.(80);
        } catch {}
        setFlashCode(code);
        window.setTimeout(() => setFlashCode((f) => (f === code ? null : f)), 900);
        return [...prev, code];
      });
      return false;
    },
    [mode, onScan, onClose],
  );

  const submitManual = () => {
    const v = manualValue.trim();
    if (!v) return;
    if (mode === "batch") {
      setCapturedCodes((prev) => (prev.includes(v) ? prev : [...prev, v]));
      setManualValue("");
      setManualMode(false);
      return;
    }
    onScan?.(v);
    onClose();
  };

  const handleConcluirBatch = () => {
    if (capturedCodes.length === 0) {
      onClose();
      return;
    }
    onBatchComplete?.(capturedCodes);
    onClose();
  };

  const handleAttemptClose = () => {
    if (mode === "batch" && capturedCodes.length > 0) {
      if (!window.confirm(`Descartar ${capturedCodes.length} código(s) capturado(s)?`)) return;
    }
    onClose();
  };

  const removeCode = (code: string) => {
    setCapturedCodes((prev) => prev.filter((c) => c !== code));
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) handleAttemptClose();
      }}
    >
      <DialogContent
        className="p-0 max-w-full sm:max-w-md w-screen sm:w-full h-[100dvh] sm:h-auto sm:max-h-[90vh] sm:rounded-lg overflow-hidden bg-black border-0 sm:border gap-0"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <div className="relative h-full w-full flex flex-col">
          {/* Header */}
          <div className="absolute top-0 left-0 right-0 z-20 flex items-center justify-between p-3 bg-gradient-to-b from-black/70 to-transparent text-white">
            <div className="flex items-center gap-2 min-w-0">
              <Camera className="h-4 w-4 shrink-0" />
              <span className="text-sm font-medium truncate">{title}</span>
              {mode === "batch" && (
                <Badge variant="secondary" className="ml-2 shrink-0">
                  {capturedCodes.length}
                </Badge>
              )}
            </div>
            <Button
              size="icon"
              variant="ghost"
              className="text-white hover:bg-white/10 h-9 w-9 shrink-0"
              onClick={handleAttemptClose}
              aria-label="Fechar scanner"
            >
              <X className="h-5 w-5" />
            </Button>
          </div>

          {/* Conteúdo */}
          <div className="relative flex-1 min-h-[60vh] sm:min-h-[420px] bg-black">
            {!manualMode && open && (state === "loading" || state === "scanning") && (
              <Suspense fallback={null}>
                <ScannerCore onDetect={handleDetect} onError={handleError} onReady={handleReady} />
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

            {/* Flash de confirmação (modo batch) */}
            {flashCode && !manualMode && (
              <div className="absolute inset-0 z-20 flex items-center justify-center pointer-events-none">
                <div className="bg-success/90 text-success-foreground px-6 py-4 rounded-lg flex items-center gap-2 text-base font-semibold shadow-lg animate-in fade-in zoom-in-95">
                  <Check className="h-5 w-5" />
                  <span className="font-mono">{flashCode}</span>
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
                    <Button
                      onClick={() => {
                        setState("loading");
                        setErrorMsg(undefined);
                      }}
                    >
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
                  <Button variant="outline" onClick={() => setManualMode(false)}>
                    Voltar à câmera
                  </Button>
                  <Button onClick={submitManual} disabled={!manualValue.trim()}>
                    {mode === "batch" ? "Adicionar" : "Confirmar"}
                  </Button>
                </div>
              </div>
            )}
          </div>

          {/* Rodapé modo batch — lista + concluir */}
          {mode === "batch" && state === "scanning" && !manualMode && (
            <div className="absolute bottom-0 left-0 right-0 z-20 bg-gradient-to-t from-black/90 via-black/70 to-transparent p-3 space-y-2">
              {capturedCodes.length > 0 && (
                <div className="space-y-1 max-h-32 overflow-y-auto">
                  {capturedCodes
                    .slice(-3)
                    .reverse()
                    .map((code) => (
                      <div
                        key={code}
                        className="flex items-center justify-between bg-white/10 backdrop-blur text-white rounded px-3 py-1.5 text-sm"
                      >
                        <span className="truncate font-mono">{code}</span>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7 text-white hover:bg-white/10 shrink-0"
                          onClick={() => removeCode(code)}
                          aria-label={`Remover ${code}`}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    ))}
                </div>
              )}
              <div className="flex gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setManualMode(true)}
                  className="bg-white/15 text-white hover:bg-white/25 border-0 backdrop-blur shrink-0"
                >
                  <Keyboard className="h-4 w-4" />
                </Button>
                <Button
                  className="flex-1"
                  size="lg"
                  onClick={handleConcluirBatch}
                  disabled={capturedCodes.length === 0}
                >
                  Concluir ({capturedCodes.length})
                </Button>
              </div>
            </div>
          )}

          {/* Rodapé modo single — apenas botão manual */}
          {mode === "single" && state === "scanning" && !manualMode && (
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
