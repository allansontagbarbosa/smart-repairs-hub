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
import { Loader2, AlertTriangle } from "lucide-react";

const brl = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(v ?? 0));

const fmtMes = (ym: string) => {
  if (!ym) return "—";
  const [y, m] = ym.split("-");
  return `${m}/${y}`;
};

interface SocioPreview {
  id: string;
  nome: string;
  percentual: number;
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  mes: string;
  faturamento: number;
  custoPecas: number;
  comissoes: number;
  despesas: number;
  lucroLiquido: number;
  reservaPct: number;
  socios: SocioPreview[];
}

export function FecharMesDialog({
  open, onOpenChange, mes,
  faturamento, custoPecas, comissoes, despesas,
  lucroLiquido, reservaPct, socios,
}: Props) {
  const qc = useQueryClient();
  const reservaVal = Math.max(0, lucroLiquido) * (reservaPct / 100);
  const distribuivel = Math.max(0, lucroLiquido) - reservaVal;

  const mut = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc("fechar_mes" as any, { p_mes: mes });
      if (error) throw error;
      const r = data as any;
      if (!r?.success) throw new Error(r?.error || "Erro ao fechar mês");
      return r;
    },
    onSuccess: (r) => {
      toast.success(`Mês ${fmtMes(mes)} fechado · ${brl(r.distribuivel)} distribuídos`);
      qc.invalidateQueries({ queryKey: ["painel-socio"] });
      qc.invalidateQueries({ queryKey: ["painel-socio-contas"] });
      qc.invalidateQueries({ queryKey: ["extrato-socio"] });
      onOpenChange(false);
    },
    onError: (e: any) => toast.error(e?.message || "Erro ao fechar mês"),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Fechar mês {fmtMes(mes)}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 text-sm">
          <p className="text-muted-foreground">Antes de fechar, confira os valores:</p>
          <div className="space-y-1.5 font-mono text-sm">
            <Row label="Faturamento" value={brl(faturamento)} />
            <Row label="− Custo de peças" value={brl(custoPecas)} />
            <Row label="− Comissões" value={brl(comissoes)} />
            <Row label="− Despesas" value={brl(despesas)} />
            <div className="border-t my-1" />
            <Row label="Lucro Líquido" value={brl(lucroLiquido)} bold />
            <Row label={`− Reserva (${reservaPct}%)`} value={brl(reservaVal)} />
            <div className="border-t my-1" />
            <Row label="A distribuir" value={brl(distribuivel)} bold />
          </div>

          <div>
            <div className="text-xs text-muted-foreground uppercase tracking-wider mb-2">
              Será creditado em:
            </div>
            <div className="space-y-1 font-mono text-sm">
              {socios.map((s) => (
                <Row
                  key={s.id}
                  label={`• ${s.nome} (${Number(s.percentual).toFixed(2)}%)`}
                  value={brl(distribuivel * s.percentual / 100)}
                />
              ))}
            </div>
          </div>

          <div className="flex gap-2 items-start rounded-md bg-muted px-3 py-2 text-xs text-muted-foreground">
            <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
            <span>Esta ação pode ser revertida em "Reabrir mês" caso não haja retiradas posteriores.</span>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={mut.isPending}>
            Cancelar
          </Button>
          <Button onClick={() => mut.mutate()} disabled={mut.isPending}>
            {mut.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Confirmar fechamento
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className={`flex justify-between gap-3 ${bold ? "font-semibold" : ""}`}>
      <span>{label}</span>
      <span className="tabular-nums">{value}</span>
    </div>
  );
}
