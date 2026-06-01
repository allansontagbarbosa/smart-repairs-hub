import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, AlertTriangle, Loader2 } from "lucide-react";
import { CurrencyInput } from "@/components/smart-inputs/CurrencyInput";
import { useTerceiros, useSalvarTerceiro, useEnviarParaTerceiro } from "@/hooks/useTerceirizacao";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  osId: string;
}

export function EnviarTerceiroDialog({ open, onOpenChange, osId }: Props) {
  const { data: terceiros = [] } = useTerceiros();
  const salvarTerceiro = useSalvarTerceiro();
  const enviar = useEnviarParaTerceiro();

  const [modoNovo, setModoNovo] = useState(false);
  const [terceiroId, setTerceiroId] = useState<string>("");
  const [novoNome, setNovoNome] = useState("");
  const [novoContato, setNovoContato] = useState("");
  const [servico, setServico] = useState("");
  const [custo, setCusto] = useState(0);
  const [dataEnvio, setDataEnvio] = useState(new Date().toISOString().slice(0, 10));
  const [previsao, setPrevisao] = useState("");
  const [obs, setObs] = useState("");

  useEffect(() => {
    if (!open) {
      setModoNovo(false); setTerceiroId(""); setNovoNome(""); setNovoContato("");
      setServico(""); setCusto(0); setDataEnvio(new Date().toISOString().slice(0, 10));
      setPrevisao(""); setObs("");
    }
  }, [open]);

  const handleSubmit = async () => {
    let tercId: string | null = terceiroId || null;
    let tercNome: string | null = null;

    if (modoNovo) {
      if (!novoNome.trim()) { return; }
      const res = await salvarTerceiro.mutateAsync({
        nome: novoNome.trim(),
        contato: novoContato.trim() || null,
      });
      tercId = res.id;
      tercNome = novoNome.trim();
    } else if (terceiroId) {
      tercNome = terceiros.find(t => t.id === terceiroId)?.nome ?? null;
    }

    if (!tercId && !tercNome) return;

    await enviar.mutateAsync({
      os_id: osId,
      terceiro_id: tercId,
      terceiro_nome: tercNome,
      servico: servico.trim() || null,
      custo: custo,
      data_envio: dataEnvio || null,
      previsao_retorno: previsao || null,
      observacoes: obs.trim() || null,
    });
    onOpenChange(false);
  };

  const pending = enviar.isPending || salvarTerceiro.isPending;
  const podeSalvar = (modoNovo ? novoNome.trim().length > 0 : terceiroId.length > 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Enviar aparelho para terceiro</DialogTitle>
          <DialogDescription>
            A OS vai para o status "Terceirizado" e o custo é abatido do lucro.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Terceiro</Label>
            {!modoNovo ? (
              <div className="flex gap-2">
                <Select value={terceiroId} onValueChange={setTerceiroId}>
                  <SelectTrigger className="flex-1"><SelectValue placeholder="Selecione um terceiro" /></SelectTrigger>
                  <SelectContent>
                    {terceiros.filter(t => t.ativo).map(t => (
                      <SelectItem key={t.id} value={t.id}>
                        {t.nome}{t.especialidade ? ` · ${t.especialidade}` : ""}
                      </SelectItem>
                    ))}
                    {terceiros.length === 0 && (
                      <div className="px-2 py-1.5 text-xs text-muted-foreground">Nenhum terceiro cadastrado</div>
                    )}
                  </SelectContent>
                </Select>
                <Button type="button" variant="outline" size="sm" onClick={() => setModoNovo(true)}>
                  <Plus className="h-4 w-4 mr-1" /> Novo
                </Button>
              </div>
            ) : (
              <div className="space-y-2 rounded-md border p-3 bg-muted/30">
                <Input placeholder="Nome do terceiro *" value={novoNome} onChange={e => setNovoNome(e.target.value)} />
                <Input placeholder="Contato (WhatsApp/telefone)" value={novoContato} onChange={e => setNovoContato(e.target.value)} />
                <Button type="button" variant="ghost" size="sm" onClick={() => setModoNovo(false)}>
                  Escolher um já cadastrado
                </Button>
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label>Serviço terceirizado</Label>
            <Input value={servico} onChange={e => setServico(e.target.value)} placeholder="Ex: troca de chip de carga, microsoldagem…" />
          </div>

          <div className="space-y-2">
            <Label>Custo pago ao terceiro</Label>
            <CurrencyInput value={custo} onValueChange={setCusto} placeholder="R$ 0,00" />
            <div className="flex items-start gap-2 rounded-md border border-warning/30 bg-warning-muted/50 p-2 text-xs text-warning-foreground">
              <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0 text-warning" />
              <span>Este valor é <b>custo da OS</b>, abate do lucro. Não é receita.</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Data de envio</Label>
              <Input type="date" value={dataEnvio} onChange={e => setDataEnvio(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Previsão de retorno</Label>
              <Input type="date" value={previsao} onChange={e => setPrevisao(e.target.value)} />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Observações</Label>
            <Textarea rows={2} value={obs} onChange={e => setObs(e.target.value)} placeholder="Opcional" />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>Cancelar</Button>
          <Button onClick={handleSubmit} disabled={!podeSalvar || pending}>
            {pending && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
            Enviar para terceiro
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
