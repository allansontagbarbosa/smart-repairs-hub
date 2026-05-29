import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useEmpresa } from "@/contexts/EmpresaContext";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { formatBRL } from "@/lib/utils";
import { Loader2, Smartphone } from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSaved?: (id: string) => void;
}

const MODELOS_COMUNS = [
  "iPhone 11", "iPhone 11 Pro", "iPhone 11 Pro Max",
  "iPhone 12 mini", "iPhone 12", "iPhone 12 Pro", "iPhone 12 Pro Max",
  "iPhone 13 mini", "iPhone 13", "iPhone 13 Pro", "iPhone 13 Pro Max",
  "iPhone 14", "iPhone 14 Plus", "iPhone 14 Pro", "iPhone 14 Pro Max",
  "iPhone 15", "iPhone 15 Plus", "iPhone 15 Pro", "iPhone 15 Pro Max",
  "iPhone 16", "iPhone 16 Plus", "iPhone 16 Pro", "iPhone 16 Pro Max",
  "iPhone XR", "iPhone XS", "iPhone XS Max", "iPhone SE",
  "Samsung Galaxy S23", "Samsung Galaxy S24", "Samsung Galaxy A54",
  "Xiaomi Redmi Note 13", "Motorola Edge 50",
];

const CAPACIDADES = ["64GB", "128GB", "256GB", "512GB", "1TB"];
const CORES = ["Preto", "Branco", "Azul", "Verde", "Roxo", "Rosa", "Vermelho", "Coral", "Estelar", "Grafite", "Prata", "Dourado", "Titânio Natural", "Titânio Azul", "Titânio Branco", "Titânio Preto"];

const CONDICOES = [
  { v: "novo", l: "Novo" },
  { v: "seminovo_a", l: "Seminovo A" },
  { v: "seminovo_b", l: "Seminovo B" },
  { v: "seminovo_c", l: "Seminovo C" },
  { v: "sucata", l: "Sucata" },
] as const;

