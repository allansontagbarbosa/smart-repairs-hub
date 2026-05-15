import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Pencil, Trash2, Loader2 } from "lucide-react";
import { useEhAdmin } from "@/hooks/useEhAdmin";
import { useEditarPagamento, useExcluirPagamento } from "@/hooks/useGerenciarPagamento";
import { formatCurrency } from "@/lib/format";

export interface PagamentoAcoes {
  id: string;
  cliente_id: string;
  valor: number;
  data_pagamento: string;
  forma_pagamento: string | null;
  observacoes: string | null;
}

const FORMAS = [
  { value: "pix", label: "PIX" },
  { value: "dinheiro", label: "Dinheiro" },
  { value: "cartao_debito", label: "Cartão Débito" },
  { value: "cartao_credito", label: "Cartão Crédito" },
  { value: "transferencia", label: "Transferência" },
  { value: "boleto", label: "Boleto" },
  { value: "outro", label: "Outro" },
];

export function AcoesPagamento({ pagamento }: { pagamento: PagamentoAcoes }) {
  const { data: ehAdmin, isLoading } = useEhAdmin();
  const [modalEditar, setModalEditar] = useState(false);
  const [confirmExcluir, setConfirmExcluir] = useState(false);

  if (isLoading || !ehAdmin) return null;

  return (
    <>
      <div className="inline-flex gap-1">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setModalEditar(true)}
          aria-label="Editar pagamento"
          className="h-7 w-7"
        >
          <Pencil className="h-3.5 w-3.5" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setConfirmExcluir(true)}
          aria-label="Excluir pagamento"
          className="h-7 w-7 text-destructive hover:text-destructive"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>

      {modalEditar && (
        <ModalEditar pagamento={pagamento} open={modalEditar} onClose={() => setModalEditar(false)} />
      )}
      {confirmExcluir && (
        <ConfirmacaoExcluir pagamento={pagamento} open={confirmExcluir} onClose={() => setConfirmExcluir(false)} />
      )}
    </>
  );
}

function ModalEditar({
  pagamento, open, onClose,
}: { pagamento: PagamentoAcoes; open: boolean; onClose: () => void }) {
  const editar = useEditarPagamento();
  const [valor, setValor] = useState(String(pagamento.valor));
  const [data, setData] = useState(pagamento.data_pagamento?.slice(0, 10) ?? "");
  const [forma, setForma] = useState(pagamento.forma_pagamento ?? "pix");
  const [obs, setObs] = useState(pagamento.observacoes ?? "");
  const [motivo, setMotivo] = useState("");

  function handleSalvar() {
    const valorNum = parseFloat(valor.replace(",", "."));
    if (!Number.isFinite(valorNum) || valorNum <= 0) return;
    editar.mutate(
      {
        pagamentoId: pagamento.id,
        clienteId: pagamento.cliente_id,
        dados: {
          valor: valorNum,
          data_pagamento: data,
          forma_pagamento: forma || undefined,
          observacoes: obs.trim() || null,
        },
        motivo: motivo.trim() || undefined,
      },
      { onSuccess: onClose }
    );
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !editar.isPending && !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Editar pagamento</DialogTitle>
          <DialogDescription>
            Alterações ficam registradas no log de auditoria.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Valor (R$)</label>
            <Input
              type="number" step="0.01" min="0.01"
              value={valor}
              onChange={(e) => setValor(e.target.value)}
            />
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Data</label>
            <Input type="date" value={data} onChange={(e) => setData(e.target.value)} />
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Forma de pagamento</label>
            <select
              value={forma}
              onChange={(e) => setForma(e.target.value)}
              className="w-full h-10 px-2 text-sm rounded-md border border-input bg-background focus:outline-none focus:ring-2 focus:ring-ring"
            >
              {FORMAS.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Observações</label>
            <textarea
              value={obs}
              onChange={(e) => setObs(e.target.value)}
              rows={2}
              className="w-full text-sm rounded-md border border-input bg-background p-2 focus:outline-none focus:ring-2 focus:ring-ring resize-none"
            />
          </div>
          <div className="border-t border-border pt-3">
            <label className="text-xs text-muted-foreground mb-1 block">
              Motivo da alteração (vai pro log)
            </label>
            <Input
              type="text"
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              placeholder="Ex: valor digitado errado"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={editar.isPending}>
            Cancelar
          </Button>
          <Button onClick={handleSalvar} disabled={editar.isPending}>
            {editar.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            {editar.isPending ? "Salvando…" : "Salvar alterações"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ConfirmacaoExcluir({
  pagamento, open, onClose,
}: { pagamento: PagamentoAcoes; open: boolean; onClose: () => void }) {
  const excluir = useExcluirPagamento();
  const [motivo, setMotivo] = useState("");

  function handleConfirmar() {
    excluir.mutate(
      {
        pagamentoId: pagamento.id,
        clienteId: pagamento.cliente_id,
        motivo: motivo.trim() || undefined,
      },
      { onSuccess: onClose }
    );
  }

  return (
    <AlertDialog open={open} onOpenChange={(o) => !excluir.isPending && !o && onClose()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Excluir este pagamento?</AlertDialogTitle>
          <AlertDialogDescription>
            Valor: <strong>{formatCurrency(pagamento.valor)}</strong>
            {pagamento.data_pagamento && ` · ${new Date(pagamento.data_pagamento + "T00:00:00").toLocaleDateString("pt-BR")}`}
            <br /><br />
            O saldo do cliente será recalculado automaticamente. A exclusão fica
            registrada no log de auditoria (não some do banco — pode ser revertida).
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="py-2">
          <label className="text-xs text-muted-foreground mb-1 block">
            Motivo (opcional, vai pro log)
          </label>
          <Input
            type="text"
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            placeholder="Ex: lançamento duplicado"
          />
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={excluir.isPending}>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleConfirmar}
            disabled={excluir.isPending}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {excluir.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            {excluir.isPending ? "Excluindo…" : "Sim, excluir"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
