import { useState } from "react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CurrencyInput } from "@/components/smart-inputs/CurrencyInput";
import { AlertCircle, Loader2 } from "lucide-react";
import { useSolicitarLancamento, type TipoLancamento } from "@/hooks/useSocioSolicitacoes";

interface SocioOpt {
  id: string;
  nome: string;
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  socios: SocioOpt[];
}

const TIPOS: { value: TipoLancamento; label: string; hint: string }[] = [
  { value: "credito", label: "Crédito", hint: "Entrada de valor pro sócio" },
  { value: "debito", label: "Débito", hint: "Saída de valor" },
  { value: "pro_labore", label: "Pró-labore", hint: "Remuneração mensal" },
  { value: "ajuste", label: "Ajuste", hint: "Correção contábil" },
];

export function NovoLancamentoDialog({ open, onOpenChange, socios }: Props) {
  const [socioDestino, setSocioDestino] = useState("");
  const [tipo, setTipo] = useState<TipoLancamento | "">("");
  const [valor, setValor] = useState(0);
  const [dataRef, setDataRef] = useState(() => new Date().toISOString().slice(0, 10));
  const [descricao, setDescricao] = useState("");
  const [erro, setErro] = useState<string | null>(null);

  const mut = useSolicitarLancamento();

  const reset = () => {
    setSocioDestino("");
    setTipo("");
    setValor(0);
    setDataRef(new Date().toISOString().slice(0, 10));
    setDescricao("");
    setErro(null);
  };

  const confirmar = async () => {
    setErro(null);
    if (!socioDestino) return setErro("Selecione o sócio destino");
    if (!tipo) return setErro("Selecione o tipo de lançamento");
    if (!valor || valor <= 0) return setErro("Informe um valor maior que zero");
    if (!dataRef) return setErro("Informe a data de referência");
    if (descricao.trim().length < 3) return setErro("Motivo precisa ter ao menos 3 caracteres");

    try {
      const r = await mut.mutateAsync({
        socio_destino: socioDestino,
        tipo,
        valor,
        data_referencia: dataRef,
        descricao: descricao.trim(),
      });
      toast.success(
        `Solicitação criada · aguardando ${Math.max(0, (r.votos_necessarios ?? 2) - (r.votos_atuais ?? 1))} aprovação`,
      );
      reset();
      onOpenChange(false);
    } catch (e: any) {
      setErro(traduzErro(e?.message));
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) reset();
        onOpenChange(v);
      }}
    >
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Novo lançamento retroativo</DialogTitle>
          <DialogDescription className="flex items-start gap-2 rounded-md bg-amber-500/10 text-amber-700 dark:text-amber-400 p-2 text-xs mt-2">
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
            <span>
              Esse lançamento precisa de 2 sócios pra ser aprovado. Você já será o 1º voto.
            </span>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Sócio destino</Label>
            <Select value={socioDestino} onValueChange={setSocioDestino}>
              <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>
                {socios.map((s) => (
                  <SelectItem key={s.id} value={s.id}>{s.nome}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>Tipo de lançamento</Label>
            <Select value={tipo} onValueChange={(v) => setTipo(v as TipoLancamento)}>
              <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>
                {TIPOS.map((t) => (
                  <SelectItem key={t.value} value={t.value}>
                    <div className="flex flex-col">
                      <span>{t.label}</span>
                      <span className="text-[10px] text-muted-foreground">{t.hint}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>Valor</Label>
            <CurrencyInput value={valor} onValueChange={setValor} />
          </div>

          <div className="space-y-1.5">
            <Label>Data de referência (competência)</Label>
            <Input type="date" value={dataRef} onChange={(e) => setDataRef(e.target.value)} />
            <p className="text-[11px] text-muted-foreground">Quando isso aconteceu na vida real</p>
          </div>

          <div className="space-y-1.5">
            <Label>Motivo / descrição</Label>
            <Textarea
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              maxLength={500}
              rows={3}
              placeholder="Ex: Ajuste retroativo de março/24 — receita não lançada"
            />
          </div>

          {erro && <div className="text-sm text-destructive">{erro}</div>}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={mut.isPending}>
            Cancelar
          </Button>
          <Button onClick={confirmar} disabled={mut.isPending}>
            {mut.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Criar solicitação
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function traduzErro(msg?: string) {
  if (!msg) return "Erro inesperado";
  const m = msg.toLowerCase();
  if (m.includes("already") || m.includes("ja vot") || m.includes("já vot")) return "Você já votou nessa solicitação";
  if (m.includes("permission") || m.includes("denied")) return "Sem permissão para esta ação";
  if (m.includes("socio") && m.includes("not")) return "Sócio destino inválido";
  return msg;
}
