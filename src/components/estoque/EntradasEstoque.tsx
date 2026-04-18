import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Separator } from "@/components/ui/separator";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { CurrencyInput } from "@/components/smart-inputs/CurrencyInput";
import { PecaFormModal } from "@/components/pecas/PecaFormModal";
import { toast } from "sonner";
import { Plus, Loader2, CalendarIcon, Trash2, Eye, ShoppingCart, PackagePlus } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import type { EstoqueItem } from "@/hooks/useEstoque";

interface EntradaItem {
  estoque_item_id: string;
  nome: string;
  quantidade: number;
  custo_unitario: number;
  imei_serial?: string;
}

interface Props {
  itens: EstoqueItem[];
  preSelectedItemId?: string | null;
  onClearPreSelected?: () => void;
}

const fmtBRL = (v: number) =>
  `R$ ${Number(v || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export function EntradasEstoque({ itens, preSelectedItemId, onClearPreSelected }: Props) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [detailEntradaId, setDetailEntradaId] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const openWithPreSelected = preSelectedItemId != null;

  const { data: entradas = [], isLoading } = useQuery({
    queryKey: ["entradas_estoque"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("entradas_estoque")
        .select("*, entradas_estoque_itens ( id )")
        .order("data_compra", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: detailItens = [] } = useQuery({
    queryKey: ["entrada_detail", detailEntradaId],
    queryFn: async () => {
      if (!detailEntradaId) return [];
      const { data, error } = await supabase
        .from("entradas_estoque_itens")
        .select("*, estoque_itens:estoque_item_id ( nome_personalizado, sku, marcas:marca_id ( nome ), modelos:modelo_id ( nome ) )")
        .eq("entrada_id", detailEntradaId);
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!detailEntradaId,
  });

  const detailEntrada = entradas.find((e: any) => e.id === detailEntradaId);

  const fmtDate = (d: string) => {
    try { return new Date(d + "T12:00:00").toLocaleDateString("pt-BR"); } catch { return d; }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-muted-foreground">{entradas.length} compras registradas</p>
        <Button size="sm" onClick={() => setDialogOpen(true)}>
          <ShoppingCart className="h-4 w-4 mr-1.5" /> Nova Compra
        </Button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-10"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
      ) : entradas.length === 0 ? (
        <div className="text-center py-10 text-sm text-muted-foreground">Nenhuma compra registrada.</div>
      ) : (
        <div className="section-card">
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Data</th>
                  <th>Fornecedor</th>
                  <th className="hidden sm:table-cell">Nº Nota</th>
                  <th className="text-center">Itens</th>
                  <th className="text-right">Valor Total</th>
                  <th className="w-10"></th>
                </tr>
              </thead>
              <tbody>
                {entradas.map((e: any) => (
                  <tr key={e.id}>
                    <td className="text-sm">{fmtDate(e.data_compra)}</td>
                    <td className="text-sm">{e.fornecedor_nome || "—"}</td>
                    <td className="hidden sm:table-cell text-sm text-muted-foreground">{e.numero_nota || "—"}</td>
                    <td className="text-center">
                      <span className="text-xs bg-secondary px-2 py-0.5 rounded-full">
                        {e.entradas_estoque_itens?.length ?? 0}
                      </span>
                    </td>
                    <td className="text-right text-sm font-medium">{e.valor_total ? fmtBRL(e.valor_total) : "—"}</td>
                    <td>
                      <button onClick={() => setDetailEntradaId(e.id)} className="p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground">
                        <Eye className="h-3.5 w-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <NovaCompraDialog
        open={dialogOpen || openWithPreSelected}
        onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open && onClearPreSelected) onClearPreSelected();
        }}
        estoqueItens={itens}
        preSelectedItemId={preSelectedItemId ?? undefined}
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ["entradas_estoque"] });
          queryClient.invalidateQueries({ queryKey: ["estoque_itens"] });
        }}
      />

      <Sheet open={!!detailEntradaId} onOpenChange={(open) => { if (!open) setDetailEntradaId(null); }}>
        <SheetContent className="w-full sm:max-w-md overflow-y-auto">
          {detailEntrada && (
            <>
              <SheetHeader>
                <SheetTitle>Detalhes da Compra</SheetTitle>
              </SheetHeader>
              <div className="space-y-3 mt-4">
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div><span className="text-muted-foreground">Data:</span> <span className="font-medium">{fmtDate(detailEntrada.data_compra)}</span></div>
                  <div><span className="text-muted-foreground">Nota:</span> <span className="font-medium">{detailEntrada.numero_nota || "—"}</span></div>
                  <div className="col-span-2"><span className="text-muted-foreground">Fornecedor:</span> <span className="font-medium">{detailEntrada.fornecedor_nome || "—"}</span></div>
                  {detailEntrada.valor_total > 0 && (
                    <div className="col-span-2"><span className="text-muted-foreground">Valor Total:</span> <span className="font-medium">{fmtBRL(detailEntrada.valor_total)}</span></div>
                  )}
                  {detailEntrada.observacoes && (
                    <div className="col-span-2"><span className="text-muted-foreground">Obs:</span> <span className="text-sm">{detailEntrada.observacoes}</span></div>
                  )}
                </div>
                <Separator />
                <p className="text-xs font-semibold text-muted-foreground uppercase">Itens ({detailItens.length})</p>
                <div className="space-y-2">
                  {detailItens.map((item: any) => {
                    const ei = item.estoque_itens;
                    const nome = ei?.nome_personalizado || [ei?.marcas?.nome, ei?.modelos?.nome].filter(Boolean).join(" ") || "Item";
                    return (
                      <div key={item.id} className="flex items-center justify-between py-2 px-3 rounded-md bg-muted/30 text-sm">
                        <div>
                          <p className="font-medium">{nome}</p>
                          <p className="text-xs text-muted-foreground">{item.quantidade}× {fmtBRL(item.custo_unitario)}</p>
                        </div>
                        <span className="font-medium">{fmtBRL(item.quantidade * item.custo_unitario)}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}

/* ── Nova Compra Dialog ── */
function NovaCompraDialog({
  open, onOpenChange, estoqueItens, preSelectedItemId, onSuccess,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  estoqueItens: EstoqueItem[];
  preSelectedItemId?: string;
  onSuccess: () => void;
}) {
  const [fornecedorId, setFornecedorId] = useState<string>("");
  const [fornecedorNome, setFornecedorNome] = useState("");
  const [dataCompra, setDataCompra] = useState<Date>(new Date());
  const [numeroNota, setNumeroNota] = useState("");
  const [observacoes, setObservacoes] = useState("");
  const [linhas, setLinhas] = useState<EntradaItem[]>([]);
  const [selectedPecaId, setSelectedPecaId] = useState("");
  const [desconto, setDesconto] = useState<number>(0);
  const [frete, setFrete] = useState<number>(0);
  const [saving, setSaving] = useState(false);
  const [pecaModalOpen, setPecaModalOpen] = useState(false);
  const queryClient = useQueryClient();

  const { data: fornecedores = [] } = useQuery({
    queryKey: ["fornecedores-ativos"],
    queryFn: async () => {
      const { data } = await supabase.from("fornecedores").select("id, nome").eq("ativo", true).order("nome");
      return data ?? [];
    },
    enabled: open,
  });

  // Pre-select item
  useEffect(() => {
    if (open && preSelectedItemId && linhas.length === 0) {
      const item = estoqueItens.find((i) => i.id === preSelectedItemId);
      if (item) {
        const nome = item.nome_personalizado || [item.marcas?.nome, item.modelos?.nome].filter(Boolean).join(" ") || "Peça";
        setLinhas([{ estoque_item_id: item.id, nome, quantidade: 1, custo_unitario: Number(item.custo_unitario ?? 0) }]);
      }
    }
  }, [open, preSelectedItemId, estoqueItens, linhas.length]);

  const addItem = () => {
    if (!selectedPecaId) return;
    if (linhas.some((l) => l.estoque_item_id === selectedPecaId)) {
      toast.error("Peça já adicionada");
      return;
    }
    const item = estoqueItens.find((i) => i.id === selectedPecaId);
    if (!item) return;
    const nome = item.nome_personalizado || [item.marcas?.nome, item.modelos?.nome].filter(Boolean).join(" ") || "Peça";
    setLinhas([...linhas, { estoque_item_id: item.id, nome, quantidade: 1, custo_unitario: Number(item.custo_unitario ?? 0), imei_serial: "" }]);
    setSelectedPecaId("");
  };

  const removeItem = (idx: number) => setLinhas(linhas.filter((_, i) => i !== idx));

  const updateItem = (idx: number, field: keyof EntradaItem, value: any) => {
    setLinhas(linhas.map((l, i) => i === idx ? { ...l, [field]: value } : l));
  };

  const subtotal = linhas.reduce((s, l) => s + l.quantidade * l.custo_unitario, 0);
  const total = Math.max(0, subtotal - (desconto || 0) + (frete || 0));

  const handleSubmit = async () => {
    if (linhas.length === 0) { toast.error("Adicione pelo menos uma peça"); return; }
    setSaving(true);
    try {
      const fornNome = fornecedorId === "__outro"
        ? fornecedorNome
        : fornecedores.find((f) => f.id === fornecedorId)?.nome ?? fornecedorNome;

      const { data: entrada, error: e1 } = await supabase.from("entradas_estoque").insert({
        fornecedor_id: fornecedorId && fornecedorId !== "__outro" ? fornecedorId : null,
        fornecedor_nome: fornNome || null,
        data_compra: format(dataCompra, "yyyy-MM-dd"),
        numero_nota: numeroNota || null,
        valor_total: total,
        observacoes: observacoes || null,
      }).select("id").single();
      if (e1) throw e1;

      const { error: e2 } = await supabase.from("entradas_estoque_itens").insert(
        linhas.map((l) => ({
          entrada_id: entrada.id,
          estoque_item_id: l.estoque_item_id,
          quantidade: l.quantidade,
          custo_unitario: l.custo_unitario,
        }))
      );
      if (e2) throw e2;

      for (const l of linhas) {
        const item = estoqueItens.find((i) => i.id === l.estoque_item_id);
        if (item) {
          await supabase.from("estoque_itens").update({
            quantidade: item.quantidade + l.quantidade,
            custo_unitario: l.custo_unitario,
            ...(l.imei_serial ? { imei_serial: l.imei_serial } : {}),
          }).eq("id", l.estoque_item_id);
        }
      }

      if (total > 0) {
        await supabase.from("movimentacoes_financeiras").insert({
          tipo: "saida" as const,
          valor: total,
          descricao: `Compra peças${numeroNota ? ` NF ${numeroNota}` : ""}${fornNome ? ` - ${fornNome}` : ""}`,
          data: new Date().toISOString(),
        });
      }

      toast.success("Compra registrada com sucesso!");
      onSuccess();
      resetForm();
      onOpenChange(false);
    } catch (err) {
      console.error(err);
      toast.error("Erro ao registrar compra");
    } finally {
      setSaving(false);
    }
  };

  const resetForm = () => {
    setFornecedorId("");
    setFornecedorNome("");
    setDataCompra(new Date());
    setNumeroNota("");
    setObservacoes("");
    setLinhas([]);
    setSelectedPecaId("");
    setDesconto(0);
    setFrete(0);
  };

  return (
    <>
    <Dialog open={open} onOpenChange={(o) => { if (!o) resetForm(); onOpenChange(o); }}>
      <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShoppingCart className="h-5 w-5 text-primary" />
            Nova Compra
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 mt-2">
          {/* Header fields */}
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2 sm:col-span-1">
              <Label className="text-xs">Fornecedor</Label>
              <Select value={fornecedorId} onValueChange={(v) => { setFornecedorId(v); if (v !== "__outro") setFornecedorNome(""); }}>
                <SelectTrigger className="mt-1"><SelectValue placeholder="Selecione..." /></SelectTrigger>
                <SelectContent>
                  {fornecedores.map((f) => (<SelectItem key={f.id} value={f.id}>{f.nome}</SelectItem>))}
                  <SelectItem value="__outro">Outro (digitar)</SelectItem>
                </SelectContent>
              </Select>
              {fornecedorId === "__outro" && (
                <Input className="mt-1.5" placeholder="Nome do fornecedor" value={fornecedorNome} onChange={(e) => setFornecedorNome(e.target.value)} />
              )}
            </div>

            <div>
              <Label className="text-xs">Data da Compra</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn("w-full mt-1 justify-start text-left font-normal", !dataCompra && "text-muted-foreground")}>
                    <CalendarIcon className="h-4 w-4 mr-2" />
                    {dataCompra ? format(dataCompra, "dd/MM/yyyy") : "Selecione"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={dataCompra} onSelect={(d) => d && setDataCompra(d)} locale={ptBR} className="p-3 pointer-events-auto" />
                </PopoverContent>
              </Popover>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Nº Nota Fiscal</Label>
              <Input className="mt-1" placeholder="Opcional" value={numeroNota} onChange={(e) => setNumeroNota(e.target.value)} />
            </div>
            <div>
              <Label className="text-xs">Observações</Label>
              <Input className="mt-1" placeholder="Opcional" value={observacoes} onChange={(e) => setObservacoes(e.target.value)} />
            </div>
          </div>

          <Separator />

          {/* Items section */}
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Itens da Compra</p>
            <div className="flex gap-2">
              <Select value={selectedPecaId} onValueChange={setSelectedPecaId}>
                <SelectTrigger className="flex-1"><SelectValue placeholder="Buscar peça..." /></SelectTrigger>
                <SelectContent>
                  {estoqueItens.map((item) => {
                    const nome = item.nome_personalizado || [item.marcas?.nome, item.modelos?.nome].filter(Boolean).join(" ") || item.sku || "Peça";
                    return <SelectItem key={item.id} value={item.id}>{nome} (Qtd: {item.quantidade})</SelectItem>;
                  })}
                </SelectContent>
              </Select>
              <Button type="button" size="sm" variant="outline" onClick={addItem} disabled={!selectedPecaId}>
                Adicionar
              </Button>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button type="button" size="sm" variant="outline" onClick={() => setPecaModalOpen(true)}>
                      <PackagePlus className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Cadastrar nova peça</TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>

            {linhas.length > 0 && (
              <div className="mt-3 border rounded-md overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50">
                    <tr className="text-xs text-muted-foreground">
                      <th className="text-left py-2 px-3 font-medium">Peça</th>
                      <th className="text-left py-2 px-2 font-medium w-20">Qtd.</th>
                      <th className="text-left py-2 px-2 font-medium w-32">Custo unit. (R$)</th>
                      <th className="text-right py-2 px-3 font-medium w-28">Subtotal</th>
                      <th className="w-10"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {linhas.map((l, idx) => (
                      <tr key={idx} className="border-t">
                        <td className="py-2 px-3">
                          <p className="font-medium truncate">{l.nome}</p>
                        </td>
                        <td className="py-2 px-2">
                          <Input
                            type="number" min={1} className="h-8 text-center text-sm"
                            value={l.quantidade}
                            onChange={(e) => updateItem(idx, "quantidade", Math.max(1, parseInt(e.target.value) || 1))}
                          />
                        </td>
                        <td className="py-2 px-2">
                          <CurrencyInput
                            value={l.custo_unitario}
                            onValueChange={(v) => updateItem(idx, "custo_unitario", v)}
                            placeholder="0,00"
                            className="h-8 text-sm"
                          />
                        </td>
                        <td className="py-2 px-3 text-right text-sm font-medium tabular-nums">
                          {fmtBRL(l.quantidade * l.custo_unitario)}
                        </td>
                        <td className="py-2 px-2">
                          <button onClick={() => removeItem(idx)} className="p-1 text-muted-foreground hover:text-destructive">
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                {/* Totais */}
                <div className="border-t bg-muted/20 px-3 py-3 space-y-1.5">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Subtotal:</span>
                    <span className="font-medium tabular-nums">{fmtBRL(subtotal)}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm gap-3">
                    <span className="text-muted-foreground">Desconto:</span>
                    <div className="w-32">
                      <CurrencyInput
                        value={desconto}
                        onValueChange={setDesconto}
                        placeholder="0,00"
                        className="h-7 text-sm text-right"
                      />
                    </div>
                  </div>
                  <div className="flex items-center justify-between text-sm gap-3">
                    <span className="text-muted-foreground">Frete:</span>
                    <div className="w-32">
                      <CurrencyInput
                        value={frete}
                        onValueChange={setFrete}
                        placeholder="0,00"
                        className="h-7 text-sm text-right"
                      />
                    </div>
                  </div>
                  <Separator className="my-1.5" />
                  <div className="flex items-center justify-between text-base font-semibold">
                    <span>Total:</span>
                    <span className="tabular-nums">{fmtBRL(total)}</span>
                  </div>
                </div>
              </div>
            )}
          </div>

          <Button className="w-full" onClick={handleSubmit} disabled={saving || linhas.length === 0}>
            {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <ShoppingCart className="h-4 w-4 mr-2" />}
            Registrar Compra
          </Button>
        </div>
      </DialogContent>
    </Dialog>

    <PecaFormModal
      open={pecaModalOpen}
      onOpenChange={setPecaModalOpen}
      onSaved={() => {
        queryClient.invalidateQueries({ queryKey: ["estoque_itens"] });
        toast.success("Peça cadastrada! Agora selecione na lista para adicioná-la à compra.");
      }}
    />
    </>
  );
}
