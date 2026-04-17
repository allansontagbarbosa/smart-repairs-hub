import { useEffect, useRef, useState, useCallback, Suspense } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { X, Camera, AlertTriangle, Loader2, Keyboard, Check, AlertCircle, XCircle } from "lucide-react";
import { playScanBeep } from "@/lib/audio-feedback";
import { cn } from "@/lib/utils";

export type ConferenciaScanResult = {
  /** "ok" = bateu com esperado / "warn" = existe em outro contexto / "error" = não cadastrado / "duplicate" = já contado */
  status: "ok" | "warn" | "error" | "duplicate";
  /** Texto curto que aparece no flash (ex.: nome do cliente, nome da peça + qtd) */
  label: string;
  /** Texto secundário opcional (ex.: status do aparelho) */
  sublabel?: string;
};

type Props = {
  open: boolean;
  onClose: () => void;
  title: string;
  /** Texto do contador no topo (ex.: "Conferidos: 8/15" ou "Itens únicos: 12/28 | Unidades: 47") */
  counterText: string;
  /** Quantos alertas amarelos/vermelhos acumulados (badge no topo) */
  alertCount?: number;
  /** Validação síncrona executada a cada leitura. Deve atualizar o state externo. */
  onScanCode: (code: string) => ConferenciaScanResult;
  /** Chamado ao clicar em "Finalizar conferência" */
  onFinalize: () => void;
};

type ScannerState = "idle" | "loading" | "scanning" | "denied" | "no-camera" | "error";
type RecentEntry = { code: string; result: ConferenciaScanResult; at: number };

function ScannerCore({
  onDetect,
  onError,
  onReady,
}: {
  onDetect: (code: string) => void;
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
          BarcodeFormat.CODE_128, BarcodeFormat.CODE_39, BarcodeFormat.CODE_93,
          BarcodeFormat.EAN_13, BarcodeFormat.EAN_8, BarcodeFormat.UPC_A, BarcodeFormat.UPC_E,
          BarcodeFormat.ITF, BarcodeFormat.QR_CODE, BarcodeFormat.DATA_MATRIX,
          BarcodeFormat.PDF_417, BarcodeFormat.AZTEC,
        ]);
        hints.set(DecodeHintType.TRY_HARDER, true);
        const reader = new BrowserMultiFormatReader(hints);
        onReady();
        const controls = await reader.decodeFromVideoElement(video!, (result) => {
          if (cancelled || stoppedRef.current) return;
          if (result) {
            const text = result.getText().trim();
            if (text) onDetectRef.current(text);
          }
        });
        controlsRef.current = controls;
      } catch (e: any) {
        if (cancelled) return;
        if (e?.name === "NotAllowedError" || e?.name === "PermissionDeniedError") onError("denied");
        else if (e?.name === "NotFoundError" || e?.name === "OverconstrainedError") onError("no-camera");
        else onError("error", e?.message || "Erro ao iniciar a câmera");
      }
    })();

    return () => {
      cancelled = true;
      stoppedRef.current = true;
      try { controlsRef.current?.stop(); } catch {}
      controlsRef.current = null;
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }
      if (videoRef.current) {
        try { videoRef.current.srcObject = null; } catch {}
      }
    };
  }, [onError, onReady]);

  return <video ref={videoRef} className="absolute inset-0 h-full w-full object-cover" playsInline muted autoPlay />;
}

