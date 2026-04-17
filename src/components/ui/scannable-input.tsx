import * as React from "react";
import { Camera } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useIsMobile } from "@/hooks/use-mobile";
import BarcodeScanner from "@/components/BarcodeScanner";
import { cn } from "@/lib/utils";

export interface ScannableInputProps extends React.ComponentProps<"input"> {
  /** Título exibido no header do scanner */
  scannerTitle?: string;
  /** Permite desligar o botão de scanner (default: true) */
  showScannerButton?: boolean;
  /**
   * Forçar exibição do botão também em desktop (útil em estações com webcam).
   * Default: false (apenas mobile).
   */
  alwaysShowScanner?: boolean;
}

/**
 * Wrapper sobre <Input> que adiciona um botão de câmera (apenas mobile por padrão)
 * para escanear códigos de barras / QR / IMEI e preencher o valor.
 *
 * Funciona com react-hook-form: dispara um ChangeEvent sintético no input nativo,
 * preservando o setter nativo (necessário para que o React reconheça a mudança).
 */
export const ScannableInput = React.forwardRef<HTMLInputElement, ScannableInputProps>(
  ({ scannerTitle, showScannerButton = true, alwaysShowScanner = false, className, ...props }, ref) => {
    const isMobile = useIsMobile();
    const [scannerOpen, setScannerOpen] = React.useState(false);
    const innerRef = React.useRef<HTMLInputElement | null>(null);

    // Compõe ref externo + interno
    const setRefs = React.useCallback(
      (el: HTMLInputElement | null) => {
        innerRef.current = el;
        if (typeof ref === "function") ref(el);
        else if (ref) (ref as React.MutableRefObject<HTMLInputElement | null>).current = el;
      },
      [ref],
    );

    const showButton = showScannerButton && (alwaysShowScanner || isMobile);

    const handleScan = (code: string) => {
      const el = innerRef.current;
      if (!el) return;
      const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value")?.set;
      setter?.call(el, code);
      el.dispatchEvent(new Event("input", { bubbles: true }));
      // Foca pra dar feedback
      el.focus();
    };

    return (
      <>
        <div className="relative w-full">
          <Input
            ref={setRefs}
            className={cn(showButton && "pr-11", className)}
            {...props}
          />
          {showButton && (
            <Button
              type="button"
              size="icon"
              variant="ghost"
              onClick={() => setScannerOpen(true)}
              aria-label="Escanear código de barras com a câmera"
              className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8 text-muted-foreground hover:text-foreground"
              tabIndex={0}
            >
              <Camera className="h-4 w-4" />
            </Button>
          )}
        </div>
        {showButton && (
          <BarcodeScanner
            open={scannerOpen}
            onClose={() => setScannerOpen(false)}
            onScan={handleScan}
            title={scannerTitle}
          />
        )}
      </>
    );
  },
);
ScannableInput.displayName = "ScannableInput";

export default ScannableInput;
