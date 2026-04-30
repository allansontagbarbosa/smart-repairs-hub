import { useEffect, useState } from "react";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { AlertTriangle, AlertCircle, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatNumeroOS } from "@/lib/numeroOS";

export type BulkAffectedItem = {
  id: string;
  numero: string | number;
  numero_formatado?: string | null;
  cliente: string;
  aparelho?: string;
};

interface Props {
  open: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void> | void;
  title: string;
  description: string;
  affected: BulkAffectedItem[];
  warningMessage?: string;
  errorMessage?: string;
  confirmLabel: string;
  variant?: "default" | "destructive";
}

const PREVIEW = 5;

export function BulkActionConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  description,
  affected,
  warningMessage,
  errorMessage,
  confirmLabel,
  variant = "default",
}: Props) {
  const [reviewed, setReviewed] = useState(false);
  const [loading, setLoading] = useState(false);

  // Reset on open/close
  useEffect(() => {
    if (open) {
      setReviewed(false);
      setLoading(false);
    }
  }, [open]);

  const preview = affected.slice(0, PREVIEW);
  const remaining = Math.max(0, affected.length - PREVIEW);

  const handleConfirm = async () => {
    setLoading(true);
    try {
      await onConfirm();
    } finally {
      setLoading(false);
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={(v) => !v && !loading && onClose()}>
      <AlertDialogContent className="max-w-lg">
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>

        <div className="space-y-3">
          <div className="rounded-md border bg-muted/30 max-h-48 overflow-y-auto">
            <ul className="divide-y divide-border/60 text-sm">
              {preview.map((it) => (
                <li key={it.id} className="px-3 py-2 flex items-center gap-2">
                  <span className="font-mono text-xs text-primary shrink-0">
                    #{formatNumeroOS(it.numero, it.numero_formatado)}
                  </span>
                  <span className="truncate">
                    {it.cliente}
                    {it.aparelho ? ` · ${it.aparelho}` : ""}
                  </span>
                </li>
              ))}
            </ul>
            {remaining > 0 && (
              <p className="px-3 py-2 text-xs text-muted-foreground border-t border-border/60">
                + {remaining} outra{remaining > 1 ? "s" : ""} OS
              </p>
            )}
          </div>

          {warningMessage && (
            <div className="flex items-start gap-2 rounded-md border border-warning/30 bg-warning/10 px-3 py-2 text-xs text-warning-foreground">
              <AlertTriangle className="h-4 w-4 shrink-0 text-warning mt-0.5" />
              <span>{warningMessage}</span>
            </div>
          )}

          {errorMessage && (
            <div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          )}

          <label className="flex items-center gap-2 cursor-pointer select-none">
            <Checkbox
              checked={reviewed}
              onCheckedChange={(v) => setReviewed(!!v)}
              disabled={loading}
            />
            <span className="text-sm">Confirmo que revisei a lista acima</span>
          </label>
        </div>

        <AlertDialogFooter>
          <Button variant="outline" onClick={onClose} disabled={loading}>
            Cancelar
          </Button>
          <Button
            variant={variant === "destructive" ? "destructive" : "default"}
            onClick={handleConfirm}
            disabled={!reviewed || loading || affected.length === 0}
            className={cn(loading && "gap-2")}
          >
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            {confirmLabel}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
