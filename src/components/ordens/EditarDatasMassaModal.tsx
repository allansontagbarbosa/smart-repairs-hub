import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  osIds: string[];
  onSucesso: () => void;
}

function nowLocal() {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function EditarDatasMassaModal({ open, onOpenChange, osIds, onSucesso }: Props) {
  const [aplicaConcl, setAplicaConcl] = useState(false);
  const [aplicaEntr, setAplicaEntr] = useState(false);
  const [concl, setConcl] = useState(nowLocal());
  const [entr, setEntr] = useState(nowLocal());
  const [salvando, setSalvando] = useState(false);

  const aplicar = async () => {
    if (!aplicaConcl && !aplicaEntr) {
      toast.error("Selecione ao menos um campo para aplicar");
      return;
    }
    setSalvando(true);
    const { data, error } = await supabase.rpc("editar_datas_os_em_massa" as any, {
      p_os_ids: osIds,
      p_data_conclusao: aplicaConcl ? new Date(concl).toISOString() : null,
      p_data_entrega: aplicaEntr ? new Date(entr).toISOString() : null,
      p_aplicar_conclusao: aplicaConcl,
      p_aplicar_entrega: aplicaEntr,
    });
    setSalvando(false);
    const res = data as { success?: boolean; error?: string; atualizadas?: number; ignoradas?: number } | null;
    if (error || !res?.success) {
      toast.error(res?.error ?? error?.message ?? "Erro");
      return;
    }
    toast.success(
      `${res.atualizadas} OS atualizadas` +
      ((res as any).status_mudou > 0 ? ` (${(res as any).status_mudou} mudaram de status)` : "") +
      ((res.ignoradas ?? 0) > 0 ? `. ${res.ignoradas} ignoradas (canceladas ou data inválida).` : ""),
    );
    onOpenChange(false);
    onSucesso();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Editar datas em {osIds.length} OS</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Checkbox
                id="aplica-concl"
                checked={aplicaConcl}
                onCheckedChange={(c) => setAplicaConcl(!!c)}
              />
              <Label htmlFor="aplica-concl" className="cursor-pointer">
                Aplicar data de conclusão
              </Label>
            </div>
            <Input
              type="datetime-local"
              value={concl}
              disabled={!aplicaConcl}
              onChange={(e) => setConcl(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Checkbox
                id="aplica-entr"
                checked={aplicaEntr}
                onCheckedChange={(c) => setAplicaEntr(!!c)}
              />
              <Label htmlFor="aplica-entr" className="cursor-pointer">
                Aplicar data de entrega
              </Label>
            </div>
            <Input
              type="datetime-local"
              value={entr}
              disabled={!aplicaEntr}
              onChange={(e) => setEntr(e.target.value)}
            />
          </div>

          <p className="text-xs text-muted-foreground">
            Status será atualizado automaticamente conforme as datas.
            OS canceladas e OS com data de conclusão anterior à entrada serão ignoradas.
          </p>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={salvando}>
            Cancelar
          </Button>
          <Button onClick={aplicar} disabled={salvando}>
            {salvando ? "Aplicando..." : "Aplicar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
