import { useState } from "react";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle,
} from "@/components/ui/sheet";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { CurrencyInput } from "@/components/smart-inputs/CurrencyInput";
import {
  ArrowDownCircle, ArrowUpCircle, ArrowLeftRight, Pencil, Archive, Plus,
} from "lucide-react";
import {
  ContaBancaria, TIPO_CONTA_LABEL,
  useContaExtrato, useContasBancarias,
  useLancarMovimentacao, useTransferir, useAjustarSaldo, useArquivarConta,
} from "@/hooks/useContasBancarias";
import { NovaContaBancariaDialog } from "./NovaContaBancariaDialog";

interface Props {
  conta: ContaBancaria | null;
  onOpenChange: (v: boolean) => void;
}

const fmt = (n: number) =>
  n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const fmtDate = (s: string) => {
  try {
    const [y, m, d] = s.split("-");
    return `${d}/${m}/${y}`;
  } catch {
    return s;
  }
};

export function ContaExtratoSheet({ conta, onOpenChange }: Props) {
  const open = !!conta;
  const { data: extrato = [], isLoading } = useContaExtrato(conta?.id ?? null);
  const { data: contas = [] } = useContasBancarias();
  const lancar = useLancarMovimentacao();
  const transferir = useTransferir();
  const ajustar = useAjustarSaldo();
  const arquivar = useArquivarConta();

  const [modal, setModal] = useState<"lancar" | "transferir" | "ajustar" | "editar" | null>(null);
  const [tipoLancar, setTipoLancar] = useState<"entrada" | "saida">("entrada");
  const [valor, setValor] = useState(0);
  const [descricao, setDescricao] = useState("");
  const [data, setData] = useState<string>(new Date().toISOString().slice(0, 10));
  const [destinoId, setDestinoId] = useState<string>("");
  const [novoSaldo, setNovoSaldo] = useState(0);
  const [motivo, setMotivo] = useState("");

  const abrirModal = (m: typeof modal, tipo?: "entrada" | "saida") => {
    setValor(0); setDescricao(""); setData(new Date().toISOString().slice(0, 10));
    setDestinoId(""); setNovoSaldo(conta?.saldo ?? 0); setMotivo("");
    if (tipo) setTipoLancar(tipo);
    setModal(m);
  };

  const submit = async () => {
    if (!conta) return;
    if (modal === "lancar") {
      await lancar.mutateAsync({ conta_id: conta.id, tipo: tipoLancar, valor, descricao, data });
    } else if (modal === "transferir") {
      if (!destinoId) return;
      await transferir.mutateAsync({ origem_id: conta.id, destino_id: destinoId, valor, descricao, data });
    } else if (modal === "ajustar") {
      await ajustar.mutateAsync({ conta_id: conta.id, novo_saldo: novoSaldo, motivo });
    }
    setModal(null);
  };

  const handleArquivar = async () => {
    if (!conta) return;
    if (!confirm(`Arquivar a conta "${conta.nome}"? Ela ficará oculta da lista.`)) return;
    await arquivar.mutateAsync(conta.id);
    onOpenChange(false);
  };

  const saldoClass = (v: number) => (v < 0 ? "text-destructive" : "text-[#00C896]");

  return (
    <>
      <Sheet open={open} onOpenChange={(v) => { if (!v) onOpenChange(false); }}>
        <SheetContent side="right" className="w-full sm:max-w-md flex flex-col p-0">
          {conta && (
            <>
              <SheetHeader className="p-6 pb-4 border-b">
                <div className="flex items-center gap-3">
                  <span
                    className="h-3 w-3 rounded-full"
                    style={{ backgroundColor: conta.cor || "#00C896" }}
                  />
                  <SheetTitle className="flex-1">{conta.nome}</SheetTitle>
                </div>
                <div className="text-xs text-muted-foreground">
                  {TIPO_CONTA_LABEL[conta.tipo]}{conta.instituicao ? ` · ${conta.instituicao}` : ""}
                </div>
                <div className={`text-3xl font-semibold ${saldoClass(conta.saldo)}`}>
                  R$ {fmt(conta.saldo)}
                </div>
                <div className="grid grid-cols-3 gap-2 pt-2">
                  <Button size="sm" variant="secondary" onClick={() => abrirModal("lancar", "entrada")}>
                    <Plus className="h-3.5 w-3.5" /> Lançar
                  </Button>
                  <Button size="sm" variant="secondary" onClick={() => abrirModal("transferir")}>
                    <ArrowLeftRight className="h-3.5 w-3.5" /> Transferir
                  </Button>
                  <Button size="sm" variant="secondary" onClick={() => abrirModal("ajustar")}>
                    <Pencil className="h-3.5 w-3.5" /> Ajustar
                  </Button>
                </div>
                <div className="flex gap-2 pt-1">
                  <Button size="sm" variant="ghost" className="flex-1" onClick={() => setModal("editar")}>
                    <Pencil className="h-3.5 w-3.5" /> Editar conta
                  </Button>
                  <Button size="sm" variant="ghost" className="flex-1 text-destructive hover:text-destructive" onClick={handleArquivar}>
                    <Archive className="h-3.5 w-3.5" /> Arquivar
                  </Button>
                </div>
              </SheetHeader>
              <div className="flex-1 overflow-y-auto p-6 pt-4">
                <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">
                  Extrato
                </div>
                {isLoading && <div className="text-sm text-muted-foreground">Carregando...</div>}
                {!isLoading && extrato.length === 0 && (
                  <div className="text-sm text-muted-foreground py-8 text-center">
                    Nenhuma movimentação ainda.
                  </div>
                )}
                <ul className="space-y-2">
                  {extrato.map((m) => {
                    const isPos = m.valor > 0;
                    const isAjuste = m.tipo === "ajuste";
                    const Icon = m.tipo === "transferencia" ? ArrowLeftRight
                      : isPos ? ArrowDownCircle : ArrowUpCircle;
                    const color = isAjuste
                      ? "text-muted-foreground"
                      : isPos ? "text-[#00C896]" : "text-destructive";
                    return (
                      <li key={m.id} className="flex items-start gap-3 py-2 border-b border-border/50 last:border-0">
                        <Icon className={`h-4 w-4 mt-0.5 ${color}`} />
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium truncate">
                            {m.descricao || (
                              m.tipo === "transferencia" ? "Transferência"
                                : m.tipo === "ajuste" ? "Ajuste de saldo"
                                : isPos ? "Entrada" : "Saída"
                            )}
                          </div>
                          <div className="text-xs text-muted-foreground">{fmtDate(m.data)}</div>
                        </div>
                        <div className="text-right">
                          <div className={`text-sm font-semibold ${color}`}>
                            {isPos ? "+" : "−"} R$ {fmt(Math.abs(m.valor))}
                          </div>
                          <div className="text-[10px] text-muted-foreground">
                            saldo R$ {fmt(m.saldo_apos)}
                          </div>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

      {/* Lançar */}
      <Dialog open={modal === "lancar"} onOpenChange={(v) => !v && setModal(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Lançar movimentação</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-2">
              <Button
                variant={tipoLancar === "entrada" ? "default" : "outline"}
                onClick={() => setTipoLancar("entrada")}
              >
                <ArrowDownCircle className="h-4 w-4" /> Entrada
              </Button>
              <Button
                variant={tipoLancar === "saida" ? "default" : "outline"}
                onClick={() => setTipoLancar("saida")}
              >
                <ArrowUpCircle className="h-4 w-4" /> Saída
              </Button>
            </div>
            <div className="space-y-2">
              <Label>Valor</Label>
              <CurrencyInput value={valor} onValueChange={setValor} />
            </div>
            <div className="space-y-2">
              <Label>Descrição</Label>
              <Input value={descricao} onChange={(e) => setDescricao(e.target.value)} placeholder="Opcional" />
            </div>
            <div className="space-y-2">
              <Label>Data</Label>
              <Input type="date" value={data} onChange={(e) => setData(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setModal(null)}>Cancelar</Button>
            <Button onClick={submit} disabled={valor <= 0 || lancar.isPending}>Lançar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Transferir */}
      <Dialog open={modal === "transferir"} onOpenChange={(v) => !v && setModal(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Transferir entre contas</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>De</Label>
              <Input value={conta?.nome ?? ""} disabled />
            </div>
            <div className="space-y-2">
              <Label>Para</Label>
              <Select value={destinoId} onValueChange={setDestinoId}>
                <SelectTrigger><SelectValue placeholder="Conta destino" /></SelectTrigger>
                <SelectContent>
                  {contas.filter((c) => c.id !== conta?.id).map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Valor</Label>
              <CurrencyInput value={valor} onValueChange={setValor} />
            </div>
            <div className="space-y-2">
              <Label>Descrição</Label>
              <Input value={descricao} onChange={(e) => setDescricao(e.target.value)} placeholder="Opcional" />
            </div>
            <div className="space-y-2">
              <Label>Data</Label>
              <Input type="date" value={data} onChange={(e) => setData(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setModal(null)}>Cancelar</Button>
            <Button onClick={submit} disabled={!destinoId || valor <= 0 || transferir.isPending}>Transferir</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Ajustar */}
      <Dialog open={modal === "ajustar"} onOpenChange={(v) => !v && setModal(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Ajustar saldo</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="text-sm text-muted-foreground">
              Saldo atual: <span className="font-semibold text-foreground">R$ {fmt(conta?.saldo ?? 0)}</span>
            </div>
            <div className="space-y-2">
              <Label>Novo saldo</Label>
              <CurrencyInput value={novoSaldo} onValueChange={setNovoSaldo} />
            </div>
            <div className="space-y-2">
              <Label>Motivo</Label>
              <Input value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Ex: Conferência de extrato bancário" />
            </div>
            <p className="text-xs text-muted-foreground">
              Será criada uma movimentação do tipo "Ajuste" com o delta correspondente.
            </p>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setModal(null)}>Cancelar</Button>
            <Button onClick={submit} disabled={ajustar.isPending}>Ajustar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Editar conta */}
      <NovaContaBancariaDialog
        open={modal === "editar"}
        onOpenChange={(v) => !v && setModal(null)}
        conta={conta}
      />
    </>
  );
}
