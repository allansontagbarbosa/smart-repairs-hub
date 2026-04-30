import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScannableInput } from "@/components/ui/scannable-input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { CurrencyInput } from "@/components/smart-inputs/CurrencyInput";
import { toast } from "sonner";
import { Plus, ChevronDown, ChevronRight, Info } from "lucide-react";
import type { EstoqueItem } from "@/hooks/useEstoque";

type Categoria = { id: string; nome: string };
type Marca = { id: string; nome: string };
type Modelo = { id: string; nome: string; marca_id: string };

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editingItem: EstoqueItem | null;
  categorias: Categoria[];
  marcas: Marca[];
  modelos: Modelo[];
}

type FormValues = {
  categoria_id: string;
  marca_id: string;
  modelo_id: string;
  nome_personalizado: string;
  cor: string;
  capacidade: string;
  imei_serial: string;
  sku: string;
  codigo_barras: string;
  quantidade_minima: string;
  local_estoque: string;
  fornecedor: string;
  observacoes: string;
};

const emptyForm: FormValues = {
  categoria_id: "", marca_id: "", modelo_id: "",
  nome_personalizado: "", cor: "", capacidade: "", imei_serial: "", sku: "", codigo_barras: "",
  quantidade_minima: "0",
  local_estoque: "", fornecedor: "", observacoes: "",
};

