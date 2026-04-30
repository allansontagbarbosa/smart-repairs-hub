import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, AlertTriangle, Wrench, DollarSign, XCircle } from "lucide-react";
import { toast } from "sonner";
import { StatusBadge } from "@/components/StatusBadge";
import { statusLabels, type Status } from "@/lib/status";
import { invalidateOrdensDependentes } from "@/lib/cacheInvalidation";
import { formatNumeroOS } from "@/lib/numeroOS";

type Preview = {
  pode_cancelar: boolean;
  motivo_bloqueio: string | null;
  status_atual: Status;
  numero: number;
  numero_formatado: string | null;
  qtd_pecas: number;
  total_pecas: number;
  qtd_comissoes: number;
  total_comissoes: number;
  tem_impacto_financeiro: boolean;
};

interface Props {
  ordemId: string | null;
  onClose: () => void;
  onCancelled?: () => void;
}

const fmt = (v: number) =>
  `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export function CancelarOSDialog({ ordemId, onClose, onCancelled }: Props) {
  const [step, setStep] = useState<1 | 2>(1);
  const [motivo, setMotivo] = useState("");
  const [confirmou, setConfirmou] = useState(false);
  const queryClient = useQueryClient();

  const open = !!ordemId;

  useEffect(() => {
    if (open) {
      setStep(1);
      setMotivo("");
      setConfirmou(false);
    }
  }, [open, ordemId]);

  const { data: preview, isLoading, error } = useQuery({
    queryKey: ["preview-cancelamento", ordemId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("preview_cancelamento_os", {
        p_ordem_id: ordemId!,
      });
      if (error) throw error;
      return data as unknown as Preview;
    },
    enabled: open,
  });

  const cancelMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc("cancelar_os", {
        p_ordem_id: ordemId!,
        p_motivo: motivo.trim(),
      });
      if (error) throw error;
      return data as unknown as {
        sucesso: boolean;
        numero: number;
        numero_formatado: string | null;
        pecas_estornadas: number;
        comissoes_estornadas: number;
        qtd_pecas: number;
        qtd_comissoes: number;
      };
    },
    onSuccess: (res) => {
      const label = `#${formatNumeroOS(res.numero, res.numero_formatado)}`;
      const partes: string[] = [];
      if (res.qtd_pecas > 0) partes.push(`${fmt(res.pecas_estornadas)} em peças devolvidas ao estoque`);
      if (res.qtd_comissoes > 0) partes.push(`${fmt(res.comissoes_estornadas)} em comissões estornadas`);
      toast.success(
        partes.length === 0
          ? `OS ${label} cancelada com sucesso.`
          : `OS ${label} cancelada. ${partes.join(", ")}.`
      );
      invalidateOrdensDependentes(queryClient);
      queryClient.invalidateQueries({ queryKey: ["ordens-older"] });
      queryClient.invalidateQueries({ queryKey: ["ordem", ordemId] });
      onCancelled?.();
      onClose();
    },
    onError: (err: Error) => toast.error(err.message ?? "Erro ao cancelar OS"),
  });

  const motivoValido = motivo.trim().length >= 10;
  const labelOS = preview ? `#${formatNumeroOS(preview.numero, preview.numero_formatado)}` : "";

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        {isLoading ? (
          <div className="py-10 flex justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : error ? (
          <>
            <DialogHeader>
              <DialogTitle className="text-destructive flex items-center gap-2">
                <XCircle className="h-5 w-5" /> Erro
              </DialogTitle>
            </DialogHeader>
            <p className="text-sm text-muted-foreground">{(error as Error).message}</p>
            <DialogFooter>
              <Button variant="outline" onClick={onClose}>Fechar</Button>
            </DialogFooter>
          </>
        ) : !preview ? null : !preview.pode_cancelar ? (
          <>
            <DialogHeader>
              <DialogTitle>Cancelar OS {labelOS}?</DialogTitle>
            </DialogHeader>
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>{preview.motivo_bloqueio}</AlertDescription>
            </Alert>
            <DialogFooter>
              <Button variant="outline" onClick={onClose}>Fechar</Button>
            </DialogFooter>
          </>
        ) : step === 1 ? (
          <>
            <DialogHeader>
              <DialogTitle>Cancelar OS {labelOS}?</DialogTitle>
              <DialogDescription className="flex items-center gap-2 pt-1">
                Status atual: <StatusBadge status={preview.status_atual} />
              </DialogDescription>
            </DialogHeader>

            {!preview.tem_impacto_financeiro ? (
              <Alert>
                <AlertDescription className="text-sm">
                  Esta OS não tem peças nem comissões geradas. O cancelamento não terá impacto financeiro.
                </AlertDescription>
              </Alert>
            ) : (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  <p className="font-medium mb-2">Atenção: este cancelamento terá impacto:</p>
                  <ul className="space-y-1 text-sm">
                    {preview.qtd_pecas > 0 && (
                      <li className="flex items-center gap-2">
                        <Wrench className="h-3.5 w-3.5" />
                        {preview.qtd_pecas} peça{preview.qtd_pecas > 1 ? "s" : ""} ({fmt(preview.total_pecas)})
                      </li>
                    )}
                    {preview.qtd_comissoes > 0 && (
                      <li className="flex items-center gap-2">
                        <DollarSign className="h-3.5 w-3.5" />
                        {preview.qtd_comissoes} comissão{preview.qtd_comissoes > 1 ? "es" : ""} estornada{preview.qtd_comissoes > 1 ? "s" : ""} ({fmt(preview.total_comissoes)})
                      </li>
                    )}
                  </ul>
                  <p className="mt-2 text-xs">
                    Operação registrada em auditoria e não pode ser desfeita pelo sistema. Para reverter, será necessário criar uma nova OS manualmente.
                  </p>
                </AlertDescription>
              </Alert>
            )}

            <DialogFooter>
              <Button variant="outline" onClick={onClose}>Voltar</Button>
              <Button variant="destructive" onClick={() => setStep(2)}>Continuar</Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>Confirmar cancelamento — OS {labelOS}</DialogTitle>
            </DialogHeader>

            <div className="space-y-3">
              <div>
                <Label htmlFor="motivo" className="text-sm">
                  Motivo do cancelamento <span className="text-destructive">*</span>
                </Label>
                <Textarea
                  id="motivo"
                  value={motivo}
                  onChange={(e) => setMotivo(e.target.value)}
                  placeholder="Descreva o motivo (mínimo 10 caracteres)"
                  rows={4}
                  className="mt-1"
                />
                <p className={`text-xs mt-1 ${motivoValido ? "text-success" : "text-muted-foreground"}`}>
                  {motivo.trim().length}/10 caracteres mínimos
                </p>
              </div>

              <div className="flex items-start gap-2 pt-1">
                <Checkbox
                  id="confirmar"
                  checked={confirmou}
                  onCheckedChange={(v) => setConfirmou(v === true)}
                />
                <Label htmlFor="confirmar" className="text-xs leading-relaxed cursor-pointer">
                  Confirmo que li o impacto e quero cancelar esta OS
                </Label>
              </div>
            </div>

            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setStep(1)}
                disabled={cancelMutation.isPending}
              >
                Voltar
              </Button>
              <Button
                variant="destructive"
                disabled={!motivoValido || !confirmou || cancelMutation.isPending}
                onClick={() => cancelMutation.mutate()}
              >
                {cancelMutation.isPending && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
                Cancelar OS
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
