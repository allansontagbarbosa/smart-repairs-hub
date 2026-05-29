import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useEmpresa } from "@/contexts/EmpresaContext";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import { Loader2, Target } from "lucide-react";
import { formatBRL } from "@/lib/utils";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  ano: number;
  mes: number;
}

const MESES = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];

type Tipo = "faturamento" | "lucro" | "vendas_qtd" | "ticket_medio";

const TIPOS: { v: Tipo; l: string }[] = [
  { v: "faturamento", l: "💰 Faturamento" },
  { v: "lucro", l: "📈 Lucro líquido" },
  { v: "vendas_qtd", l: "🛒 Qtd de vendas" },
  { v: "ticket_medio", l: "🎫 Ticket médio" },
];

export function DefinirMetaDialog({ open, onOpenChange, ano, mes }: Props) {
  const { empresaId } = useEmpresa();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [salvando, setSalvando] = useState(false);

  const [form, setForm] = useState({
    tipo: "faturamento" as Tipo,
    valor_meta: "",
    bonus_atingir: "",
    super_bonus_acima: "",
    super_bonus_pct: 110,
  });

  const { data: metaExistente } = useQuery({
    queryKey: ["loja-meta-edit", empresaId, ano, mes, form.tipo],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("loja_metas")
        .select("*")
        .eq("empresa_id", empresaId)
        .eq("competencia_ano", ano)
        .eq("competencia_mes", mes)
        .eq("tipo", form.tipo)
        .is("funcionario_id", null)
        .maybeSingle();
      return data;
    },
    enabled: open && !!empresaId,
  });

  useEffect(() => {
    if (metaExistente) {
      setForm((f) => ({
        ...f,
        valor_meta: String(metaExistente.valor_meta ?? ""),
        bonus_atingir: metaExistente.bonus_atingir ? String(metaExistente.bonus_atingir) : "",
        super_bonus_acima: metaExistente.super_bonus_acima ? String(metaExistente.super_bonus_acima) : "",
        super_bonus_pct: metaExistente.super_bonus_pct ?? 110,
      }));
    } else {
      setForm((f) => ({ ...f, valor_meta: "", bonus_atingir: "", super_bonus_acima: "" }));
    }
  }, [metaExistente]);

  const valorNum = parseFloat(form.valor_meta.replace(",", ".")) || 0;
  const bonusNum = parseFloat(form.bonus_atingir.replace(",", ".")) || 0;
  const superNum = parseFloat(form.super_bonus_acima.replace(",", ".")) || 0;
  const isMonetario = form.tipo !== "vendas_qtd";

  const labelTipo = {
    faturamento: "Faturamento (R$)",
    lucro: "Lucro líquido (R$)",
    vendas_qtd: "Quantidade de vendas",
    ticket_medio: "Ticket médio (R$)",
  }[form.tipo];

  const handleSalvar = async () => {
    if (valorNum <= 0) {
      toast({ title: "Valor da meta inválido", description: "Informe o valor da meta.", variant: "destructive" });
      return;
    }

    setSalvando(true);
    try {
      const payload: any = {
        empresa_id: empresaId,
        competencia_ano: ano,
        competencia_mes: mes,
        tipo: form.tipo,
        valor_meta: valorNum,
        bonus_atingir: bonusNum,
        super_bonus_acima: superNum,
        super_bonus_pct: form.super_bonus_pct,
        fechada: false,
      };

      let error;
      if (metaExistente) {
        ({ error } = await (supabase as any).from("loja_metas").update(payload).eq("id", metaExistente.id));
      } else {
        ({ error } = await (supabase as any).from("loja_metas").insert(payload));
      }
      if (error) throw error;

      toast({
        title: metaExistente ? "✓ Meta atualizada" : "✓ Meta definida",
        description: `Meta de ${MESES[mes - 1]} ${ano}: ${isMonetario ? formatBRL(valorNum) : valorNum}.`,
      });

      qc.invalidateQueries({ queryKey: ["loja-meta-atual"] });
      qc.invalidateQueries({ queryKey: ["loja-historico-metas"] });
      qc.invalidateQueries({ queryKey: ["loja-meta-edit"] });

      onOpenChange(false);
    } catch (err: any) {
      toast({ title: "Erro ao salvar meta", description: err.message ?? "Tente novamente.", variant: "destructive" });
    } finally {
      setSalvando(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Target className="h-5 w-5 text-primary" />
            {metaExistente ? "Editar meta" : "Definir meta"} — {MESES[mes - 1]} {ano}
          </DialogTitle>
          <DialogDescription>
            Quando atingir 100%, libera bônus pros vendedores. Acima de {form.super_bonus_pct}% libera super bônus.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-2">
          <div>
            <Label>Tipo da meta</Label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-1">
              {TIPOS.map((opt) => (
                <button
                  key={opt.v}
                  type="button"
                  onClick={() => setForm({ ...form, tipo: opt.v })}
                  className={`p-2.5 rounded-md border text-sm font-medium transition-all ${
                    form.tipo === opt.v
                      ? "bg-primary/10 border-primary text-primary"
                      : "border-border text-muted-foreground hover:border-primary/50"
                  }`}
                >
                  {opt.l}
                </button>
              ))}
            </div>
          </div>

          <div>
            <Label>{labelTipo} *</Label>
            <Input
              inputMode="decimal"
              placeholder={isMonetario ? "150000,00" : "100"}
              value={form.valor_meta}
              onChange={(e) => setForm({ ...form, valor_meta: e.target.value })}
            />
            {valorNum > 0 && isMonetario && (
              <p className="text-xs text-muted-foreground mt-1">= {formatBRL(valorNum)}</p>
            )}
          </div>

          <section className="space-y-3 rounded-md border bg-muted/20 p-4">
            <h3 className="text-sm font-semibold">Bonificações (opcional)</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label>Bônus por vendedor ao atingir 100%</Label>
                <Input
                  inputMode="decimal"
                  placeholder="500,00"
                  value={form.bonus_atingir}
                  onChange={(e) => setForm({ ...form, bonus_atingir: e.target.value })}
                />
                <p className="text-xs text-muted-foreground mt-1">R$ extra pra cada vendedor</p>
              </div>
              <div>
                <Label>Super bônus acima de {form.super_bonus_pct}%</Label>
                <Input
                  inputMode="decimal"
                  placeholder="800,00"
                  value={form.super_bonus_acima}
                  onChange={(e) => setForm({ ...form, super_bonus_acima: e.target.value })}
                />
                <p className="text-xs text-muted-foreground mt-1">R$ extra além do bônus normal</p>
              </div>
              <div className="sm:col-span-2">
                <Label>Limiar do super bônus (% acima da meta)</Label>
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    min={100}
                    max={200}
                    value={form.super_bonus_pct}
                    onChange={(e) => setForm({ ...form, super_bonus_pct: parseInt(e.target.value) || 110 })}
                    className="w-24"
                  />
                  <span className="text-xs text-muted-foreground">% (default 110%)</span>
                </div>
              </div>
            </div>
          </section>

          {valorNum > 0 && (bonusNum > 0 || superNum > 0) && (
            <div className="rounded-md border border-primary/30 bg-primary/5 p-4 space-y-1 text-sm">
              <p className="font-semibold text-primary mb-1">📋 Como vai funcionar:</p>
              {bonusNum > 0 && (
                <p>
                  • Ao bater 100% ({isMonetario ? formatBRL(valorNum) : valorNum}) → cada vendedor ganha{" "}
                  <strong>{formatBRL(bonusNum)}</strong>
                </p>
              )}
              {superNum > 0 && (
                <p>
                  • Ao passar de {form.super_bonus_pct}% (
                  {isMonetario
                    ? formatBRL((valorNum * form.super_bonus_pct) / 100)
                    : Math.round((valorNum * form.super_bonus_pct) / 100)}
                  ) → adiciona <strong>{formatBRL(superNum)}</strong> de super bônus
                </p>
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
              <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Salvando...</>
            ) : metaExistente ? (
              "✓ Atualizar meta"
            ) : (
              "✓ Salvar meta"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
