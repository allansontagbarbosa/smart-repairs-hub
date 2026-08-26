import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useEmpresa } from "@/contexts/EmpresaContext";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import { formatBRL } from "@/lib/utils";
import { Loader2, Smartphone, Trash2, ExternalLink } from "lucide-react";
import { Link } from "react-router-dom";
import { ComboboxWithCreate } from "@/components/smart-inputs/ComboboxWithCreate";
import { useLojaCatalogo } from "@/hooks/useLojaCatalogo";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  aparelhoId?: string | null;
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

type Condicao = (typeof CONDICOES)[number]["v"];

function getEmptyForm() {
  return {
    modelo: "",
    capacidade: "",
    cor: "",
    imei_1: "",
    imei_2: "",
    condicao: "novo" as Condicao,
    avaria: "",
    custo: "",
    preco_venda: "",
    preco_promocional: "",
    garantia_loja_meses: 12,
    garantia_fabricante: true,
    observacoes: "",
  };
}

export function AparelhoDialog({ open, onOpenChange, aparelhoId, onSaved }: Props) {
  const { empresaId } = useEmpresa();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [salvando, setSalvando] = useState(false);
  const [excluindo, setExcluindo] = useState(false);

  const isEdicao = !!aparelhoId;

  const { data: aparelho, isLoading } = useQuery({
    queryKey: ["aparelho-edit", aparelhoId],
    queryFn: async () => {
      if (!aparelhoId) return null;
      const { data, error } = await (supabase as any)
        .from("loja_aparelhos")
        .select("*, loja_vendas(numero_venda)")
        .eq("id", aparelhoId)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: open && !!aparelhoId,
  });

  const [form, setForm] = useState(getEmptyForm());

  useEffect(() => {
    if (!open) return;
    if (aparelho) {
      setForm({
        modelo: aparelho.modelo ?? "",
        capacidade: aparelho.capacidade ?? "",
        cor: aparelho.cor ?? "",
        imei_1: aparelho.imei_1 ?? "",
        imei_2: aparelho.imei_2 ?? "",
        condicao: (aparelho.condicao ?? "novo") as Condicao,
        avaria: aparelho.avaria ?? "",
        custo: aparelho.custo != null ? String(aparelho.custo) : "",
        preco_venda: aparelho.preco_venda != null ? String(aparelho.preco_venda) : "",
        preco_promocional: aparelho.preco_promocional ? String(aparelho.preco_promocional) : "",
        garantia_loja_meses: aparelho.garantia_loja_meses ?? 12,
        garantia_fabricante: aparelho.garantia_fabricante ?? true,
        observacoes: aparelho.observacoes ?? "",
      });
    } else if (!isEdicao) {
      setForm(getEmptyForm());
    }
  }, [aparelho, isEdicao, open]);

  const custoNum = parseFloat(String(form.custo).replace(",", ".")) || 0;
  const precoNum = parseFloat(String(form.preco_venda).replace(",", ".")) || 0;
  const margem = custoNum > 0 ? ((precoNum - custoNum) / custoNum) * 100 : 0;
  const margemAbs = precoNum - custoNum;

  const jaVendido = aparelho?.status === "vendido";
  const readonly = jaVendido;

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
      const payload: any = {
        modelo: form.modelo,
        capacidade: form.capacidade || null,
        cor: form.cor || null,
        imei_1: form.imei_1.replace(/\D/g, ""),
        imei_2: form.imei_2 ? form.imei_2.replace(/\D/g, "") : null,
        condicao: form.condicao,
        avaria: form.avaria || null,
        custo: custoNum,
        preco_venda: precoNum,
        preco_promocional: form.preco_promocional
          ? parseFloat(String(form.preco_promocional).replace(",", "."))
          : null,
        garantia_loja_meses: form.garantia_loja_meses,
        garantia_fabricante: form.garantia_fabricante,
        observacoes: form.observacoes || null,
      };

      let result: any;
      if (isEdicao) {
        result = await (supabase as any)
          .from("loja_aparelhos")
          .update(payload)
          .eq("id", aparelhoId!)
          .select()
          .single();
      } else {
        result = await (supabase as any)
          .from("loja_aparelhos")
          .insert({ ...payload, empresa_id: empresaId, status: "estoque", origem: "compra" })
          .select()
          .single();
      }

      if (result.error) throw result.error;

      toast({ title: isEdicao ? "✓ Aparelho atualizado" : "✓ Aparelho cadastrado" });
      qc.invalidateQueries({ queryKey: ["loja-aparelhos"] });
      qc.invalidateQueries({ queryKey: ["loja-aparelhos-counts"] });
      qc.invalidateQueries({ queryKey: ["loja-aparelhos-pdv"] });
      qc.invalidateQueries({ queryKey: ["aparelho-edit"] });

      onOpenChange(false);
      if (onSaved && result.data?.id) onSaved(result.data.id);
    } catch (err: any) {
      toast({ title: "Erro ao salvar", description: err.message ?? "Tente novamente.", variant: "destructive" });
    } finally {
      setSalvando(false);
    }
  };

  const handleExcluir = async () => {
    if (!aparelhoId) return;
    setExcluindo(true);
    try {
      const { error } = await (supabase as any)
        .from("loja_aparelhos")
        .update({ deleted_at: new Date().toISOString() })
        .eq("id", aparelhoId);
      if (error) throw error;

      toast({ title: "✓ Aparelho removido", description: "O aparelho foi removido do estoque." });
      qc.invalidateQueries({ queryKey: ["loja-aparelhos"] });
      qc.invalidateQueries({ queryKey: ["loja-aparelhos-counts"] });
      qc.invalidateQueries({ queryKey: ["loja-aparelhos-pdv"] });
      onOpenChange(false);
    } catch (err: any) {
      toast({ title: "Erro ao excluir", description: err.message ?? "Tente novamente.", variant: "destructive" });
    } finally {
      setExcluindo(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 flex-wrap">
            <Smartphone className="h-5 w-5 text-primary" />
            {isEdicao ? `Editar aparelho${aparelho?.modelo ? ` · ${aparelho.modelo}` : ""}` : "Cadastrar aparelho no estoque"}
            {jaVendido && <Badge variant="secondary">Vendido</Badge>}
          </DialogTitle>
          <DialogDescription>
            {jaVendido
              ? "Aparelho já vendido — modo somente leitura."
              : isEdicao
              ? "Atualize os dados ou exclua o aparelho do estoque."
              : "Aparelho fica disponível pra venda no PDV automaticamente após salvar."}
          </DialogDescription>
        </DialogHeader>

        {isLoading && isEdicao ? (
          <div className="py-16 flex items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            {jaVendido && aparelho?.loja_vendas && (
              <div className="rounded-md border bg-muted/40 p-3 flex items-center justify-between text-sm">
                <span>
                  Vendido na venda{" "}
                  <span className="font-semibold">
                    #V-{String(aparelho.loja_vendas.numero_venda).padStart(6, "0")}
                  </span>
                </span>
                <Link to="/loja/vendas" className="text-primary hover:underline flex items-center gap-1 text-xs">
                  Ver venda <ExternalLink className="h-3 w-3" />
                </Link>
              </div>
            )}

            <fieldset disabled={readonly} className="space-y-4 py-2 disabled:opacity-80">
              {/* Marca / modelo / capacidade / cor */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <ComboboxWithCreate
                  label="Marca"
                  entityName="marca"
                  placeholder="Selecione a marca..."
                  items={marcas}
                  value={marcaId}
                  onChange={(id) => { setMarcaId(id); setForm((f) => ({ ...f, modelo: "" })); }}
                  onCreate={criarMarca}
                  disabled={readonly}
                />
                <ComboboxWithCreate
                  label="Modelo *"
                  entityName="modelo"
                  placeholder={marcaId ? "Selecione o modelo..." : "Escolha a marca primeiro"}
                  items={modelosFiltrados}
                  value={modelosFiltrados.find((m) => m.nome === form.modelo)?.id ?? ""}
                  onChange={(_id, nome) => setForm((f) => ({ ...f, modelo: nome }))}
                  onCreate={marcaId ? (nome) => criarModelo(nome, marcaId) : undefined}
                  disabled={readonly || !marcaId}
                  disabledReason={!marcaId ? "Selecione uma marca antes de cadastrar o modelo" : undefined}
                />
                <ComboboxWithCreate
                  label="Capacidade"
                  entityName="capacidade"
                  placeholder="Selecione..."
                  items={capacidades}
                  value={capacidades.find((c) => c.nome === form.capacidade)?.id ?? ""}
                  onChange={(_id, nome) => setForm((f) => ({ ...f, capacidade: nome }))}
                  onCreate={criarCapacidade}
                  disabled={readonly}
                />
                <ComboboxWithCreate
                  label="Cor"
                  entityName="cor"
                  placeholder="Selecione..."
                  items={cores}
                  value={cores.find((c) => c.nome === form.cor)?.id ?? ""}
                  onChange={(_id, nome) => setForm((f) => ({ ...f, cor: nome }))}
                  onCreate={criarCor}
                  disabled={readonly}
                />
              </div>
              {!readonly && (
                <p className="text-xs text-muted-foreground -mt-2">
                  Não achou? digite o nome no campo e use “Cadastrar …”. Para gerenciar as listas, acesse{" "}
                  <Link to="/loja/configuracoes" className="text-primary hover:underline">
                    Configurações → Catálogo de aparelhos
                  </Link>
                  .
                </p>
              )}


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
                      disabled={readonly}
                      onClick={() => setForm({ ...form, condicao: opt.v })}
                      className={`p-2 rounded-md border text-xs font-semibold transition-all disabled:opacity-60 disabled:cursor-not-allowed ${
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
                      disabled={readonly}
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
            </fieldset>

            <DialogFooter className="flex-col-reverse sm:flex-row sm:justify-between gap-2">
              <div>
                {isEdicao && !jaVendido && (
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="destructive" size="sm" disabled={salvando || excluindo}>
                        <Trash2 className="h-4 w-4 mr-2" /> Excluir
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Excluir aparelho do estoque?</AlertDialogTitle>
                        <AlertDialogDescription>
                          O aparelho <strong>{aparelho?.modelo} {aparelho?.capacidade}</strong> (IMEI {aparelho?.imei_1}) será removido do estoque.
                          Essa ação é reversível pelo banco, mas o aparelho não aparece mais em listas nem no PDV.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={handleExcluir}
                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                          {excluindo ? (
                            <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Excluindo...</>
                          ) : (
                            "Confirmar exclusão"
                          )}
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                )}
              </div>

              <div className="flex gap-2 justify-end">
                <Button variant="outline" onClick={() => onOpenChange(false)} disabled={salvando}>
                  {readonly ? "Fechar" : "Cancelar"}
                </Button>
                {!readonly && (
                  <Button onClick={handleSalvar} disabled={salvando}>
                    {salvando ? (
                      <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Salvando...</>
                    ) : (
                      isEdicao ? "✓ Atualizar" : "✓ Salvar aparelho"
                    )}
                  </Button>
                )}
              </div>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
