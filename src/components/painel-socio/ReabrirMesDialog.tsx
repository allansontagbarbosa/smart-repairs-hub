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
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";

const fmtMes = (ym: string) => {
  if (!ym) return "—";
  const [y, m] = ym.split("-");
  return `${m}/${y}`;
};

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  mes: string;
}

export function ReabrirMesDialog({ open, onOpenChange, mes }: Props) {
  const qc = useQueryClient();
  const [motivo, setMotivo] = useState("");
  const [erro, setErro] = useState<string | null>(null);

  const mut = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc("reabrir_mes" as any, {
        p_mes: mes,
        p_motivo: motivo || null,
      });
      if (error) throw error;
      const r = data as any;
      if (!r?.success) throw new Error(r?.error || "Erro ao reabrir mês");
      return r;
    },
    onSuccess: () => {
      toast.success(`Mês ${fmtMes(mes)} reaberto`);
      qc.invalidateQueries({ queryKey: ["painel-socio"] });
      qc.invalidateQueries({ queryKey: ["painel-socio-contas"] });
      qc.invalidateQueries({ queryKey: ["extrato-socio"] });
      setMotivo("");
      onOpenChange(false);
    },
    onError: (e: any) => setErro(e?.message || "Erro inesperado"),
  });

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) { setErro(null); setMotivo(""); } onOpenChange(v); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Reabrir mês {fmtMes(mes)}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 text-sm">
          <p className="text-muted-foreground">
            Os créditos desse fechamento serão estornados do extrato dos sócios.
          </p>
          <div className="space-y-1.5">
            <Label>Motivo (opcional)</Label>
            <Textarea
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              maxLength={300}
              rows={3}
              placeholder="Ex: ajuste de despesa esquecida"
            />
          </div>
          {erro && <div className="text-sm text-destructive">{erro}</div>}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={mut.isPending}>
            Cancelar
          </Button>
          <Button variant="destructive" onClick={() => { setErro(null); mut.mutate(); }} disabled={mut.isPending}>
            {mut.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Reabrir
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
