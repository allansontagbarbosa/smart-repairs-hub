import { useState, useMemo, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Banknote, CreditCard, ArrowDownToLine, Smartphone, Loader2, Check, History, X } from "lucide-react";
import { toast } from "sonner";
import {
  useRegistrarPagamento,
  useHistoricoPagamentos,
  useEstornarPagamento,
  type FormaPagamentoConta,
} from "@/hooks/useContasAPagar";

interface ContaPgto {
  id: string;
  descricao: string;
  valor: number;
  valor_pago_centavos?: number | null;
  status: string;
  recorrente?: boolean;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  conta: ContaPgto | null;
  /** Disparado quando o pagamento quita a conta (usado p/ gerar recorrência). */
  onQuitada?: (conta: ContaPgto) => void;
}


const FORMA_INFO: Record<FormaPagamentoConta, { label: string; icon: React.ComponentType<{ className?: string }> }> = {
  pix: { label: "PIX", icon: Smartphone },
  dinheiro: { label: "Dinheiro", icon: Banknote },
  cartao: { label: "Cartão", icon: CreditCard },
  transferencia: { label: "Transferência", icon: ArrowDownToLine },
};

const fmt = (centavos: number) =>
  (centavos / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export function RegistrarPagamentoDialog({ open, onOpenChange, conta, onQuitada }: Props) {
  const registrar = useRegistrarPagamento();
  const estornar = useEstornarPagamento();
  const { data: historico = [] } = useHistoricoPagamentos(open ? conta?.id ?? null : null);

  const [valor, setValor] = useState("");
  const [forma, setForma] = useState<FormaPagamentoConta>("pix");
  const [dataPgto, setDataPgto] = useState(new Date().toISOString().slice(0, 10));
  const [observacao, setObservacao] = useState("");

  useEffect(() => {
    if (open) {
      setValor("");
      setObservacao("");
      setDataPgto(new Date().toISOString().slice(0, 10));
      setForma("pix");
    }
  }, [open, conta?.id]);

  const valorTotalCent = useMemo(() => (conta ? Math.round(conta.valor * 100) : 0), [conta]);
  const valorPagoCent = conta?.valor_pago_centavos ?? 0;
  const valorRestanteCent = valorTotalCent - valorPagoCent;
  const pctPago = valorTotalCent > 0 ? (valorPagoCent / valorTotalCent) * 100 : 0;

  const handleQuickFill = (pct: number) => {
    const cents = Math.round((valorRestanteCent * pct) / 100);
    setValor((cents / 100).toFixed(2).replace(".", ","));
  };

  const handleRegistrar = async () => {
    if (!conta) return;
    const valorNum = parseFloat(valor.replace(",", "."));
    if (isNaN(valorNum) || valorNum <= 0) {
      toast.error("Valor inválido");
      return;
    }
    const valorCent = Math.round(valorNum * 100);
    if (valorCent > valorRestanteCent) {
      toast.error(`Valor ultrapassa o pendente (${fmt(valorRestanteCent)})`);
      return;
    }
    try {
      const r = await registrar.mutateAsync({
        conta_pagar_id: conta.id,
        valor_centavos: valorCent,
        forma_pagamento: forma,
        data_pagamento: dataPgto,
        observacao: observacao || undefined,
      });
      toast.success(
        r.novo_status === "paga"
          ? `Conta QUITADA! ${fmt(valorCent)} pago.`
          : `Pagamento parcial de ${fmt(valorCent)} registrado. Restam ${fmt(r.valor_restante_centavos)}.`
      );
      setValor("");
      setObservacao("");
      if (r.novo_status === "paga") onOpenChange(false);
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleEstornar = async (pgtoId: string, valorCents: number) => {
    if (!confirm(`Estornar pagamento de ${fmt(valorCents)}? Isso vai reverter a movimentação financeira.`)) return;
    try {
      await estornar.mutateAsync(pgtoId);
      toast.success("Pagamento estornado");
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  if (!conta) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Registrar pagamento</DialogTitle>
          <DialogDescription className="truncate">{conta.descricao}</DialogDescription>
        </DialogHeader>

        {/* Resumo */}
        <div className="rounded-lg bg-muted/40 p-3 space-y-1.5">
          <div className="flex justify-between text-xs">
            <span className="text-muted-foreground">Valor total:</span>
            <span className="font-medium">{fmt(valorTotalCent)}</span>
          </div>
          <div className="flex justify-between text-xs">
            <span className="text-muted-foreground">Já pago:</span>
            <span className="font-medium text-success">{fmt(valorPagoCent)}</span>
          </div>
          <div className="flex justify-between text-xs">
            <span className="text-muted-foreground">Pendente:</span>
            <span className="font-semibold text-destructive">{fmt(valorRestanteCent)}</span>
          </div>
          <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
            <div className="h-full bg-success transition-all" style={{ width: `${pctPago}%` }} />
          </div>
          <div className="text-[10px] text-muted-foreground text-right">{pctPago.toFixed(0)}% pago</div>
        </div>

        {valorRestanteCent > 0 && (
          <div className="space-y-3">
            <div>
              <Label htmlFor="valor-pgto" className="text-xs">Valor a pagar (R$)</Label>
              <Input
                id="valor-pgto"
                inputMode="decimal"
                value={valor}
                onChange={(e) => setValor(e.target.value)}
                placeholder="0,00"
                autoFocus
              />
              <div className="flex gap-1 mt-1.5">
                <Button type="button" size="sm" variant="outline" className="text-[10px] h-6 px-2" onClick={() => handleQuickFill(25)}>25%</Button>
                <Button type="button" size="sm" variant="outline" className="text-[10px] h-6 px-2" onClick={() => handleQuickFill(50)}>50%</Button>
                <Button type="button" size="sm" variant="outline" className="text-[10px] h-6 px-2" onClick={() => handleQuickFill(75)}>75%</Button>
                <Button type="button" size="sm" variant="outline" className="text-[10px] h-6 px-2" onClick={() => handleQuickFill(100)}>Total ({fmt(valorRestanteCent)})</Button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs">Forma</Label>
                <Select value={forma} onValueChange={(v) => setForma(v as FormaPagamentoConta)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {(Object.entries(FORMA_INFO) as [FormaPagamentoConta, typeof FORMA_INFO[FormaPagamentoConta]][]).map(([k, v]) => (
                      <SelectItem key={k} value={k}>{v.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Data</Label>
                <Input type="date" value={dataPgto} onChange={(e) => setDataPgto(e.target.value)} />
              </div>
            </div>

            <div>
              <Label className="text-xs">Observação (opcional)</Label>
              <Textarea
                value={observacao}
                onChange={(e) => setObservacao(e.target.value)}
                placeholder="Ex: PIX banco BB, nota 12345..."
                rows={2}
              />
            </div>
          </div>
        )}

        {historico.length > 0 && (
          <>
            <Separator />
            <div>
              <div className="flex items-center gap-1 text-xs font-medium text-muted-foreground mb-2">
                <History className="h-3 w-3" />
                <span>Histórico de pagamentos ({historico.filter((p) => !p.estornado_em).length})</span>
              </div>
              <div className="space-y-1.5 max-h-48 overflow-y-auto">
                {historico.map((p) => {
                  const Icon = FORMA_INFO[p.forma_pagamento]?.icon ?? Check;
                  const estornado = !!p.estornado_em;
                  return (
                    <div
                      key={p.id}
                      className={`flex items-center justify-between p-2 rounded-md text-xs ${
                        estornado ? "bg-muted/20 opacity-60" : "bg-muted/40"
                      }`}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <Icon className="h-3.5 w-3.5 shrink-0" />
                        <div className="min-w-0">
                          <div className={`font-medium ${estornado ? "line-through" : ""}`}>{fmt(p.valor_centavos)}</div>
                          <div className="text-[10px] text-muted-foreground">
                            {new Date(p.data_pagamento + "T00:00:00").toLocaleDateString("pt-BR")} • {FORMA_INFO[p.forma_pagamento]?.label}
                            {estornado && " • ESTORNADO"}
                          </div>
                          {p.observacao && (
                            <div className="text-[10px] text-muted-foreground italic truncate">{p.observacao}</div>
                          )}
                        </div>
                      </div>
                      {!estornado && (
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-6 w-6"
                          onClick={() => handleEstornar(p.id, p.valor_centavos)}
                          disabled={estornar.isPending}
                          title="Estornar"
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={registrar.isPending}>
            Fechar
          </Button>
          {valorRestanteCent > 0 && (
            <Button onClick={handleRegistrar} disabled={registrar.isPending || !valor}>
              {registrar.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Check className="h-4 w-4 mr-1" />}
              Registrar
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
