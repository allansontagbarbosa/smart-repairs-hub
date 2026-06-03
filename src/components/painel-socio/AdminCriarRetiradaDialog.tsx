import { useState, useEffect } from "react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CurrencyInput } from "@/components/smart-inputs/CurrencyInput";
import { Loader2, ShieldAlert } from "lucide-react";
import { useSolicitarRetirada } from "@/hooks/useRetiradasFluxo";

const brl = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(v ?? 0));

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  socio: { socio_id: string; nome: string; saldo: number } | null;
}

/** Dialog usado pelo ADM para criar retirada para um sócio específico. */
export function AdminCriarRetiradaDialog({ open, onOpenChange, socio }: Props) {
  const [valor, setValor] = useState(0);
  const [descricao, setDescricao] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const mut = useSolicitarRetirada();

  useEffect(() => {
    if (open) {
      setValor(0);
      setDescricao("");
      setErro(null);
    }
  }, [open]);

  const confirmar = () => {
    setErro(null);
    if (!socio) return;
    if (!valor || valor <= 0) return setErro("Informe um valor maior que zero");
    if (valor > socio.saldo)
      return setErro(`Saldo insuficiente. Disponível: ${brl(socio.saldo)}`);
    mut.mutate(
      { socio_id: socio.socio_id, valor, descricao: descricao || null },
      {
        onSuccess: () => {
          toast.success(`Retirada criada. Aguardando aprovação de ${socio.nome}.`);
          onOpenChange(false);
        },
        onError: (e: any) => setErro(e?.message || "Erro inesperado"),
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Criar retirada para {socio?.nome}</DialogTitle>
          <DialogDescription className="flex items-start gap-2 text-xs">
            <ShieldAlert className="h-4 w-4 mt-0.5 text-amber-500 shrink-0" />
            <span>
              A retirada nasce <b>pendente</b>. Apenas o sócio destinatário ({socio?.nome}) pode
              aprová-la — administradores não aprovam.
            </span>
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="rounded-md bg-muted px-3 py-2 text-sm">
            Saldo disponível do sócio:{" "}
            <span className="font-semibold tabular-nums">{brl(socio?.saldo ?? 0)}</span>
          </div>
          <div className="space-y-1.5">
            <Label>Valor</Label>
            <CurrencyInput value={valor} onValueChange={setValor} />
          </div>
          <div className="space-y-1.5">
            <Label>Descrição (opcional)</Label>
            <Input
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              maxLength={200}
            />
          </div>
          <div className="text-xs text-muted-foreground">Forma de pagamento: PIX</div>
          {erro && <div className="text-sm text-destructive">{erro}</div>}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={mut.isPending}>
            Cancelar
          </Button>
          <Button onClick={confirmar} disabled={mut.isPending || !socio}>
            {mut.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Criar retirada
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
