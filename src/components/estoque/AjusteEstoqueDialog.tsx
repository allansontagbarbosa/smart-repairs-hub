import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { toast } from "sonner";
import { Loader2, Wrench } from "lucide-react";
import type { EstoqueItem } from "@/hooks/useEstoque";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  itens: EstoqueItem[];
}

const motivos = [
  { value: "contagem", label: "Contagem" },
  { value: "perda", label: "Perda" },
  { value: "quebra", label: "Quebra" },
  { value: "devolucao_cliente", label: "Devolução cliente" },
  { value: "devolucao_fornecedor", label: "Devolução fornecedor" },
  { value: "outros", label: "Outros" },
];

export function AjusteEstoqueDialog({ open, onOpenChange, itens }: Props) {
  const queryClient = useQueryClient();
  const [pecaId, setPecaId] = useState("");
  const [tipo, setTipo] = useState<"entrada" | "saida">("entrada");
  const [quantidade, setQuantidade] = useState<string>("1");
  const [motivo, setMotivo] = useState("");
  const [observacao, setObservacao] = useState("");

  const reset = () => {
    setPecaId("");
    setTipo("entrada");
    setQuantidade("1");
    setMotivo("");
    setObservacao("");
  };

  const getNome = (i: EstoqueItem) =>
    i.nome_personalizado ||
    [i.marcas?.nome, i.modelos?.nome].filter(Boolean).join(" ") ||
    i.sku ||
    "Peça";

  const mutation = useMutation({
    mutationFn: async () => {
      const item = itens.find((i) => i.id === pecaId);
      if (!item) throw new Error("Peça não selecionada");
      const qtd = parseInt(quantidade) || 0;
      if (qtd <= 0) throw new Error("Quantidade inválida");
      if (!motivo) throw new Error("Selecione um motivo");

      const novaQtd = tipo === "entrada" ? item.quantidade + qtd : item.quantidade - qtd;
      if (novaQtd < 0) throw new Error("Estoque ficaria negativo");

      const { error: e1 } = await supabase
        .from("estoque_itens")
        .update({ quantidade: novaQtd })
        .eq("id", pecaId);
      if (e1) throw e1;

      const { error: e2 } = await supabase.from("estoque_movimentos").insert({
        peca_id: pecaId,
        tipo: tipo,
        quantidade: qtd,
        motivo: `${motivos.find((m) => m.value === motivo)?.label || motivo}${observacao ? ` — ${observacao}` : ""}`,
      });
      if (e2) throw e2;
    },
    onSuccess: () => {
      toast.success("Ajuste registrado com sucesso!");
      queryClient.invalidateQueries({ queryKey: ["estoque_itens"] });
      reset();
      onOpenChange(false);
    },
    onError: (e: any) => toast.error(e.message || "Erro ao registrar ajuste"),
  });

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) reset();
        onOpenChange(o);
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wrench className="h-4 w-4 text-primary" /> Registrar ajuste
          </DialogTitle>
          <DialogDescription>
            Use para acertos sem nota fiscal: contagem, perda, quebra ou devolução.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 mt-2">
          <div>
            <Label className="text-xs">Peça *</Label>
            <Select value={pecaId} onValueChange={setPecaId}>
              <SelectTrigger className="mt-1">
                <SelectValue placeholder="Selecione a peça..." />
              </SelectTrigger>
              <SelectContent>
                {itens.map((i) => (
                  <SelectItem key={i.id} value={i.id}>
                    {getNome(i)} (Qtd: {i.quantidade})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label className="text-xs">Tipo *</Label>
            <RadioGroup
              value={tipo}
              onValueChange={(v) => setTipo(v as "entrada" | "saida")}
              className="flex gap-4 mt-1.5"
            >
              <div className="flex items-center gap-2">
                <RadioGroupItem value="entrada" id="tipo-entrada" />
                <Label htmlFor="tipo-entrada" className="text-sm cursor-pointer">
                  Entrada (+)
                </Label>
              </div>
              <div className="flex items-center gap-2">
                <RadioGroupItem value="saida" id="tipo-saida" />
                <Label htmlFor="tipo-saida" className="text-sm cursor-pointer">
                  Saída (−)
                </Label>
              </div>
            </RadioGroup>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Quantidade *</Label>
              <Input
                type="number"
                min={1}
                className="mt-1"
                value={quantidade}
                onChange={(e) => setQuantidade(e.target.value)}
              />
            </div>
            <div>
              <Label className="text-xs">Motivo *</Label>
              <Select value={motivo} onValueChange={setMotivo}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Selecione..." />
                </SelectTrigger>
                <SelectContent>
                  {motivos.map((m) => (
                    <SelectItem key={m.value} value={m.value}>
                      {m.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label className="text-xs">Observação</Label>
            <Textarea
              className="mt-1 resize-none"
              rows={2}
              value={observacao}
              onChange={(e) => setObservacao(e.target.value)}
              placeholder="Opcional"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button
              onClick={() => mutation.mutate()}
              disabled={mutation.isPending || !pecaId || !motivo}
            >
              {mutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Registrar ajuste
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
