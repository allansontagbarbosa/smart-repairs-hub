import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2, Loader2 } from "lucide-react";
import { formatBRL } from "@/lib/utils";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  tabelaId: string | null;
}

const MODELOS = [
  "iPhone 16 Pro Max",
  "iPhone 16 Pro",
  "iPhone 16 Plus",
  "iPhone 16",
  "iPhone 15 Pro Max",
  "iPhone 15 Pro",
  "iPhone 15",
  "iPhone 14 Pro Max",
  "iPhone 14 Pro",
  "iPhone 14",
  "iPhone 13",
  "iPhone 12",
  "Samsung Galaxy S24",
  "Samsung Galaxy S23",
];
const CAPACIDADES = ["64GB", "128GB", "256GB", "512GB", "1TB"];

export function EditarItensTabelaDialog({ open, onOpenChange, tabelaId }: Props) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [novoModelo, setNovoModelo] = useState("");
  const [novaCapacidade, setNovaCapacidade] = useState("");
  const [novoPreco, setNovoPreco] = useState("");
  const [preco5, setPreco5] = useState("");
  const [preco10, setPreco10] = useState("");

  const { data: tabela } = useQuery({
    queryKey: ["tabela-info", tabelaId],
    queryFn: async () => {
      if (!tabelaId) return null;
      const { data } = await supabase
        .from("atacado_tabelas_preco" as any)
        .select("nome, markup_padrao_pct")
        .eq("id", tabelaId)
        .single();
      return data as any;
    },
    enabled: open && !!tabelaId,
  });

  const { data: itens = [] } = useQuery({
    queryKey: ["tabela-itens", tabelaId],
    queryFn: async () => {
      if (!tabelaId) return [];
      const { data } = await supabase
        .from("atacado_tabelas_preco_itens" as any)
        .select("*")
        .eq("tabela_preco_id", tabelaId)
        .order("modelo");
      return (data as any[]) ?? [];
    },
    enabled: open && !!tabelaId,
  });

  const addItem = useMutation({
    mutationFn: async () => {
      if (!tabelaId || !novoModelo) throw new Error("Modelo obrigatório");
      const precoNum = parseFloat(novoPreco.replace(",", ".")) || 0;
      if (precoNum <= 0) throw new Error("Preço inválido");
      const { error } = await supabase
        .from("atacado_tabelas_preco_itens" as any)
        .insert({
          tabela_preco_id: tabelaId,
          modelo: novoModelo,
          capacidade: novaCapacidade || null,
          preco: precoNum,
          preco_minimo_qtd_5: preco5
            ? parseFloat(preco5.replace(",", "."))
            : null,
          preco_minimo_qtd_10: preco10
            ? parseFloat(preco10.replace(",", "."))
            : null,
        });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tabela-itens", tabelaId] });
      qc.invalidateQueries({ queryKey: ["atacado-tabelas-preco-full"] });
      toast({ title: "✓ Item adicionado" });
      setNovoModelo("");
      setNovaCapacidade("");
      setNovoPreco("");
      setPreco5("");
      setPreco10("");
    },
    onError: (e: any) =>
      toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  const removeItem = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("atacado_tabelas_preco_itens" as any)
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tabela-itens", tabelaId] });
      qc.invalidateQueries({ queryKey: ["atacado-tabelas-preco-full"] });
      toast({ title: "✓ Item removido" });
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Itens da {tabela?.nome ?? "tabela"}</DialogTitle>
        </DialogHeader>

        {/* Form pra adicionar */}
        <div className="border rounded-lg p-4 bg-muted/30 space-y-3">
          <p className="text-sm font-medium">Adicionar novo item</p>
          <div className="grid grid-cols-1 sm:grid-cols-5 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Modelo</Label>
              <Select value={novoModelo} onValueChange={setNovoModelo}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione…" />
                </SelectTrigger>
                <SelectContent>
                  {MODELOS.map((m) => (
                    <SelectItem key={m} value={m}>
                      {m}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Capacidade</Label>
              <Select value={novaCapacidade} onValueChange={setNovaCapacidade}>
                <SelectTrigger>
                  <SelectValue placeholder="—" />
                </SelectTrigger>
                <SelectContent>
                  {CAPACIDADES.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Preço (1-4 un)</Label>
              <Input
                inputMode="decimal"
                value={novoPreco}
                onChange={(e) => setNovoPreco(e.target.value)}
                placeholder="0,00"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">5+ un</Label>
              <Input
                inputMode="decimal"
                value={preco5}
                onChange={(e) => setPreco5(e.target.value)}
                placeholder="opcional"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">10+ un</Label>
              <Input
                inputMode="decimal"
                value={preco10}
                onChange={(e) => setPreco10(e.target.value)}
                placeholder="opcional"
              />
            </div>
          </div>
          <Button
            onClick={() => addItem.mutate()}
            size="sm"
            disabled={addItem.isPending}
          >
            {addItem.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Plus className="h-4 w-4" />
            )}
            Adicionar item
          </Button>
        </div>

        {/* Lista de itens */}
        <div className="space-y-2">
          <p className="text-sm font-medium">Itens cadastrados ({itens.length})</p>
          {itens.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">
              Nenhum item ainda. Adicione acima.
            </p>
          ) : (
            <div className="border rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-xs text-muted-foreground">
                  <tr>
                    <th className="text-left px-3 py-2 font-medium">Modelo</th>
                    <th className="text-left px-3 py-2 font-medium">Cap.</th>
                    <th className="text-right px-3 py-2 font-medium">Preço normal</th>
                    <th className="text-right px-3 py-2 font-medium">5+ un</th>
                    <th className="text-right px-3 py-2 font-medium">10+ un</th>
                    <th className="w-10"></th>
                  </tr>
                </thead>
                <tbody>
                  {itens.map((it: any) => (
                    <tr key={it.id} className="border-b last:border-0">
                      <td className="px-3 py-2">{it.modelo}</td>
                      <td className="px-3 py-2 text-muted-foreground">
                        {it.capacidade ?? "—"}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums font-medium">
                        {formatBRL(Number(it.preco))}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">
                        {it.preco_minimo_qtd_5 ? (
                          formatBRL(Number(it.preco_minimo_qtd_5))
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">
                        {it.preco_minimo_qtd_10 ? (
                          formatBRL(Number(it.preco_minimo_qtd_10))
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="px-2 py-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => removeItem.mutate(it.id)}
                          disabled={removeItem.isPending}
                        >
                          <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Fechar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
