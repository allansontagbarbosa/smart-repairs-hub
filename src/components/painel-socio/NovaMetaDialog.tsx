import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const ICONES = ["🚗", "🏖️", "🏠", "💼", "💰", "📚", "👨‍👩‍👧", "💍", "🎯", "💪"];

export function NovaMetaDialog({ open, onOpenChange }: Props) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [titulo, setTitulo] = useState("");
  const [valor, setValor] = useState("");
  const [dataAlvo, setDataAlvo] = useState("");
  const [icone, setIcone] = useState("🎯");

  const criar = useMutation({
    mutationFn: async () => {
      const { data: socio, error: errSocio } = await supabase
        .from("socios")
        .select("id, empresa_id")
        .eq("user_id", user!.id)
        .eq("ativo", true)
        .is("deleted_at", null)
        .maybeSingle();
      if (errSocio) throw errSocio;
      if (!socio) throw new Error("Sócio não encontrado");

      const valorCentavos = Math.round(parseFloat(valor.replace(",", ".")) * 100);
      if (!valorCentavos || valorCentavos <= 0) throw new Error("Valor inválido");

      const { error } = await supabase.from("socio_metas" as any).insert({
        empresa_id: socio.empresa_id,
        socio_id: socio.id,
        user_id: user!.id,
        titulo,
        valor_alvo_centavos: valorCentavos,
        data_alvo: dataAlvo || null,
        icone,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Meta criada");
      qc.invalidateQueries({ queryKey: ["painel-socio"] });
      onOpenChange(false);
      setTitulo("");
      setValor("");
      setDataAlvo("");
      setIcone("🎯");
    },
    onError: (err: any) => toast.error(err.message || "Erro ao criar meta"),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nova meta pessoal</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div>
            <Label>Ícone</Label>
            <div className="flex flex-wrap gap-1 mt-1">
              {ICONES.map((i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setIcone(i)}
                  className={`text-xl p-2 rounded ${icone === i ? "bg-accent" : "hover:bg-muted"}`}
                >
                  {i}
                </button>
              ))}
            </div>
          </div>
          <div>
            <Label>Título</Label>
            <Input value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="Ex: Trocar de carro" />
          </div>
          <div>
            <Label>Valor alvo (R$)</Label>
            <Input value={valor} onChange={(e) => setValor(e.target.value)} placeholder="35000,00" inputMode="decimal" />
          </div>
          <div>
            <Label>Data alvo (opcional)</Label>
            <Input type="date" value={dataAlvo} onChange={(e) => setDataAlvo(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={() => criar.mutate()} disabled={criar.isPending || !titulo || !valor}>
            {criar.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Criar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
