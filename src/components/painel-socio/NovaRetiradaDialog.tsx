import { useState, useMemo, useEffect } from "react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CurrencyInput } from "@/components/smart-inputs/CurrencyInput";
import { Loader2, ShieldAlert } from "lucide-react";
import { useSolicitarRetirada } from "@/hooks/useRetiradasFluxo";
import { useContasSocio } from "@/hooks/useContasSocio";

const brl = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(v ?? 0));

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  saldoDisponivel: number;
}

export function NovaRetiradaDialog({ open, onOpenChange, saldoDisponivel }: Props) {
  const { data: contas } = useContasSocio();
  const meuSocioId = contas?.socio_id_logado || "";
  const socios = useMemo(() => contas?.socios ?? [], [contas]);

  const [socioId, setSocioId] = useState<string>("");
  const [valor, setValor] = useState(0);
  const [descricao, setDescricao] = useState("");
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    if (!socioId) {
      setSocioId(meuSocioId || socios[0]?.id || "");
    }
  }, [meuSocioId, socios, socioId]);

  const socioSelecionado = socios.find((s) => s.id === socioId);
  // Saldo disponível do destinatário (sempre que tivermos a lista)
  const saldoDestinatario = socioSelecionado?.saldo_a_retirar ?? saldoDisponivel;

  const mut = useSolicitarRetirada();

  const reset = () => {
    setValor(0);
    setDescricao("");
    setSocioId(meuSocioId || socios[0]?.id || "");
    setErro(null);
  };

  const confirmar = () => {
    setErro(null);
    if (!socioId) return setErro("Selecione o sócio destinatário");
    if (!valor || valor <= 0) return setErro("Informe um valor maior que zero");
    if (valor > saldoDestinatario)
      return setErro(`Saldo insuficiente. Disponível: ${brl(saldoDestinatario)}`);
    mut.mutate(
      { socio_id: socioId, valor, descricao: descricao || null },
      {
        onSuccess: () => {
          toast.success("Retirada solicitada. Aguardando aprovação de outro sócio.");
          reset();
          onOpenChange(false);
        },
        onError: (e: any) => setErro(e?.message || "Erro inesperado"),
      },
    );
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) reset();
        onOpenChange(v);
      }}
    >
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Nova retirada</DialogTitle>
          <DialogDescription className="flex items-start gap-2 text-xs">
            <ShieldAlert className="h-4 w-4 mt-0.5 text-amber-500 shrink-0" />
            <span>
              A retirada será criada como <b>pendente</b> e só será efetivada após a aprovação de outro
              sócio (você não pode aprovar a própria solicitação).
            </span>
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Sócio destinatário</Label>
            <Select value={socioId} onValueChange={setSocioId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione…" />
              </SelectTrigger>
              <SelectContent>
                {socios.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.nome} {s.eh_voce ? "(você)" : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="rounded-md bg-muted px-3 py-2 text-sm">
            Saldo disponível do destinatário:{" "}
            <span className="font-semibold tabular-nums">{brl(saldoDestinatario)}</span>
          </div>
          <div className="space-y-1.5">
            <Label>Valor</Label>
            <CurrencyInput value={valor} onValueChange={setValor} />
          </div>
          <div className="space-y-1.5">
            <Label>Descrição (opcional)</Label>
            <Input value={descricao} onChange={(e) => setDescricao(e.target.value)} maxLength={200} />
          </div>
          <div className="text-xs text-muted-foreground">Forma de pagamento: PIX</div>
          {erro && <div className="text-sm text-destructive">{erro}</div>}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={mut.isPending}>
            Cancelar
          </Button>
          <Button onClick={confirmar} disabled={mut.isPending}>
            {mut.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Solicitar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
