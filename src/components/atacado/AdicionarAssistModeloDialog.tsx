import { useEffect, useState } from "react";
import { Loader2, Plus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { AtacadoTipoAssistencia } from "@/hooks/useAtacadoCadastroDados";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  modeloId: string | null | undefined;
  modeloNome?: string;
  tipos: AtacadoTipoAssistencia[];
  jaVinculados: Set<string>;
  onSaved: () => void;
}

export function AdicionarAssistModeloDialog({
  open,
  onOpenChange,
  modeloId,
  modeloNome,
  tipos,
  jaVinculados,
  onSaved,
}: Props) {
  const [modo, setModo] = useState<"existente" | "nova">("existente");
  const [tipoId, setTipoId] = useState("");
  const [novoNome, setNovoNome] = useState("");
  const [valor, setValor] = useState("");
  const [saving, setSaving] = useState(false);

  const disponiveis = tipos.filter((t) => t.ativo && !jaVinculados.has(t.id));

  useEffect(() => {
    if (!open) {
      setTipoId("");
      setNovoNome("");
      setValor("");
      setModo(disponiveis.length === 0 ? "nova" : "existente");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (!tipoId) return;
    const t = tipos.find((x) => x.id === tipoId);
    if (t) setValor(String(t.valor_padrao ?? 0));
  }, [tipoId, tipos]);

  const handleSalvar = async () => {
    if (!modeloId) {
      toast.error("Modelo ainda não está disponível. Aguarde um instante e tente novamente.");
      return;
    }
    const v = parseFloat(valor.replace(",", ".")) || 0;
    setSaving(true);
    let error;
    if (modo === "nova") {
      const nome = novoNome.trim();
      if (!nome) {
        setSaving(false);
        toast.error("Informe o nome da assistência");
        return;
      }
      ({ error } = await supabase.rpc("atacado_criar_assist_e_vincular" as any, {
        p_modelo_id: modeloId,
        p_nome: nome,
        p_valor: v,
      }));
    } else {
      if (!tipoId) {
        setSaving(false);
        return;
      }
      ({ error } = await supabase.rpc("atacado_set_assist_modelo" as any, {
        p_modelo_id: modeloId,
        p_tipo_id: tipoId,
        p_valor: v,
      }));
    }
    setSaving(false);
    if (error) {
      toast.error("Erro ao vincular: " + error.message);
      return;
    }
    toast.success(modo === "nova" ? "Assistência criada e vinculada" : "Assistência vinculada");
    onOpenChange(false);
    onSaved();
  };

  const disabled =
    saving || (modo === "existente" ? !tipoId : !novoNome.trim());

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            Adicionar assistência {modeloNome ? `a ${modeloNome}` : ""}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="flex rounded-md border overflow-hidden text-xs">
            <button
              type="button"
              onClick={() => setModo("existente")}
              className={`flex-1 px-3 py-1.5 ${modo === "existente" ? "bg-primary text-primary-foreground" : "bg-background"}`}
            >
              Usar existente
            </button>
            <button
              type="button"
              onClick={() => setModo("nova")}
              className={`flex-1 px-3 py-1.5 ${modo === "nova" ? "bg-primary text-primary-foreground" : "bg-background"}`}
            >
              Criar nova
            </button>
          </div>

          {modo === "existente" ? (
            tipos.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Nenhum tipo de assistência cadastrado. Use "Criar nova" acima.
              </p>
            ) : (
              <div className="space-y-1.5">
                <Label className="text-xs">Tipo de assistência</Label>
                <Select value={tipoId} onValueChange={setTipoId}>
                  <SelectTrigger>
                    <SelectValue
                      placeholder={
                        disponiveis.length === 0
                          ? "Todos os tipos já vinculados"
                          : "Escolha um tipo"
                      }
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {disponiveis.map((t) => (
                      <SelectItem key={t.id} value={t.id}>
                        {t.nome}
                        {t.valor_padrao > 0 && (
                          <span className="text-muted-foreground ml-2 text-xs">
                            sugerido: R$ {Number(t.valor_padrao).toFixed(2)}
                          </span>
                        )}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )
          ) : (
            <div className="space-y-1.5">
              <Label className="text-xs">Nome da nova assistência</Label>
              <Input
                value={novoNome}
                onChange={(e) => setNovoNome(e.target.value)}
                placeholder="Ex.: Bateria, Tela…"
              />
              <p className="text-[10px] text-muted-foreground">
                Se já existir um tipo com esse nome, será reaproveitado.
              </p>
            </div>
          )}

          <div className="space-y-1.5">
            <Label className="text-xs">Preço para este modelo (R$)</Label>
            <Input
              inputMode="decimal"
              value={valor}
              onChange={(e) => setValor(e.target.value)}
              placeholder="0,00"
            />
            <p className="text-[10px] text-muted-foreground">
              Esse preço fica salvo neste modelo e será sugerido nos próximos cadastros.
            </p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSalvar} disabled={disabled}>
            {saving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Plus className="h-4 w-4" />
            )}
            {modo === "nova" ? "Criar e vincular" : "Vincular ao modelo"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
