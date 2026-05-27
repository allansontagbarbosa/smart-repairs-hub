import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CurrencyInput } from "@/components/smart-inputs/CurrencyInput";
import { Loader2 } from "lucide-react";

const reaisToBRL = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(v ?? 0));

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  saldoDisponivel: number;
}

export function NovaRetiradaDialog({ open, onOpenChange, saldoDisponivel }: Props) {
  const qc = useQueryClient();
  const [valor, setValor] = useState(0);
  const [data, setData] = useState(() => new Date().toISOString().slice(0, 10));
  const [descricao, setDescricao] = useState("");
  const [erro, setErro] = useState<string | null>(null);

  const mut = useMutation({
    mutationFn: async () => {
      const { data: res, error } = await supabase.rpc("criar_retirada" as any, {
        p_valor: valor,
        p_descricao: descricao || null,
        p_data_retirada: data,
      });
      if (error) throw error;
      const r = res as any;
      if (!r?.success) throw new Error(r?.error || "Erro ao criar retirada");
      return r;
    },
    onSuccess: (r) => {
      toast.success(`Retirada de ${reaisToBRL(r.valor)} efetivada`);
      qc.invalidateQueries({ queryKey: ["painel-socio"] });
      qc.invalidateQueries({ queryKey: ["painel-socio-contas"] });
      qc.invalidateQueries({ queryKey: ["extrato-socio"] });
      reset();
      onOpenChange(false);
    },
    onError: (e: any) => setErro(e?.message || "Erro inesperado"),
  });

  const reset = () => {
    setValor(0);
    setDescricao("");
    setData(new Date().toISOString().slice(0, 10));
    setErro(null);
  };

  const confirmar = () => {
    setErro(null);
    if (!valor || valor <= 0) return setErro("Informe um valor maior que zero");
    if (valor > saldoDisponivel) return setErro(`Saldo insuficiente. Disponível: ${reaisToBRL(saldoDisponivel)}`);
    if (!data) return setErro("Informe a data");
    mut.mutate();
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) reset(); onOpenChange(v); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Nova retirada</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="rounded-md bg-muted px-3 py-2 text-sm">
            Saldo disponível: <span className="font-semibold tabular-nums">{reaisToBRL(saldoDisponivel)}</span>
          </div>
          <div className="space-y-1.5">
            <Label>Valor</Label>
            <CurrencyInput value={valor} onValueChange={setValor} />
          </div>
          <div className="space-y-1.5">
            <Label>Data</Label>
            <Input type="date" value={data} onChange={(e) => setData(e.target.value)} />
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
            Confirmar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
