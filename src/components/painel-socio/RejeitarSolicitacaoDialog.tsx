import { useState } from "react";
import { toast } from "sonner";
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
import { useVotarSolicitacao } from "@/hooks/useSocioSolicitacoes";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  solicitacaoId: string | null;
}

export function RejeitarSolicitacaoDialog({ open, onOpenChange, solicitacaoId }: Props) {
  const [motivo, setMotivo] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const mut = useVotarSolicitacao();

  const confirmar = async () => {
    setErro(null);
    if (motivo.trim().length < 3) return setErro("Motivo precisa ter ao menos 3 caracteres");
    if (!solicitacaoId) return;
    try {
      await mut.mutateAsync({ solicitacao_id: solicitacaoId, voto: "rejeitado", motivo: motivo.trim() });
      toast.success("Solicitação rejeitada");
      setMotivo("");
      onOpenChange(false);
    } catch (e: any) {
      setErro(e?.message || "Erro ao rejeitar");
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) { setMotivo(""); setErro(null); } onOpenChange(v); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Rejeitar solicitação</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>Motivo da rejeição</Label>
            <Textarea
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              rows={3}
              maxLength={300}
              placeholder="Explique brevemente por que está rejeitando"
            />
          </div>
          {erro && <div className="text-sm text-destructive">{erro}</div>}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={mut.isPending}>
            Cancelar
          </Button>
          <Button variant="destructive" onClick={confirmar} disabled={mut.isPending}>
            {mut.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Rejeitar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
