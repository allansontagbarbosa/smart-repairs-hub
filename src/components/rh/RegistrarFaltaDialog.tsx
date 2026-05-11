import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, CalendarOff } from "lucide-react";
import { toast } from "sonner";
import { useRegistrarFalta } from "@/hooks/useRH";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  funcionarioId: string;
  funcionarioNome: string;
}

export function RegistrarFaltaDialog({ open, onOpenChange, funcionarioId, funcionarioNome }: Props) {
  const registrar = useRegistrarFalta();
  const [data, setData] = useState(new Date().toISOString().slice(0, 10));
  const [atestado, setAtestado] = useState(false);
  const [justificada, setJustificada] = useState(false);
  const [abonada, setAbonada] = useState(false);
  const [obs, setObs] = useState("");

  const handleRegistrar = async () => {
    try {
      const r = await registrar.mutateAsync({
        funcionario_id: funcionarioId,
        data,
        falta_justificada: justificada,
        atestado_medico: atestado,
        abonada,
        justificativa: obs,
      });
      if (r.desconto_aplicado) {
        toast.success(`Falta registrada. Desconto: R$ ${(r.valor_desconto_centavos / 100).toFixed(2)}`);
      } else {
        toast.success("Falta registrada (sem desconto)");
      }
      onOpenChange(false);
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CalendarOff className="h-4 w-4" />
            Registrar falta — {funcionarioNome}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label>Data da falta</Label>
            <Input type="date" value={data} onChange={(e) => setData(e.target.value)} />
          </div>
          <div className="space-y-2">
            <label className="flex items-center gap-2 text-sm">
              <Checkbox checked={atestado} onCheckedChange={(c) => setAtestado(c === true)} />
              Atestado médico (não desconta)
            </label>
            <label className="flex items-center gap-2 text-sm">
              <Checkbox checked={justificada} onCheckedChange={(c) => setJustificada(c === true)} />
              Falta justificada (não-médica)
            </label>
            <label className="flex items-center gap-2 text-sm">
              <Checkbox checked={abonada} onCheckedChange={(c) => setAbonada(c === true)} />
              Abonar (não descontar mesmo sem atestado)
            </label>
          </div>
          <div className="space-y-2">
            <Label>Justificativa / observações</Label>
            <Textarea value={obs} onChange={(e) => setObs(e.target.value)} rows={3} />
          </div>
          <p className="text-xs text-muted-foreground">
            Para funcionário CLT, falta sem atestado e sem abono desconta automaticamente 1/30 do salário.
          </p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={registrar.isPending}>Cancelar</Button>
          <Button onClick={handleRegistrar} disabled={registrar.isPending} className="bg-amber-600 hover:bg-amber-700">
            {registrar.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
            Registrar falta
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
