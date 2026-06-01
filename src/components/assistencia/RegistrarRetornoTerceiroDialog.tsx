import { useState, useEffect, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, ShieldCheck, AlertTriangle, ArrowRight } from "lucide-react";
import { CurrencyInput } from "@/components/smart-inputs/CurrencyInput";
import { useRegistrarRetornoTerceiro, type Terceirizacao } from "@/hooks/useTerceirizacao";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  terceirizacao: Pick<Terceirizacao, "id" | "os_id" | "custo" | "servico" | "terceiro_nome"> | null;
}

const STATUS_OPTIONS = [
  { value: "em_reparo", label: "Em reparo" },
  { value: "pronto_entrega", label: "Pronto p/ entrega" },
  { value: "aguardando_aprovacao", label: "Aguardando aprovação" },
];

export function RegistrarRetornoTerceiroDialog({ open, onOpenChange, terceirizacao }: Props) {
  const retorno = useRegistrarRetornoTerceiro();
  const hoje = new Date().toISOString().slice(0, 10);

  const [dataRetorno, setDataRetorno] = useState(hoje);
  const [servicoRealizado, setServicoRealizado] = useState("");
  const [custoFinal, setCustoFinal] = useState(0);
  const [garantiaDias, setGarantiaDias] = useState<string>("");
  const [obs, setObs] = useState("");
  const [novoStatus, setNovoStatus] = useState("em_reparo");

  useEffect(() => {
    if (open && terceirizacao) {
      setDataRetorno(hoje);
      setServicoRealizado(terceirizacao.servico ?? "");
      setCustoFinal(Number(terceirizacao.custo) || 0);
      setGarantiaDias("");
      setObs("");
      setNovoStatus("em_reparo");
    }
  }, [open, terceirizacao]);

  const garantiaAte = useMemo(() => {
    if (!dataRetorno || !garantiaDias) return null;
    const d = new Date(dataRetorno + "T00:00:00");
    d.setDate(d.getDate() + Number(garantiaDias));
    return d.toLocaleDateString("pt-BR");
  }, [dataRetorno, garantiaDias]);

  if (!terceirizacao) return null;

  const custoEnviado = Number(terceirizacao.custo) || 0;
  const mudou = Math.abs(custoFinal - custoEnviado) > 0.001;

  const handleSubmit = async () => {
    await retorno.mutateAsync({
      terceirizacao_id: terceirizacao.id,
      os_id: terceirizacao.os_id,
      data_retorno: dataRetorno,
      servico_realizado: servicoRealizado.trim() || null,
      custo_final: custoFinal,
      garantia_dias: garantiaDias ? Number(garantiaDias) : null,
      observacoes: obs.trim() || null,
      novo_status_os: novoStatus,
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Registrar retorno do terceiro</DialogTitle>
          <DialogDescription>
            Confirme o que voltou de {terceirizacao.terceiro_nome || "terceiro"}: custo final, serviço e garantia.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Data de retorno</Label>
            <Input type="date" value={dataRetorno} onChange={e => setDataRetorno(e.target.value)} />
          </div>

          <div className="space-y-2">
            <Label>Serviço realizado</Label>
            <Textarea
              rows={2}
              value={servicoRealizado}
              onChange={e => setServicoRealizado(e.target.value)}
              placeholder="O que o terceiro de fato fez"
            />
          </div>

          <div className="space-y-2">
            <Label>Custo final (R$)</Label>
            <CurrencyInput value={custoFinal} onValueChange={setCustoFinal} placeholder="R$ 0,00" />
            {mudou && (
              <div className="text-xs text-muted-foreground inline-flex items-center gap-1">
                enviado R$ {custoEnviado.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                <ArrowRight className="h-3 w-3" />
                final R$ {custoFinal.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
              </div>
            )}
            <div className="flex items-start gap-2 rounded-md border border-warning/30 bg-warning-muted/50 p-2 text-xs text-warning-foreground">
              <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0 text-warning" />
              <span>É <b>custo da OS</b>, abate do lucro.</span>
            </div>
          </div>

          <div className="space-y-2">
            <Label className="inline-flex items-center gap-1">
              <ShieldCheck className="h-3.5 w-3.5" /> Garantia do terceiro (dias)
            </Label>
            <Input
              type="number"
              min={0}
              value={garantiaDias}
              onChange={e => setGarantiaDias(e.target.value.replace(/[^0-9]/g, ""))}
              placeholder="Ex: 90"
            />
            {garantiaAte && (
              <span className="text-xs text-muted-foreground">Garantia até {garantiaAte}</span>
            )}
          </div>

          <div className="space-y-2">
            <Label>OS volta para o status</Label>
            <Select value={novoStatus} onValueChange={setNovoStatus}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {STATUS_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Observações</Label>
            <Textarea rows={2} value={obs} onChange={e => setObs(e.target.value)} placeholder="Opcional" />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={retorno.isPending}>Cancelar</Button>
          <Button onClick={handleSubmit} disabled={retorno.isPending}>
            {retorno.isPending && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
            Confirmar retorno
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
