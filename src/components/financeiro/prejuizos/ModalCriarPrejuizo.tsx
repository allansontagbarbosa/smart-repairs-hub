import { useState } from "react";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";
import { toast } from "sonner";
import { useCriarPrejuizo } from "@/hooks/usePrejuizos";
import { TipoPrejuizo, TIPO_PREJUIZO_LABELS } from "@/types/prejuizo";

const TIPOS: TipoPrejuizo[] = [
  "garantia",
  "peca_danificada",
  "cliente_sumiu",
  "fraude_chargeback",
  "furto_extravio",
  "cancelamento_com_peca",
  "outro",
];

export function ModalCriarPrejuizo({ onClose }: { onClose: () => void }) {
  const [tipo, setTipo] = useState<TipoPrejuizo>("outro");
  const [valor, setValor] = useState("");
  const [descricao, setDescricao] = useState("");
  const [observacoes, setObservacoes] = useState("");
  const [dataEvento, setDataEvento] = useState(
    new Date().toISOString().slice(0, 10)
  );
  const criar = useCriarPrejuizo();

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const valor_centavos = Math.round(
      parseFloat(valor.replace(",", ".")) * 100
    );
    if (!valor_centavos || valor_centavos <= 0) {
      toast.error("Valor inválido");
      return;
    }
    try {
      await criar.mutateAsync({
        tipo,
        valor_centavos,
        descricao,
        observacoes,
        data_evento: dataEvento,
      });
      toast.success("Prejuízo registrado com sucesso");
      onClose();
    } catch (err: any) {
      toast.error(err.message || "Erro ao registrar");
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <form
        onSubmit={submit}
        className="bg-card text-card-foreground rounded-xl p-6 w-full max-w-md space-y-4 shadow-xl"
      >
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">Registrar prejuízo</h3>
          <button
            type="button"
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">Tipo</label>
          <select
            value={tipo}
            onChange={(e) => setTipo(e.target.value as TipoPrejuizo)}
            className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm"
          >
            {TIPOS.map((t) => (
              <option key={t} value={t}>
                {TIPO_PREJUIZO_LABELS[t]}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">Valor (R$)</label>
          <input
            type="text"
            inputMode="decimal"
            value={valor}
            onChange={(e) => setValor(e.target.value)}
            placeholder="0,00"
            required
            className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm"
          />
        </div>

        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">Data</label>
          <input
            type="date"
            value={dataEvento}
            onChange={(e) => setDataEvento(e.target.value)}
            className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm"
          />
        </div>

        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">Descrição</label>
          <input
            type="text"
            value={descricao}
            onChange={(e) => setDescricao(e.target.value)}
            placeholder="Ex: Tela trocada na garantia da OS #123"
            className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm"
          />
        </div>

        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">Observações</label>
          <textarea
            value={observacoes}
            onChange={(e) => setObservacoes(e.target.value)}
            rows={3}
            className="w-full px-3 py-2 rounded-md border border-input bg-background text-sm"
          />
        </div>

        <div className="flex gap-2 justify-end pt-2">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" disabled={criar.isPending}>
            {criar.isPending ? "Salvando..." : "Registrar prejuízo"}
          </Button>
        </div>
      </form>
    </div>
  );
}