export function ConferenciaScanner({
  open, onClose, title, counterText, alertCount = 0, onScanCode, onFinalize,
}: Props) {
  const [state, setState] = useState<ScannerState>("idle");
  const [errorMsg, setErrorMsg] = useState<string | undefined>();
  const [manualMode, setManualMode] = useState(false);
  const [manualValue, setManualValue] = useState("");
  const [recent, setRecent] = useState<RecentEntry[]>([]);
  const [flash, setFlash] = useState<RecentEntry | null>(null);
  const lastScanRef = useRef<{ code: string; time: number } | null>(null);

  useEffect(() => {
    if (open) {
      setState("loading");
      setErrorMsg(undefined);
      setManualMode(false);
      setManualValue("");
      setRecent([]);
      setFlash(null);
      lastScanRef.current = null;
    } else {
      setState("idle");
    }
  }, [open]);

  const handleError = useCallback((s: ScannerState, msg?: string) => {
    setState(s); setErrorMsg(msg);
  }, []);
  const handleReady = useCallback(() => setState("scanning"), []);

  const processCode = useCallback((code: string) => {
    const now = Date.now();
    if (lastScanRef.current?.code === code && now - lastScanRef.current.time < 1500) return;
    lastScanRef.current = { code, time: now };

    const result = onScanCode(code);
    const entry: RecentEntry = { code, result, at: now };

    if (result.status !== "duplicate") {
      playScanBeep();
      try { navigator.vibrate?.(result.status === "error" ? [80, 60, 80] : 80); } catch {}
    }

    setFlash(entry);
    window.setTimeout(() => setFlash((f) => (f && f.at === entry.at ? null : f)), 1100);
    setRecent((prev) => [entry, ...prev].slice(0, 3));
  }, [onScanCode]);

  const submitManual = () => {
    const v = manualValue.trim();
    if (!v) return;
    processCode(v);
    setManualValue("");
    setManualMode(false);
  };

  const flashColor = flash?.result.status === "ok" ? "bg-success/95 text-success-foreground"
    : flash?.result.status === "warn" ? "bg-warning/95 text-warning-foreground"
    : flash?.result.status === "duplicate" ? "bg-muted/95 text-foreground"
    : "bg-destructive/95 text-destructive-foreground";

  const flashIcon = flash?.result.status === "ok" ? <Check className="h-5 w-5" />
    : flash?.result.status === "warn" ? <AlertCircle className="h-5 w-5" />
    : flash?.result.status === "duplicate" ? <Check className="h-5 w-5 opacity-50" />
    : <XCircle className="h-5 w-5" />;

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent
        className="p-0 max-w-full sm:max-w-md w-screen sm:w-full h-[100dvh] sm:h-auto sm:max-h-[90vh] sm:rounded-lg overflow-hidden bg-black border-0 sm:border gap-0"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <div className="relative h-full w-full flex flex-col">
          {/* Header com contador */}
          <div className="absolute top-0 left-0 right-0 z-20 flex items-center justify-between p-3 bg-gradient-to-b from-black/80 to-transparent text-white">
            <div className="flex items-center gap-2 min-w-0">
              <Camera className="h-4 w-4 shrink-0" />
              <div className="min-w-0">
                <div className="text-sm font-medium truncate">{title}</div>
                <div className="text-xs text-white/80 font-mono">{counterText}</div>
              </div>
              {alertCount > 0 && (
                <Badge variant="destructive" className="ml-2 shrink-0">
                  {alertCount} alerta{alertCount === 1 ? "" : "s"}
                </Badge>
              )}
            </div>
            <Button size="icon" variant="ghost" className="text-white hover:bg-white/10 h-9 w-9 shrink-0" onClick={onClose} aria-label="Fechar">
              <X className="h-5 w-5" />
            </Button>
          </div>

          {/* Câmera */}
          <div className="relative flex-1 min-h-[60vh] sm:min-h-[420px] bg-black">
            {!manualMode && open && (state === "loading" || state === "scanning") && (
              <Suspense fallback={null}>
                <ScannerCore onDetect={processCode} onError={handleError} onReady={handleReady} />
              </Suspense>
            )}

            {state === "loading" && !manualMode && (
              <div className="absolute inset-0 flex flex-col items-center justify-center text-white gap-3 z-10">
                <Loader2 className="h-8 w-8 animate-spin" />
                <p className="text-sm">Iniciando câmera...</p>
              </div>
            )}

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

            {/* Flash de feedback */}
            {flash && !manualMode && (
              <div className="absolute inset-0 z-20 flex items-center justify-center pointer-events-none p-6">
                <div className={cn("px-5 py-3 rounded-lg flex items-center gap-2 text-sm font-semibold shadow-xl animate-in fade-in zoom-in-95 max-w-full", flashColor)}>
                  {flashIcon}
                  <div className="min-w-0">
                    <div className="truncate">{flash.result.label}</div>
                    {flash.result.sublabel && <div className="text-xs opacity-90 truncate font-normal">{flash.result.sublabel}</div>}
                  </div>
                </div>
              </div>
            )}

            {/* Erros câmera */}
            {(state === "denied" || state === "no-camera" || state === "error") && !manualMode && (
              <div className="absolute inset-0 z-10 flex flex-col items-center justify-center p-6 text-center text-white gap-4">
                <AlertTriangle className="h-10 w-10 text-warning" />
                {state === "denied" && (<><h3 className="font-semibold text-lg">Permissão negada</h3><p className="text-sm text-white/80 max-w-xs">Habilite a câmera nas configurações do navegador.</p></>)}
                {state === "no-camera" && (<><h3 className="font-semibold text-lg">Câmera indisponível</h3><p className="text-sm text-white/80 max-w-xs">Use o modo manual para digitar códigos.</p></>)}
                {state === "error" && (<><h3 className="font-semibold text-lg">Erro</h3><p className="text-sm text-white/80 max-w-xs">{errorMsg}</p></>)}
                <div className="flex gap-2">
                  {state !== "no-camera" && <Button onClick={() => { setState("loading"); setErrorMsg(undefined); }}>Tentar novamente</Button>}
                  <Button variant="secondary" onClick={() => setManualMode(true)}><Keyboard className="h-4 w-4 mr-2" /> Digitar</Button>
                </div>
              </div>
            )}

            {/* Modo manual */}
            {manualMode && (
              <div className="absolute inset-0 z-10 flex flex-col items-center justify-center p-6 gap-4 bg-background text-foreground">
                <Keyboard className="h-8 w-8 text-muted-foreground" />
                <h3 className="font-semibold">Digitar código manualmente</h3>
                <Input autoFocus value={manualValue} onChange={(e) => setManualValue(e.target.value)} onKeyDown={(e) => e.key === "Enter" && submitManual()} placeholder="IMEI ou código de barras" className="max-w-xs" />
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => setManualMode(false)}>Voltar à câmera</Button>
                  <Button onClick={submitManual} disabled={!manualValue.trim()}>Conferir</Button>
                </div>
              </div>
            )}
          </div>

          {/* Rodapé: últimos 3 + finalizar */}
          {state === "scanning" && !manualMode && (
            <div className="absolute bottom-0 left-0 right-0 z-20 bg-gradient-to-t from-black/95 via-black/80 to-transparent p-3 space-y-2">
              {recent.length > 0 && (
                <div className="space-y-1">
                  {recent.map((r) => (
                    <div key={`${r.code}-${r.at}`} className={cn(
                      "flex items-center gap-2 backdrop-blur rounded px-3 py-1.5 text-xs text-white",
                      r.result.status === "ok" && "bg-success/30",
                      r.result.status === "warn" && "bg-warning/30",
                      r.result.status === "error" && "bg-destructive/30",
                      r.result.status === "duplicate" && "bg-white/15",
                    )}>
                      <div className="shrink-0">
                        {r.result.status === "ok" && <Check className="h-3.5 w-3.5" />}
                        {r.result.status === "warn" && <AlertCircle className="h-3.5 w-3.5" />}
                        {r.result.status === "error" && <XCircle className="h-3.5 w-3.5" />}
                        {r.result.status === "duplicate" && <Check className="h-3.5 w-3.5 opacity-60" />}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="truncate font-medium">{r.result.label}</div>
                        {r.result.sublabel && <div className="truncate opacity-80 text-[10px]">{r.result.sublabel}</div>}
                      </div>
                      <span className="font-mono text-[10px] opacity-60 shrink-0">{r.code.slice(-6)}</span>
                    </div>
                  ))}
                </div>
              )}
              <div className="flex gap-2">
                <Button variant="secondary" size="sm" onClick={() => setManualMode(true)} className="bg-white/15 text-white hover:bg-white/25 border-0 backdrop-blur shrink-0">
                  <Keyboard className="h-4 w-4" />
                </Button>
                <Button className="flex-1" size="lg" onClick={onFinalize}>
                  Finalizar conferência
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
