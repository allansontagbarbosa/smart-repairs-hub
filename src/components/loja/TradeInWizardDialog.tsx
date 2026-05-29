import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
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
import { Loader2, ArrowLeftRight, ArrowLeft, ArrowRight, CheckCircle2, AlertCircle } from "lucide-react";
import { CHECKLIST, calcularAvaliacao } from "@/lib/trade-in-pricing";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

const MODELOS = [
  "iPhone 16 Pro Max", "iPhone 16 Pro", "iPhone 16 Plus", "iPhone 16",
  "iPhone 15 Pro Max", "iPhone 15 Pro", "iPhone 15 Plus", "iPhone 15",
  "iPhone 14 Pro Max", "iPhone 14 Pro", "iPhone 14 Plus", "iPhone 14",
  "iPhone 13 Pro Max", "iPhone 13 Pro", "iPhone 13 mini", "iPhone 13",
  "iPhone 12 Pro Max", "iPhone 12 Pro", "iPhone 12 mini", "iPhone 12",
  "iPhone 11 Pro Max", "iPhone 11 Pro", "iPhone 11",
  "iPhone XS Max", "iPhone XS", "iPhone XR", "iPhone SE",
  "Samsung Galaxy S24", "Samsung Galaxy S23", "Samsung Galaxy A54",
];
const CAPACIDADES = ["64GB", "128GB", "256GB", "512GB", "1TB"];
const CORES = ["Preto", "Branco", "Azul", "Verde", "Roxo", "Rosa", "Vermelho", "Coral", "Estelar", "Grafite", "Prata"];

type Condicao = "novo" | "usado_a" | "usado_b" | "usado_c" | "sucata";
type FormaPagamento = "abater_venda" | "dinheiro" | "pix" | "credito_loja";

