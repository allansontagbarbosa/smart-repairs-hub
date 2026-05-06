import { useEffect, useState, type FormEvent } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { CurrencyInput } from "@/components/smart-inputs/CurrencyInput";
import { useCriarRecebimentoAvulso } from "@/hooks/useCriarRecebimentoAvulso";
import { dateOnlyLocal } from "@/lib/dateUtils";

const FORMAS_PAGAMENTO = [
  { value: "pix", label: "PIX" },
  { value: "dinheiro", label: "Dinheiro" },
  { value: "cartao_debito", label: "Cartão Débito" },
  { value: "cartao_credito", label: "Cartão Crédito" },
  { value: "transferencia", label: "Transferência" },
  { value: "boleto", label: "Boleto" },
  { value: "outro", label: "Outro" },
];

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function NovoRecebimentoDialog({ open, onOpenChange }: Props) {
  const [descricao, setDescricao] = useState("");
  const [valor, setValor] = useState(0);
  const [forma, setForma] = useState("pix");
  const [data, setData] = useState(dateOnlyLocal());
  const [observacoes, setObservacoes] = useState("");

  const criar = useCriarRecebimentoAvulso();

  useEffect(() => {
    if (open) {
      setDescricao("");
      setValor(0);
      setForma("pix");
      setData(dateOnlyLocal());
      setObservacoes("");
    }
  }, [open]);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (valor <= 0 || !descricao.trim()) return;

    criar.mutate(
      {
        descricao: observacoes
          ? `${descricao.trim()} — ${observacoes.trim()}`
          : descricao.trim(),
        valor,
        forma_pagamento: forma,
        data,
        observacoes: observacoes || undefined,
      },
      {
        onSuccess: () => onOpenChange(false),
      },
    );
  };

  const podeSalvar = valor > 0 && descricao.trim().length > 0 && !criar.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Novo Recebimento Avulso</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label>Descrição *</Label>
            <Input
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              placeholder="Ex: Venda de carcaça, troco de fornecedor, etc."
              className="mt-1.5"
              autoFocus
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Valor *</Label>
              <CurrencyInput value={valor} onValueChange={setValor} className="mt-1.5" />
            </div>
            <div>
              <Label>Data *</Label>
              <Input
                type="date"
                value={data}
                onChange={(e) => setData(e.target.value)}
                className="mt-1.5"
              />
            </div>
          </div>

          <div>
            <Label>Forma de pagamento *</Label>
            <Select value={forma} onValueChange={setForma}>
              <SelectTrigger className="mt-1.5">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {FORMAS_PAGAMENTO.map((f) => (
                  <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Observações</Label>
            <Textarea
              value={observacoes}
              onChange={(e) => setObservacoes(e.target.value)}
              rows={2}
              className="mt-1.5 resize-none"
              placeholder="Detalhes opcionais"
            />
          </div>

          <div className="rounded-md bg-muted/50 px-3 py-2 text-[11px] text-muted-foreground">
            Para registrar pagamento de cliente com saldo devedor, use a aba <strong>Saldo de Clientes</strong>. Esta tela é para entradas avulsas sem vínculo com OS.
          </div>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={!podeSalvar}>
              {criar.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : null}
              Salvar
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
