import { useState, useCallback } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface EntregaInfo {
  orderId: string;
  numero: number;
  clienteNome: string;
}

interface ConfirmarEntregaDialogProps {
  entrega: EntregaInfo | null;
  onConfirm: (orderId: string) => void;
  onCancel: () => void;
}

export function ConfirmarEntregaDialog({ entrega, onConfirm, onCancel }: ConfirmarEntregaDialogProps) {
  return (
    <AlertDialog open={!!entrega} onOpenChange={(open) => { if (!open) onCancel(); }}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Confirmar entrega</AlertDialogTitle>
          <AlertDialogDescription>
            Deseja marcar a OS #{String(entrega?.numero ?? 0).padStart(3, "0")} de{" "}
            <strong>{entrega?.clienteNome ?? "—"}</strong> como entregue? Esta ação não pode ser desfeita.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction onClick={() => entrega && onConfirm(entrega.orderId)}>
            Confirmar entrega
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
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