const fmtBRL = (v: number) =>
  v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function NovoItemDialog({ open, onOpenChange, editingItem, categorias, marcas, modelos }: Props) {
  const queryClient = useQueryClient();
  const isEditing = !!editingItem;
  const [newCatName, setNewCatName] = useState("");
  const [newMarcaName, setNewMarcaName] = useState("");
  const [newModeloName, setNewModeloName] = useState("");
  const [showNewCat, setShowNewCat] = useState(false);
  const [showNewMarca, setShowNewMarca] = useState(false);
  const [showNewModelo, setShowNewModelo] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Estoque inicial (somente ao CRIAR)
  const [estoqueInicialAberto, setEstoqueInicialAberto] = useState(false);
  const [qtdInicial, setQtdInicial] = useState<string>("");
  const [custoInicial, setCustoInicial] = useState<number>(0);

  const { register, handleSubmit, reset, setValue, watch } = useForm<FormValues>({ defaultValues: emptyForm });

  const selectedMarca = watch("marca_id");
  const filteredModelos = modelos.filter(m => m.marca_id === selectedMarca);

  useEffect(() => {
    if (open && editingItem) {
      reset({
        categoria_id: editingItem.categoria_id ?? "",
        marca_id: editingItem.marca_id ?? "",
        modelo_id: editingItem.modelo_id ?? "",
        nome_personalizado: editingItem.nome_personalizado ?? "",
        cor: editingItem.cor ?? "",
        capacidade: editingItem.capacidade ?? "",
        imei_serial: editingItem.imei_serial ?? "",
        sku: editingItem.sku ?? "",
        codigo_barras: (editingItem as any).codigo_barras ?? "",
        quantidade_minima: String(editingItem.quantidade_minima),
        local_estoque: editingItem.local_estoque ?? "",
        fornecedor: editingItem.fornecedor ?? "",
        observacoes: editingItem.observacoes ?? "",
      });
      if (editingItem.cor || editingItem.capacidade || editingItem.imei_serial) {
        setShowAdvanced(true);
      }
      setEstoqueInicialAberto(false);
      setQtdInicial("");
      setCustoInicial(0);
    } else if (open) {
      reset(emptyForm);
      setShowAdvanced(false);
      setEstoqueInicialAberto(false);
      setQtdInicial("");
      setCustoInicial(0);
    }
  }, [open, editingItem, reset]);

  const addCategoria = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.from("estoque_categorias").insert({ nome: newCatName }).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["estoque_categorias"] });
      setValue("categoria_id", data.id);
      setNewCatName("");
      setShowNewCat(false);
      toast.success("Categoria criada!");
    },
  });

  const addMarca = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.from("marcas").insert({ nome: newMarcaName }).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["marcas"] });
      setValue("marca_id", data.id);
      setNewMarcaName("");
      setShowNewMarca(false);
      toast.success("Marca criada!");
    },
  });

  const addModelo = useMutation({
    mutationFn: async () => {
      if (!selectedMarca) throw new Error("Selecione uma marca primeiro");
      const { data, error } = await supabase.from("modelos").insert({ nome: newModeloName, marca_id: selectedMarca }).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["modelos"] });
      setValue("modelo_id", data.id);
      setNewModeloName("");
      setShowNewModelo(false);
      toast.success("Modelo criado!");
    },
  });

  const mutation = useMutation({
    mutationFn: async (values: FormValues) => {
      // Validação do estoque inicial — só na criação
      let usarEstoqueInicial = false;
      let qtdInicialNum = 0;
      if (!isEditing && estoqueInicialAberto) {
        qtdInicialNum = parseInt(qtdInicial) || 0;
        const algumPreenchido = qtdInicialNum > 0 || custoInicial > 0;
        if (algumPreenchido) {
          if (qtdInicialNum > 0 && custoInicial <= 0) {
            throw new Error("Informe o custo unitário do estoque inicial.");
          }
          if (qtdInicialNum <= 0 && custoInicial > 0) {
            throw new Error("Informe a quantidade ou deixe os dois campos em branco.");
          }
          usarEstoqueInicial = true;
        }
      }

      const payload: any = {
        tipo_item: "peca" as const,
        categoria_id: values.categoria_id || null,
        marca_id: values.marca_id || null,
        modelo_id: values.modelo_id || null,
        nome_personalizado: values.nome_personalizado || null,
        cor: values.cor || null,
        capacidade: values.capacidade || null,
        imei_serial: values.imei_serial || null,
        sku: values.sku?.trim() || null,
        codigo_barras: values.codigo_barras?.trim() || null,
        quantidade_minima: parseInt(values.quantidade_minima) || 0,
        local_estoque: values.local_estoque || null,
        fornecedor: values.fornecedor || null,
        observacoes: values.observacoes || null,
      };

      if (isEditing) {
        // Edição NÃO mexe em quantidade, custo_unitario nem custo_medio.
        const { data, error } = await supabase
          .from("estoque_itens")
          .update(payload)
          .eq("id", editingItem.id)
          .select("id, sku")
          .single();
        if (error) throw error;
        return { data, usouEstoqueInicial: false, qtdInicialNum: 0, custoInicialNum: 0 };
      }

      // Criação: insere zerada (custo_medio e quantidade tratados pelo recalcular_custo_medio se houver inicial)
      payload.quantidade = 0;
      payload.custo_unitario = 0;
      const { data: created, error } = await supabase
        .from("estoque_itens")
        .insert(payload)
        .select("id, sku, empresa_id")
        .single();
      if (error) throw error;

      if (usarEstoqueInicial) {
        const { error: rpcErr } = await supabase.rpc("recalcular_custo_medio", {
          p_peca_id: created.id,
          p_quantidade_entrada: qtdInicialNum,
          p_preco_compra_unitario: custoInicial,
          p_origem: "ajuste_inicial",
          p_origem_id: null,
        });
        if (rpcErr) throw rpcErr;
      }

      return {
        data: created,
        usouEstoqueInicial: usarEstoqueInicial,
        qtdInicialNum,
        custoInicialNum: custoInicial,
      };
    },
    onSuccess: ({ data, usouEstoqueInicial, qtdInicialNum, custoInicialNum }) => {
      queryClient.invalidateQueries({ queryKey: ["estoque_itens"] });
      const skuMsg = data?.sku ? ` (SKU: ${data.sku})` : "";
      if (isEditing) {
        toast.success("Peça atualizada!" + skuMsg);
      } else if (usouEstoqueInicial) {
        toast.success(
          `Peça criada com ${qtdInicialNum} unidade${qtdInicialNum > 1 ? "s" : ""} em estoque a custo médio de R$ ${fmtBRL(custoInicialNum)}.`,
        );
      } else {
        toast.success("Peça criada." + skuMsg);
      }
      onOpenChange(false);
    },
    onError: (e: any) => {
      const msg = e.message || "";
      if (msg.includes("já está em uso") || msg.includes("duplicate") || msg.includes("unique")) {
        toast.error("Este SKU já está em uso. Use outro ou deixe vazio para gerar automaticamente.");
      } else {
        toast.error(msg);
      }
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Editar Peça" : "Nova Peça no Estoque"}</DialogTitle>
          <DialogDescription className="text-xs flex items-start gap-1.5 text-muted-foreground pt-1">
            <Info className="h-3.5 w-3.5 mt-0.5 shrink-0" />
            <span>
              O custo desta peça é calculado pelas compras (média ponderada). Peças entram como custo interno da OS — o cliente paga pelo serviço, que já engloba a peça.
            </span>
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(v => mutation.mutate(v))} className="space-y-3">
          {/* Nome da peça */}
          <div>
            <Label className="text-xs">Nome da peça *</Label>
            <Input {...register("nome_personalizado")} placeholder="Ex: Tela iPhone 14 Pro Max" className="h-9 mt-1" autoFocus />
          </div>

          {/* Categoria */}
          <div>
            <div className="flex items-center justify-between">
              <Label className="text-xs">Categoria</Label>
              <button type="button" className="text-[10px] text-primary font-medium hover:underline" onClick={() => setShowNewCat(!showNewCat)}>
                <Plus className="h-3 w-3 inline" /> Nova
              </button>
            </div>
            {showNewCat ? (
              <div className="flex gap-2 mt-1">
                <Input value={newCatName} onChange={e => setNewCatName(e.target.value)} placeholder="Nome da categoria" className="h-8 text-sm" />
                <Button type="button" size="sm" className="h-8" onClick={() => addCategoria.mutate()} disabled={!newCatName}>Criar</Button>
              </div>
            ) : (
              <Select value={watch("categoria_id")} onValueChange={v => setValue("categoria_id", v)}>
                <SelectTrigger className="h-9 mt-1"><SelectValue placeholder="Selecionar categoria" /></SelectTrigger>
                <SelectContent>
                  {categorias.map(c => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}
                </SelectContent>
              </Select>
            )}
          </div>

          {/* Marca compatível */}
          <div>
            <div className="flex items-center justify-between">
              <Label className="text-xs">Marca compatível</Label>
              <button type="button" className="text-[10px] text-primary font-medium hover:underline" onClick={() => setShowNewMarca(!showNewMarca)}>
                <Plus className="h-3 w-3 inline" /> Nova
              </button>
            </div>
            {showNewMarca ? (
              <div className="flex gap-2 mt-1">
                <Input value={newMarcaName} onChange={e => setNewMarcaName(e.target.value)} placeholder="Nome da marca" className="h-8 text-sm" />
                <Button type="button" size="sm" className="h-8" onClick={() => addMarca.mutate()} disabled={!newMarcaName}>Criar</Button>
              </div>
            ) : (
              <Select value={watch("marca_id")} onValueChange={v => { setValue("marca_id", v); setValue("modelo_id", ""); }}>
                <SelectTrigger className="h-9 mt-1"><SelectValue placeholder="Selecionar marca" /></SelectTrigger>
                <SelectContent>
                  {marcas.map(m => <SelectItem key={m.id} value={m.id}>{m.nome}</SelectItem>)}
                </SelectContent>
              </Select>
            )}
          </div>

          {/* Modelo compatível */}
          {selectedMarca && (
            <div>
              <div className="flex items-center justify-between">
                <Label className="text-xs">Modelo compatível</Label>
                <button type="button" className="text-[10px] text-primary font-medium hover:underline" onClick={() => setShowNewModelo(!showNewModelo)}>
                  <Plus className="h-3 w-3 inline" /> Novo
                </button>
              </div>
              {showNewModelo ? (
                <div className="flex gap-2 mt-1">
                  <Input value={newModeloName} onChange={e => setNewModeloName(e.target.value)} placeholder="Nome do modelo" className="h-8 text-sm" />
                  <Button type="button" size="sm" className="h-8" onClick={() => addModelo.mutate()} disabled={!newModeloName}>Criar</Button>
                </div>
              ) : (
                <Select value={watch("modelo_id")} onValueChange={v => setValue("modelo_id", v)}>
                  <SelectTrigger className="h-9 mt-1"><SelectValue placeholder="Selecionar modelo" /></SelectTrigger>
                  <SelectContent>
                    {filteredModelos.map(m => <SelectItem key={m.id} value={m.id}>{m.nome}</SelectItem>)}
                  </SelectContent>
                </Select>
              )}
            </div>
          )}

          {/* Estoque mínimo */}
          <div>
            <Label className="text-xs">Estoque mínimo</Label>
            <Input type="number" {...register("quantidade_minima")} className="h-9 mt-1" />
          </div>

          {/* SKU + Código de barras + Local */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <Label className="text-xs">SKU</Label>
              <ScannableInput {...register("sku")} scannerTitle="Escanear SKU" placeholder="Auto" className="h-9 mt-1" />
            </div>
            <div>
              <Label className="text-xs">Código de barras</Label>
              <ScannableInput {...register("codigo_barras")} scannerTitle="Escanear código de barras" placeholder="Opcional" className="h-9 mt-1" />
            </div>
            <div><Label className="text-xs">Fornecedor</Label><Input {...register("fornecedor")} placeholder="Nome" className="h-9 mt-1" /></div>
          </div>
          <div>
            <Label className="text-xs">Local</Label>
            <Input {...register("local_estoque")} placeholder="Prateleira A" className="h-9 mt-1" />
          </div>

          {/* Toggle advanced fields */}
          <button
            type="button"
            className="text-xs text-primary hover:underline"
            onClick={() => setShowAdvanced(!showAdvanced)}
          >
            {showAdvanced ? "▾ Menos campos" : "▸ Mais campos (cor, capacidade, serial)"}
          </button>

          {showAdvanced && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div><Label className="text-xs">Cor</Label><Input {...register("cor")} placeholder="Preto" className="h-9 mt-1" /></div>
                <div><Label className="text-xs">Capacidade</Label><Input {...register("capacidade")} placeholder="128GB" className="h-9 mt-1" /></div>
              </div>
              <div>
                <Label className="text-xs">IMEI / Serial</Label>
                <ScannableInput {...register("imei_serial")} scannerTitle="Escanear IMEI / Serial" placeholder="Opcional" className="h-9 mt-1" />
              </div>
            </>
          )}

          <div>
            <Label className="text-xs">Observações</Label>
            <Textarea {...register("observacoes")} rows={2} className="mt-1" placeholder="Informações adicionais sobre a peça" />
          </div>

          {/* Estoque inicial — somente ao criar */}
          {!isEditing && (
            <Collapsible open={estoqueInicialAberto} onOpenChange={setEstoqueInicialAberto}>
              <CollapsibleTrigger asChild>
                <button
                  type="button"
                  className="w-full flex items-center justify-between rounded-md border border-dashed border-border px-3 py-2 text-sm text-muted-foreground hover:bg-muted/40 transition-colors"
                >
                  <span className="flex items-center gap-1.5">
                    {estoqueInicialAberto ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                    Já tenho esta peça em estoque?
                  </span>
                  <span className="text-[10px]">Opcional</span>
                </button>
              </CollapsibleTrigger>
              <CollapsibleContent className="pt-3">
                <div className="rounded-md border border-border bg-muted/30 p-3 space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label className="text-xs">Quantidade que já tem hoje</Label>
                      <Input
                        type="number"
                        min={0}
                        value={qtdInicial}
                        onChange={(e) => setQtdInicial(e.target.value)}
                        placeholder="0"
                        className="h-9 mt-1 bg-background"
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Custo unitário (R$)</Label>
                      <CurrencyInput
                        value={custoInicial}
                        onValueChange={setCustoInicial}
                        placeholder="0,00"
                        className="h-9 mt-1 bg-background"
                      />
                    </div>
                  </div>
                  <p className="text-[11px] text-muted-foreground flex items-start gap-1.5">
                    <Info className="h-3 w-3 mt-0.5 shrink-0" />
                    <span>
                      Esses valores são usados só uma vez para inicializar o estoque. Daqui pra frente, o estoque é gerenciado pelas compras.
                    </span>
                  </p>
                </div>
              </CollapsibleContent>
            </Collapsible>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? "Salvando..." : isEditing ? "Salvar" : "Adicionar Peça"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