export function NovoAparelhoDialog({ open, onOpenChange, onSaved }: Props) {
  const { empresaId } = useEmpresa();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [salvando, setSalvando] = useState(false);

  const [form, setForm] = useState({
    modelo: "",
    capacidade: "",
    cor: "",
    imei_1: "",
    imei_2: "",
    condicao: "novo" as (typeof CONDICOES)[number]["v"],
    avaria: "",
    custo: "",
    preco_venda: "",
    preco_promocional: "",
    garantia_loja_meses: 12,
    garantia_fabricante: true,
    observacoes: "",
  });

  const custoNum = parseFloat(form.custo.replace(",", ".")) || 0;
  const precoNum = parseFloat(form.preco_venda.replace(",", ".")) || 0;
  const margem = custoNum > 0 ? ((precoNum - custoNum) / custoNum) * 100 : 0;
  const margemAbs = precoNum - custoNum;

  const reset = () =>
    setForm({
      modelo: "", capacidade: "", cor: "", imei_1: "", imei_2: "",
      condicao: "novo", avaria: "", custo: "", preco_venda: "",
      preco_promocional: "", garantia_loja_meses: 12, garantia_fabricante: true, observacoes: "",
    });

  const handleSalvar = async () => {
    if (!form.modelo) {
      toast({ title: "Modelo obrigatório", description: "Informe o modelo do aparelho.", variant: "destructive" });
      return;
    }
    if (!form.imei_1 || form.imei_1.replace(/\D/g, "").length < 14) {
      toast({ title: "IMEI inválido", description: "Informe um IMEI válido (15 dígitos).", variant: "destructive" });
      return;
    }
    if (custoNum <= 0) {
      toast({ title: "Custo inválido", description: "Informe o custo do aparelho.", variant: "destructive" });
      return;
    }
    if (precoNum <= 0) {
      toast({ title: "Preço inválido", description: "Informe o preço de venda.", variant: "destructive" });
      return;
    }

    setSalvando(true);
    try {
      const { data, error } = await (supabase as any)
        .from("loja_aparelhos")
        .insert({
          empresa_id: empresaId,
          modelo: form.modelo,
          capacidade: form.capacidade || null,
          cor: form.cor || null,
          imei_1: form.imei_1.replace(/\D/g, ""),
          imei_2: form.imei_2 ? form.imei_2.replace(/\D/g, "") : null,
          condicao: form.condicao,
          avaria: form.avaria || null,
          custo: custoNum,
          preco_venda: precoNum,
          preco_promocional: form.preco_promocional ? parseFloat(form.preco_promocional.replace(",", ".")) : null,
          garantia_loja_meses: form.garantia_loja_meses,
          garantia_fabricante: form.garantia_fabricante,
          status: "estoque",
          origem: "compra",
          observacoes: form.observacoes || null,
        })
        .select()
        .single();

      if (error) throw error;

      toast({
        title: "✓ Aparelho cadastrado",
        description: `${form.modelo} ${form.capacidade ?? ""} adicionado ao estoque.`,
      });

      qc.invalidateQueries({ queryKey: ["loja-aparelhos"] });
      qc.invalidateQueries({ queryKey: ["loja-aparelhos-counts"] });
      qc.invalidateQueries({ queryKey: ["loja-aparelhos-pdv"] });

      reset();
      onOpenChange(false);
      if (onSaved && data?.id) onSaved(data.id);
    } catch (err: any) {
      toast({ title: "Erro ao cadastrar", description: err.message ?? "Tente novamente.", variant: "destructive" });
    } finally {
      setSalvando(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Smartphone className="h-5 w-5 text-primary" />
            Cadastrar aparelho no estoque
          </DialogTitle>
          <DialogDescription>
            Aparelho fica disponível pra venda no PDV automaticamente após salvar.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Modelo / capacidade / cor */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-1">
              <Label>Modelo *</Label>
              <Input
                list="modelos-comuns"
                placeholder="iPhone 13"
                value={form.modelo}
                onChange={(e) => setForm({ ...form, modelo: e.target.value })}
              />
              <datalist id="modelos-comuns">
                {MODELOS_COMUNS.map((m) => <option key={m} value={m} />)}
              </datalist>
            </div>
            <div>
              <Label>Capacidade</Label>
              <Select value={form.capacidade} onValueChange={(v) => setForm({ ...form, capacidade: v })}>
                <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                <SelectContent>
                  {CAPACIDADES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Cor</Label>
              <Select value={form.cor} onValueChange={(v) => setForm({ ...form, cor: v })}>
                <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                <SelectContent>
                  {CORES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* IMEIs */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label>IMEI 1 * (15 dígitos)</Label>
              <Input
                placeholder="356789012345678"
                maxLength={15}
                value={form.imei_1}
                onChange={(e) => setForm({ ...form, imei_1: e.target.value })}
              />
            </div>
            <div>
              <Label>IMEI 2 (opcional, dual SIM)</Label>
              <Input
                placeholder="356789012345679"
                maxLength={15}
                value={form.imei_2}
                onChange={(e) => setForm({ ...form, imei_2: e.target.value })}
              />
            </div>
          </div>

          {/* Condição */}
          <div>
            <Label>Condição *</Label>
            <div className="grid grid-cols-5 gap-2 mt-1">
              {CONDICOES.map((opt) => (
                <button
                  key={opt.v}
                  type="button"
                  onClick={() => setForm({ ...form, condicao: opt.v })}
                  className={`p-2 rounded-md border text-xs font-semibold transition-all ${
                    form.condicao === opt.v
                      ? "bg-primary/10 border-primary text-primary"
                      : "border-border text-muted-foreground hover:border-primary/50"
                  }`}
                >
                  {opt.l}
                </button>
              ))}
            </div>
          </div>

          {form.condicao !== "novo" && (
            <div>
              <Label>Avarias (se houver)</Label>
              <Input
                placeholder="Ex: risco na tela, marca de uso..."
                value={form.avaria}
                onChange={(e) => setForm({ ...form, avaria: e.target.value })}
              />
            </div>
          )}

          {/* Valores */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <Label>Custo (R$) *</Label>
              <Input
                inputMode="decimal"
                placeholder="3120,00"
                value={form.custo}
                onChange={(e) => setForm({ ...form, custo: e.target.value })}
              />
            </div>
            <div>
              <Label>Preço venda (R$) *</Label>
              <Input
                inputMode="decimal"
                placeholder="4290,00"
                value={form.preco_venda}
                onChange={(e) => setForm({ ...form, preco_venda: e.target.value })}
              />
            </div>
            <div>
              <Label>Promocional (R$)</Label>
              <Input
                inputMode="decimal"
                placeholder="opcional"
                value={form.preco_promocional}
                onChange={(e) => setForm({ ...form, preco_promocional: e.target.value })}
              />
            </div>
          </div>

          {/* Preview de margem */}
          {custoNum > 0 && precoNum > 0 && (
            <div
              className={`p-3 rounded-md border ${
                margem >= 25
                  ? "bg-success/10 border-success/30 text-success"
                  : margem >= 10
                  ? "bg-warning/10 border-warning/30 text-warning"
                  : "bg-destructive/10 border-destructive/30 text-destructive"
              }`}
            >
              <div className="flex items-center justify-between text-sm font-semibold">
                <span>Margem: {margem.toFixed(1)}%</span>
                <span>Lucro: {formatBRL(margemAbs)}</span>
              </div>
            </div>
          )}

          {/* Garantia */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label>Garantia da loja (meses)</Label>
              <Input
                type="number"
                min={0}
                max={36}
                value={form.garantia_loja_meses}
                onChange={(e) => setForm({ ...form, garantia_loja_meses: parseInt(e.target.value) || 0 })}
              />
            </div>
            <div className="flex items-end">
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.garantia_fabricante}
                  onChange={(e) => setForm({ ...form, garantia_fabricante: e.target.checked })}
                />
                Tem garantia de fábrica
              </label>
            </div>
          </div>

          <div>
            <Label>Observações</Label>
            <Textarea
              rows={2}
              placeholder="Opcional"
              value={form.observacoes}
              onChange={(e) => setForm({ ...form, observacoes: e.target.value })}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={salvando}>
            Cancelar
          </Button>
          <Button onClick={handleSalvar} disabled={salvando}>
            {salvando ? (
              <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Salvando...</>
            ) : (
              "✓ Salvar aparelho"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
