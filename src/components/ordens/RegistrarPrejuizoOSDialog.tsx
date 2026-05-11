import { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertTriangle, Loader2 } from "lucide-react";
import { toast } from "sonner";

type TipoPrejuizo =
  | "garantia"
  | "peca_danificada"
  | "cliente_sumiu"
  | "fraude_chargeback"
  | "furto_extravio"
  | "cancelamento_com_peca"
  | "outro";

const TIPO_LABELS: Record<TipoPrejuizo, string> = {
  garantia: "Garantia (refizemos o serviço, peça do nosso bolso)",
  peca_danificada: "Peça danificada na bancada",
  cliente_sumiu: "Cliente sumiu sem pagar",
  fraude_chargeback: "Fraude / Chargeback",
  furto_extravio: "Furto ou extravio",
  cancelamento_com_peca: "OS cancelada após instalar peça",
  outro: "Outro",
};

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  osId: string;
  osNumero: number;
  custoPecasOS: number;
}

export function RegistrarPrejuizoOSDialog({ open, onOpenChange, osId, osNumero, custoPecasOS }: Props) {
  const qc = useQueryClient();
  const [tipo, setTipo] = useState<TipoPrejuizo>("garantia");
  const [valorReais, setValorReais] = useState("");
  const [descricao, setDescricao] = useState("");
  const [observacoes, setObservacoes] = useState("");
  const [dataEvento, setDataEvento] = useState(new Date().toISOString().slice(0, 10));

  useEffect(() => {
    if (open) {
      const valorSugerido = custoPecasOS.toFixed(2).replace(".", ",");
      setValorReais(valorSugerido);
      setTipo("garantia");
      setDescricao(`Prejuízo na OS #${osNumero}`);
      setObservacoes("");
      setDataEvento(new Date().toISOString().slice(0, 10));
    }
  }, [open, custoPecasOS, osNumero]);

  const criar = useMutation({
    mutationFn: async () => {
      const valor_centavos = Math.round(parseFloat(valorReais.replace(",", ".")) * 100);
      if (!valor_centavos || valor_centavos <= 0) {
        throw new Error("Valor inválido");
      }
      const { data, error } = await supabase.rpc("criar_prejuizo" as any, {
        p_tipo: tipo,
        p_valor_centavos: valor_centavos,
        p_descricao: descricao || null,
        p_observacoes: observacoes || null,
        p_os_origem_id: osId,
        p_os_retrabalho_id: null,
        p_data_evento: dataEvento,
        p_origem: "manual",
      });
      if (error) throw error;
      const r = data as any;
      if (!r?.success) throw new Error(r?.error ?? "Erro ao registrar prejuízo");
      return r;
    },
    onSuccess: () => {
      toast.success("Prejuízo registrado com sucesso");
      qc.invalidateQueries({ queryKey: ["prejuizos"] });
      qc.invalidateQueries({ queryKey: ["prejuizos_fin"] });
      qc.invalidateQueries({ queryKey: ["movimentacoes-financeiras"] });
      qc.invalidateQueries({ queryKey: ["rel-dre-prejuizos"] });
      qc.invalidateQueries({ queryKey: ["recebimentos"] });
      onOpenChange(false);
    },
    onError: (err: any) => {
      toast.error(err.message || "Erro ao registrar prejuízo");
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            Registrar prejuízo da OS #{osNumero}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <Alert>
            <AlertDescription className="text-xs">
              O prejuízo aparecerá em <strong>Financeiro → Prejuízos</strong> e
              afetará a DRE como custo operacional (garantia/peça/cancelamento)
              ou resultado não-operacional (fraude/furto/sumiu). Movimentação
              financeira será criada automaticamente.
            </AlertDescription>
          </Alert>

          <div className="space-y-2">
            <Label>Tipo de prejuízo</Label>
            <Select value={tipo} onValueChange={(v) => setTipo(v as TipoPrejuizo)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(TIPO_LABELS) as TipoPrejuizo[]).map((t) => (
                  <SelectItem key={t} value={t}>{TIPO_LABELS[t]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Valor (R$)</Label>
            <Input
              value={valorReais}
              onChange={(e) => setValorReais(e.target.value)}
              placeholder="0,00"
            />
            {custoPecasOS > 0 && (
              <p className="text-xs text-muted-foreground">
                Sugerido: R$ {custoPecasOS.toFixed(2).replace(".", ",")} (custo das peças desta OS)
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label>Data do evento</Label>
            <Input
              type="date"
              value={dataEvento}
              onChange={(e) => setDataEvento(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label>Descrição</Label>
            <Input
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              placeholder="Ex: Tela trocada de novo, defeito do martelo"
            />
          </div>

          <div className="space-y-2">
            <Label>Observações (opcional)</Label>
            <Textarea
              value={observacoes}
              onChange={(e) => setObservacoes(e.target.value)}
              rows={3}
              placeholder="Detalhes do que aconteceu..."
            />
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={criar.isPending}>
            Cancelar
          </Button>
          <Button
            onClick={() => criar.mutate()}
            disabled={criar.isPending}
            className="bg-destructive hover:bg-destructive/90 text-destructive-foreground"
          >
            {criar.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            Registrar prejuízo
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
