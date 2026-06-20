import { useEffect, useState } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { CurrencyInput } from "@/components/smart-inputs/CurrencyInput";
import {
  ContaBancaria, TIPO_CONTA_LABEL, useCriarConta, useEditarConta,
} from "@/hooks/useContasBancarias";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  conta?: ContaBancaria | null;
}

const COR_PRESETS = ["#00C896", "#3B82F6", "#F59E0B", "#EF4444", "#8B5CF6", "#EC4899", "#14B8A6", "#64748B"];

export function NovaContaBancariaDialog({ open, onOpenChange, conta }: Props) {
  const criar = useCriarConta();
  const editar = useEditarConta();
  const isEdit = !!conta;

  const [nome, setNome] = useState("");
  const [tipo, setTipo] = useState("corrente");
  const [instituicao, setInstituicao] = useState("");
  const [cor, setCor] = useState<string>("#00C896");
  const [saldoInicial, setSaldoInicial] = useState(0);

  useEffect(() => {
    if (open) {
      setNome(conta?.nome ?? "");
      setTipo(conta?.tipo ?? "corrente");
      setInstituicao(conta?.instituicao ?? "");
      setCor(conta?.cor ?? "#00C896");
      setSaldoInicial(conta?.saldo_inicial ?? 0);
    }
  }, [open, conta]);

  const handleSalvar = async () => {
    if (!nome.trim()) return;
    if (isEdit && conta) {
      await editar.mutateAsync({
        id: conta.id, nome, tipo, instituicao: instituicao || null, cor,
      });
    } else {
      await criar.mutateAsync({
        nome, tipo, instituicao: instituicao || undefined, cor, saldo_inicial: saldoInicial,
      });
    }
    onOpenChange(false);
  };

  const loading = criar.isPending || editar.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? "Editar conta" : "Nova conta bancária"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Nome</Label>
            <Input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex: Nubank PJ" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Tipo</Label>
              <Select value={tipo} onValueChange={setTipo}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(TIPO_CONTA_LABEL).map(([v, l]) => (
                    <SelectItem key={v} value={v}>{l}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Instituição</Label>
              <Input value={instituicao} onChange={(e) => setInstituicao(e.target.value)} placeholder="Opcional" />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Cor</Label>
            <div className="flex flex-wrap gap-2">
              {COR_PRESETS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setCor(c)}
                  className={`h-7 w-7 rounded-full border-2 transition ${cor === c ? "border-foreground scale-110" : "border-transparent"}`}
                  style={{ backgroundColor: c }}
                  aria-label={`Cor ${c}`}
                />
              ))}
            </div>
          </div>
          {!isEdit && (
            <div className="space-y-2">
              <Label>Saldo inicial</Label>
              <CurrencyInput value={saldoInicial} onValueChange={setSaldoInicial} />
              <p className="text-xs text-muted-foreground">A partir desse valor, o sistema passa a movimentar.</p>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={loading}>Cancelar</Button>
          <Button onClick={handleSalvar} disabled={loading || !nome.trim()}>
            {loading ? "Salvando..." : isEdit ? "Salvar" : "Criar conta"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