export function TradeInWizardDialog({ open, onOpenChange }: Props) {
  const { empresaId } = useEmpresa();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [salvando, setSalvando] = useState(false);
  const [passo, setPasso] = useState(1);

  const [form, setForm] = useState({
    modelo: "",
    capacidade: "",
    cor: "",
    imei_1: "",
    imei_2: "",
    condicao: "usado_a" as Condicao,
    checks_falhos: [] as string[],
    forma_pagamento: "abater_venda" as FormaPagamento,
    valor_avaliado_manual: null as number | null,
    observacoes: "",
  });

  const reset = () => {
    setPasso(1);
    setForm({
      modelo: "", capacidade: "", cor: "", imei_1: "", imei_2: "",
      condicao: "usado_a", checks_falhos: [],
      forma_pagamento: "abater_venda", valor_avaliado_manual: null, observacoes: "",
    });
  };

  const avaliacao = calcularAvaliacao(form.modelo, form.capacidade, form.condicao, form.checks_falhos);
  const valorFinal = form.valor_avaliado_manual ?? avaliacao.valor_final;

  const toggleCheck = (id: string) => {
    setForm((f) => ({
      ...f,
      checks_falhos: f.checks_falhos.includes(id)
        ? f.checks_falhos.filter((c) => c !== id)
        : [...f.checks_falhos, id],
    }));
  };

  const podeAvancar = () => {
    if (passo === 1) return !!form.modelo && form.imei_1.replace(/\D/g, "").length >= 14;
    if (passo === 2) return !!form.condicao;
    return true;
  };

  const handleFinalizar = async () => {
    setSalvando(true);
    try {
      const checklistJSON = CHECKLIST.reduce((acc, c) => {
        acc[c.id] = { label: c.label, ok: !form.checks_falhos.includes(c.id) };
        return acc;
      }, {} as Record<string, { label: string; ok: boolean }>);

      const { error } = await (supabase as any)
        .from("loja_trade_in")
        .insert({
          empresa_id: empresaId,
          modelo: form.modelo,
          capacidade: form.capacidade || null,
          cor: form.cor || null,
          imei_1: form.imei_1.replace(/\D/g, ""),
          imei_2: form.imei_2 ? form.imei_2.replace(/\D/g, "") : null,
          condicao: form.condicao,
          checklist: checklistJSON,
          valor_sugerido: avaliacao.valor_apos_condicao,
          descontos_aplicados: avaliacao.descontos_aplicados,
          valor_avaliado: valorFinal,
          forma_pagamento: form.forma_pagamento,
          status: "avaliacao",
          observacoes: form.observacoes || null,
        });

      if (error) throw error;

      toast({
        title: "✓ Trade-in registrado",
        description: `${form.modelo} avaliado em ${formatBRL(valorFinal)}. Status: aguardando aprovação.`,
      });

      qc.invalidateQueries({ queryKey: ["loja-trade-in"] });
      reset();
      onOpenChange(false);
    } catch (err: any) {
      toast({ title: "Erro ao salvar", description: err.message, variant: "destructive" });
    } finally {
      setSalvando(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) reset(); onOpenChange(v); }}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ArrowLeftRight className="h-5 w-5 text-primary" />
            Novo trade-in · Passo {passo} de 4
          </DialogTitle>
        </DialogHeader>

        {/* Stepper */}
        <div className="flex items-center justify-between mt-2 mb-4">
          {[
            { n: 1, label: "Aparelho" },
            { n: 2, label: "Condição" },
            { n: 3, label: "Checklist" },
            { n: 4, label: "Avaliação" },
          ].map((p, i) => (
            <div key={p.n} className="flex items-center flex-1">
              <div className="flex flex-col items-center gap-1">
                <div className={`h-8 w-8 rounded-full flex items-center justify-center text-xs font-semibold ${
                  passo > p.n ? "bg-primary text-primary-foreground"
                  : passo === p.n ? "bg-primary/15 text-primary border-2 border-primary"
                  : "bg-muted text-muted-foreground"
                }`}>
                  {passo > p.n ? <CheckCircle2 className="h-4 w-4" /> : p.n}
                </div>
                <span className="text-[10px] text-muted-foreground">{p.label}</span>
              </div>
              {i < 3 && <div className={`h-0.5 flex-1 mx-2 ${passo > p.n ? "bg-primary" : "bg-muted"}`} />}
            </div>
          ))}
        </div>

        <div className="space-y-4 min-h-[300px]">
          {passo === 1 && (
            <div className="space-y-4">
              <h3 className="font-semibold text-sm">Identificação do aparelho</h3>
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2 space-y-1.5">
                  <Label>Modelo *</Label>
                  <Select value={form.modelo} onValueChange={(v) => setForm({ ...form, modelo: v })}>
                    <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent>
                      {MODELOS.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Capacidade</Label>
                  <Select value={form.capacidade} onValueChange={(v) => setForm({ ...form, capacidade: v })}>
                    <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                    <SelectContent>
                      {CAPACIDADES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Cor</Label>
                  <Select value={form.cor} onValueChange={(v) => setForm({ ...form, cor: v })}>
                    <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                    <SelectContent>
                      {CORES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>IMEI 1 *</Label>
                  <Input value={form.imei_1} onChange={(e) => setForm({ ...form, imei_1: e.target.value })} placeholder="15 dígitos" />
                </div>
                <div className="space-y-1.5">
                  <Label>IMEI 2 (dual SIM)</Label>
                  <Input value={form.imei_2} onChange={(e) => setForm({ ...form, imei_2: e.target.value })} />
                </div>
              </div>
            </div>
          )}

          {passo === 2 && (
            <div className="space-y-4">
              <h3 className="font-semibold text-sm">Condição visual do aparelho</h3>
              <div className="grid grid-cols-5 gap-2">
                {([
                  { v: "novo", l: "Novo", desc: "Lacrado" },
                  { v: "usado_a", l: "Usado A", desc: "Como novo" },
                  { v: "usado_b", l: "Usado B", desc: "Pequenos riscos" },
                  { v: "usado_c", l: "Usado C", desc: "Marcas evidentes" },
                  { v: "sucata", l: "Sucata", desc: "Não liga / quebrado" },
                ] as const).map((opt) => (
                  <button
                    key={opt.v}
                    type="button"
                    onClick={() => setForm({ ...form, condicao: opt.v })}
                    className={`p-3 rounded-lg border text-sm font-semibold transition-all flex flex-col items-center text-center ${
                      form.condicao === opt.v ? "bg-primary/10 border-primary text-primary"
                      : "border-border text-muted-foreground hover:border-primary/50"
                    }`}
                  >
                    <span>{opt.l}</span>
                    <span className="text-[10px] font-normal mt-1">{opt.desc}</span>
                  </button>
                ))}
              </div>

              {form.modelo && (
                <div className="rounded-lg border border-primary/30 bg-primary/5 p-4 text-center">
                  <p className="text-xs text-muted-foreground">Valor de tabela pra esta condição</p>
                  <p className="text-2xl font-bold text-primary mt-1">{formatBRL(avaliacao.valor_apos_condicao)}</p>
                  <p className="text-xs text-muted-foreground mt-1">Base: {formatBRL(avaliacao.valor_base)}</p>
                </div>
              )}
            </div>
          )}

          {passo === 3 && (
            <div className="space-y-3">
              <h3 className="font-semibold text-sm">Checklist técnico</h3>
              <p className="text-xs text-muted-foreground">
                Marque os itens que NÃO passam no teste. Cada falha desconta uma % do valor.
              </p>
              <div className="space-y-2">
                {CHECKLIST.map((c) => {
                  const ativo = form.checks_falhos.includes(c.id);
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => toggleCheck(c.id)}
                      className={`w-full p-3 rounded-md border text-left text-sm flex items-center gap-3 transition-all ${
                        ativo ? "bg-destructive/10 border-destructive text-destructive"
                        : "border-border hover:border-primary/50"
                      }`}
                    >
                      <div className={`h-5 w-5 rounded border flex items-center justify-center shrink-0 ${ativo ? "bg-destructive border-destructive" : "border-muted-foreground/40"}`}>
                        {ativo && <AlertCircle className="h-3 w-3 text-destructive-foreground" />}
                      </div>
                      <span className="flex-1">{c.label}</span>
                      <span className="text-xs font-semibold">−{c.desconto_pct}%</span>
                    </button>
                  );
                })}
              </div>

              {form.checks_falhos.length > 0 && (
                <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 flex items-center justify-between">
                  <span className="text-sm flex items-center gap-2 text-destructive">
                    <AlertCircle className="h-4 w-4" />
                    {form.checks_falhos.length} item{form.checks_falhos.length > 1 ? "s" : ""} com problema
                  </span>
                  <span className="text-sm font-semibold text-destructive">
                    Desconto total: {formatBRL(avaliacao.valor_descontos_total)}
                  </span>
                </div>
              )}
            </div>
          )}

          {passo === 4 && (
            <div className="space-y-4">
              <h3 className="font-semibold text-sm">Avaliação final</h3>

              <div className="rounded-lg border border-border bg-muted/30 p-4 space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Valor base ({form.modelo} {form.capacidade})</span>
                  <span>{formatBRL(avaliacao.valor_base)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Após condição ({form.condicao})</span>
                  <span>{formatBRL(avaliacao.valor_apos_condicao)}</span>
                </div>
                {avaliacao.descontos_aplicados.length > 0 && (
                  <>
                    <p className="text-xs uppercase text-muted-foreground pt-2">Descontos do checklist:</p>
                    {avaliacao.descontos_aplicados.map((d) => (
                      <div key={d.id} className="flex justify-between text-destructive text-xs">
                        <span>− {d.label}</span>
                        <span>−{formatBRL(d.valor)}</span>
                      </div>
                    ))}
                  </>
                )}
                <div className="flex justify-between border-t border-border pt-2 mt-2">
                  <span className="font-semibold">Valor sugerido</span>
                  <span className="font-bold text-primary">{formatBRL(avaliacao.valor_final)}</span>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label>Valor avaliado (ajuste manual)</Label>
                <Input
                  type="text"
                  placeholder={formatBRL(avaliacao.valor_final)}
                  value={form.valor_avaliado_manual ?? ""}
                  onChange={(e) => setForm({ ...form, valor_avaliado_manual: e.target.value ? parseFloat(e.target.value.replace(",", ".")) : null })}
                />
                <p className="text-[11px] text-muted-foreground">Deixe vazio pra usar o valor sugerido.</p>
              </div>

              <div className="space-y-1.5">
                <Label>Forma de pagamento ao cliente</Label>
                <div className="grid grid-cols-4 gap-2">
                  {([
                    { v: "abater_venda", l: "Abater venda" },
                    { v: "dinheiro", l: "💵 Dinheiro" },
                    { v: "pix", l: "⚡ Pix" },
                    { v: "credito_loja", l: "🎟 Crédito" },
                  ] as const).map((opt) => (
                    <button
                      key={opt.v}
                      type="button"
                      onClick={() => setForm({ ...form, forma_pagamento: opt.v })}
                      className={`p-2 rounded-md border text-xs font-semibold transition-all ${
                        form.forma_pagamento === opt.v ? "bg-primary/10 border-primary text-primary"
                        : "border-border text-muted-foreground hover:border-primary/40"
                      }`}
                    >
                      {opt.l}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-1.5">
                <Label>Observações</Label>
                <Textarea
                  rows={2}
                  value={form.observacoes}
                  onChange={(e) => setForm({ ...form, observacoes: e.target.value })}
                  placeholder="Cliente trouxe sem caixa, tem 1 ano de uso..."
                />
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between border-t pt-4">
          <Button variant="ghost" onClick={() => setPasso(Math.max(1, passo - 1))} disabled={passo === 1 || salvando}>
            <ArrowLeft className="h-4 w-4 mr-1" /> Voltar
          </Button>

          <div className="text-xs text-muted-foreground">
            {passo === 4 && `Valor: ${formatBRL(valorFinal)}`}
          </div>

          {passo < 4 ? (
            <Button onClick={() => setPasso(passo + 1)} disabled={!podeAvancar()}>
              Avançar <ArrowRight className="h-4 w-4 ml-1" />
            </Button>
          ) : (
            <Button onClick={handleFinalizar} disabled={salvando}>
              {salvando ? <><Loader2 className="h-4 w-4 mr-1 animate-spin" /> Registrando...</> : "✓ Registrar trade-in"}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
