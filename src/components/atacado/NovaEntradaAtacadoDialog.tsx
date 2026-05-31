import { useState } from "react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useEmpresa } from "@/contexts/EmpresaContext";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import { Package, Loader2 } from "lucide-react";
import { formatBRL } from "@/lib/utils";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
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
  "iPhone 13 Pro",
  "iPhone 13",
  "iPhone 12",
  "Samsung Galaxy S24",
  "Samsung Galaxy S23",
  "Xiaomi Redmi Note 13",
];
const CAPACIDADES = ["64GB", "128GB", "256GB", "512GB", "1TB"];

const INITIAL = {
  modelo: "",
  capacidade: "",
  cor: "",
  condicao: "novo",
  quantidade: "1",
  custo: "",
  preco_sugerido: "",
  fornecedor_id: "",
  nota_entrada: "",
  observacoes: "",
};

export function NovaEntradaAtacadoDialog({ open, onOpenChange }: Props) {
  const { empresaId } = useEmpresa();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [salvando, setSalvando] = useState(false);
  const [form, setForm] = useState({ ...INITIAL });

  const { data: fornecedores = [] } = useQuery({
    queryKey: ["fornecedores-atacado", empresaId],
    queryFn: async () => {
      const { data } = await supabase
        .from("fornecedores" as any)
        .select("id, nome")
        .eq("empresa_id", empresaId!);
      return (data as any[]) ?? [];
    },
    enabled: open && !!empresaId,
  });

  const custoNum = parseFloat(form.custo.replace(",", ".")) || 0;
  const precoNum = parseFloat(form.preco_sugerido.replace(",", ".")) || 0;
  const qtdNum = parseInt(form.quantidade) || 0;
  const margem = custoNum > 0 ? ((precoNum - custoNum) / custoNum) * 100 : 0;
  const investimento = custoNum * qtdNum;

  const handleSalvar = async () => {
    if (!form.modelo) {
      toast({ title: "Modelo obrigatório", variant: "destructive" });
      return;
    }
    if (qtdNum < 1) {
      toast({ title: "Quantidade mínima: 1", variant: "destructive" });
      return;
    }
    if (custoNum <= 0) {
      toast({ title: "Custo inválido", variant: "destructive" });
      return;
    }

    setSalvando(true);
    try {
      const { error } = await supabase.from("atacado_aparelhos" as any).insert({
        empresa_id: empresaId,
        modelo: form.modelo,
        capacidade: form.capacidade || null,
        cor: form.cor || null,
        condicao: form.condicao,
        quantidade: qtdNum,
        custo: custoNum,
        preco_sugerido: precoNum || null,
        fornecedor_id: form.fornecedor_id || null,
        nota_entrada: form.nota_entrada || null,
        observacoes: form.observacoes || null,
        status: "estoque",
      });
      if (error) throw error;

      toast({
        title: "✓ Lote cadastrado",
        description: `${qtdNum}x ${form.modelo} · Investimento ${formatBRL(investimento)}`,
      });
      qc.invalidateQueries({ queryKey: ["atacado-aparelhos"] });

      setForm({ ...INITIAL });
      onOpenChange(false);
    } catch (e: any) {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    } finally {
      setSalvando(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="h-5 w-5 text-primary" /> Nova entrada de lote
          </DialogTitle>
          <DialogDescription>Atacado trabalha com quantidade por SKU</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Modelo *</Label>
              <Select
                value={form.modelo}
                onValueChange={(v) => setForm({ ...form, modelo: v })}
              >
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

            <div className="space-y-2">
              <Label>Capacidade</Label>
              <Select
                value={form.capacidade}
                onValueChange={(v) => setForm({ ...form, capacidade: v })}
              >
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

            <div className="space-y-2">
              <Label>Cor</Label>
              <Input
                placeholder="Preto, Azul…"
                value={form.cor}
                onChange={(e) => setForm({ ...form, cor: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label>Condição</Label>
              <Select
                value={form.condicao}
                onValueChange={(v) => setForm({ ...form, condicao: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="novo">Novo</SelectItem>
                  <SelectItem value="seminovo_a">Seminovo A</SelectItem>
                  <SelectItem value="seminovo_b">Seminovo B</SelectItem>
                  <SelectItem value="sucata">Sucata</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Quantidade *</Label>
              <Input
                type="number"
                min={1}
                value={form.quantidade}
                onChange={(e) => setForm({ ...form, quantidade: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label>Custo unitário (R$) *</Label>
              <Input
                inputMode="decimal"
                placeholder="0,00"
                value={form.custo}
                onChange={(e) => setForm({ ...form, custo: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label>Preço sugerido atacado (R$)</Label>
              <Input
                inputMode="decimal"
                placeholder="0,00"
                value={form.preco_sugerido}
                onChange={(e) => setForm({ ...form, preco_sugerido: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label>Fornecedor</Label>
              <Select
                value={form.fornecedor_id}
                onValueChange={(v) => setForm({ ...form, fornecedor_id: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="—" />
                </SelectTrigger>
                <SelectContent>
                  {fornecedores.map((f: any) => (
                    <SelectItem key={f.id} value={f.id}>
                      {f.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2 sm:col-span-2">
              <Label>Nº nota fiscal de entrada</Label>
              <Input
                value={form.nota_entrada}
                onChange={(e) => setForm({ ...form, nota_entrada: e.target.value })}
              />
            </div>

            <div className="space-y-2 sm:col-span-2">
              <Label>Observações</Label>
              <Textarea
                rows={2}
                value={form.observacoes}
                onChange={(e) => setForm({ ...form, observacoes: e.target.value })}
              />
            </div>
          </div>

          {custoNum > 0 && qtdNum > 0 && (
            <div className="p-3 bg-primary/5 border border-primary/30 rounded-lg space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Investimento total</span>
                <strong className="tabular-nums">{formatBRL(investimento)}</strong>
              </div>
              {precoNum > 0 && (
                <>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Receita potencial</span>
                    <strong className="tabular-nums text-primary">
                      {formatBRL(precoNum * qtdNum)}
                    </strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Margem</span>
                    <strong className={margem >= 15 ? "text-success" : "text-warning"}>
                      {margem.toFixed(1)}%
                    </strong>
                  </div>
                </>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={salvando}>
            Cancelar
          </Button>
          <Button onClick={handleSalvar} disabled={salvando}>
            {salvando ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" /> Salvando
              </>
            ) : (
              "✓ Cadastrar lote"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
