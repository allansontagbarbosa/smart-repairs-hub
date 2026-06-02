import { useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ClipboardPaste } from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onConfirm: (imeis: string[]) => void;
}

const isValidImei = (s: string) => /^\d{15}$/.test(s.trim());

export function ColarImeisDialog({ open, onOpenChange, onConfirm }: Props) {
  const [texto, setTexto] = useState("");

  const linhas = useMemo(
    () =>
      texto
        .split(/\r?\n|[,;\t]/)
        .map((l) => l.replace(/\D/g, ""))
        .filter((l) => l.length > 0),
    [texto],
  );

  const unicos = useMemo(() => Array.from(new Set(linhas)), [linhas]);
  const validos = useMemo(() => unicos.filter(isValidImei), [unicos]);
  const invalidos = useMemo(() => unicos.filter((l) => !isValidImei(l)), [unicos]);
  const duplicadosRemovidos = linhas.length - unicos.length;

  const confirmar = () => {
    if (validos.length === 0) return;
    onConfirm(validos);
    setTexto("");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ClipboardPaste className="h-4 w-4" />
            Colar lista de IMEIs
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <p className="text-xs text-muted-foreground">
            Cole um IMEI por linha (também aceita vírgula, ponto-e-vírgula ou tab).
            Os custos comuns ficam iguais; só o IMEI varia entre aparelhos.
          </p>
          <Textarea
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            placeholder={"351234567890123\n351234567890124\n351234567890125"}
            rows={10}
            className="font-mono text-sm"
          />
          {linhas.length > 0 && (
            <div className="flex flex-wrap gap-2 text-xs">
              <Badge variant="default">{validos.length} válidos</Badge>
              {invalidos.length > 0 && (
                <Badge variant="destructive">{invalidos.length} inválidos</Badge>
              )}
              {duplicadosRemovidos > 0 && (
                <Badge variant="outline">{duplicadosRemovidos} duplicados ignorados</Badge>
              )}
            </div>
          )}
          {invalidos.length > 0 && (
            <div className="p-2 rounded-md border border-destructive/30 bg-destructive/5 max-h-24 overflow-auto text-xs font-mono">
              {invalidos.slice(0, 10).map((l, i) => (
                <div key={i} className="text-destructive">{l}</div>
              ))}
              {invalidos.length > 10 && (
                <div className="text-muted-foreground">+{invalidos.length - 10}…</div>
              )}
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={confirmar} disabled={validos.length === 0}>
            Gerar {validos.length} aparelho{validos.length === 1 ? "" : "s"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
