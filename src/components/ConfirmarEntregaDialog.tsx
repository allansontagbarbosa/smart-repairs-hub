import { useState, useCallback, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatNumeroOS } from "@/lib/numeroOS";

export type StatusConfirmavel = "pronto" | "entregue";

export interface EntregaInfo {
  orderId: string;
  numero: number;
  numero_formatado?: string | null;
  clienteNome: string;
  status: StatusConfirmavel;
}

interface ConfirmarEntregaDialogProps {
  entrega: EntregaInfo | null;
  onConfirm: (orderId: string, status: StatusConfirmavel, dataISO: string) => void;
  onCancel: () => void;
}

// "YYYY-MM-DDTHH:mm" em horário local (formato exigido por <input type="datetime-local">)
function toLocalDatetimeInput(d: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    d.getFullYear() +
    "-" +
    pad(d.getMonth() + 1) +
    "-" +
    pad(d.getDate()) +
    "T" +
    pad(d.getHours()) +
    ":" +
    pad(d.getMinutes())
  );
}

const COPY: Record<
  StatusConfirmavel,
  { title: string; descPrefix: string; descSuffix: string; label: string; cta: string }
> = {
  pronto: {
    title: "Marcar como pronto",
    descPrefix: "Confirme abaixo a data em que a OS",
    descSuffix:
      "foi finalizada. Você pode editar caso queira lançar com data passada.",
    label: "Data de conclusão",
    cta: "Confirmar conclusão",
  },
  entregue: {
    title: "Confirmar entrega",
    descPrefix: "Confirme abaixo a data em que a OS",
    descSuffix:
      "foi entregue ao cliente. Você pode editar caso queira lançar com data passada.",
    label: "Data de entrega",
    cta: "Confirmar entrega",
  },
};

export function ConfirmarEntregaDialog({
  entrega,
  onConfirm,
  onCancel,
}: ConfirmarEntregaDialogProps) {
  const [data, setData] = useState(() => toLocalDatetimeInput(new Date()));
  const [maxData, setMaxData] = useState(() => toLocalDatetimeInput(new Date()));

  useEffect(() => {
    if (entrega) {
      const now = new Date();
      setData(toLocalDatetimeInput(now));
      setMaxData(toLocalDatetimeInput(now));
    }
  }, [entrega?.orderId, entrega?.status]);

  if (!entrega) return null;

  const copy = COPY[entrega.status];

  const handleConfirm = () => {
    if (!data) return;
    const iso = new Date(data).toISOString();
    onConfirm(entrega.orderId, entrega.status, iso);
  };

  return (
    <Dialog
      open={!!entrega}
      onOpenChange={(open) => {
        if (!open) onCancel();
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{copy.title}</DialogTitle>
          <DialogDescription>
            {copy.descPrefix} #{formatNumeroOS(entrega.numero, entrega.numero_formatado)}
            {entrega.clienteNome ? (
              <>
                {" "}de <strong>{entrega.clienteNome}</strong>
              </>
            ) : null}{" "}
            {copy.descSuffix}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2 py-2">
          <Label htmlFor="data-confirmacao">{copy.label}</Label>
          <Input
            id="data-confirmacao"
            type="datetime-local"
            value={data}
            max={maxData}
            onChange={(e) => setData(e.target.value)}
          />
          <p className="text-xs text-muted-foreground">
            Não é permitido lançar data futura.
          </p>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onCancel}>
            Cancelar
          </Button>
          <Button onClick={handleConfirm} disabled={!data}>
            {copy.cta}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function useConfirmarEntrega() {
  const [entrega, setEntrega] = useState<EntregaInfo | null>(null);

  const pedirConfirmacao = useCallback((info: EntregaInfo) => {
    setEntrega(info);
  }, []);

  const cancelar = useCallback(() => {
    setEntrega(null);
  }, []);

  return { entrega, pedirConfirmacao, cancelar };
}
