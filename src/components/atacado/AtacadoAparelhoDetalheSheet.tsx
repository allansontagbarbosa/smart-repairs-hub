import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEmpresa } from "@/contexts/EmpresaContext";
import { useToast } from "@/hooks/use-toast";
import { usePermissoesAtacado } from "@/hooks/usePermissoesAtacado";
import { formatBRL } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Loader2, Trash2, Copy, Check, Printer } from "lucide-react";
import { AtacadoStatusBadge } from "./AtacadoStatusBadge";
import { printEtiquetaAtacado } from "@/lib/printEtiquetaAtacado";

interface Props {
  aparelhoId: string | null;
  onOpenChange: (v: boolean) => void;
  statusCatalogo: Array<{ nome: string; categoria: string | null }>;
}

function CopyBtn({ value, label }: { value: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  if (!value) return null;
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        navigator.clipboard.writeText(value);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}
      className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground transition-colors"
      aria-label={label ?? "Copiar"}
    >
      {copied ? <Check className="h-3.5 w-3.5 text-success" /> : <Copy className="h-3.5 w-3.5" />}
    </button>
  );
}

function daysBetween(iso?: string | null): number | null {
  if (!iso) return null;
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
}

export function AtacadoAparelhoDetalheSheet({
  aparelhoId,
  onOpenChange,
  statusCatalogo,
}: Props) {
  const { empresaId } = useEmpresa();
  const { toast } = useToast();
  const qc = useQueryClient();
  const perms = usePermissoesAtacado();
  const [novoStatus, setNovoStatus] = useState<string>("");
  const [confirmDelete, setConfirmDelete] = useState(false);

  const { data: aparelho, isLoading } = useQuery({
    queryKey: ["atacado-aparelho-detalhe", aparelhoId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("atacado_aparelhos" as any)
        .select("*, fornecedor:fornecedores(nome)")
        .eq("id", aparelhoId!)
        .eq("empresa_id", empresaId!)
        .maybeSingle();
      if (error) throw error;
      return data as any;
    },
    enabled: !!aparelhoId && !!empresaId,
  });

  const { data: assistencias = [] } = useQuery({
    queryKey: ["atacado-aparelho-assistencias", aparelhoId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("atacado_aparelho_assistencias" as any)
        .select("tipo_nome, valor")
        .eq("aparelho_id", aparelhoId!)
        .eq("empresa_id", empresaId!);
      if (error) throw error;
      return (data as any[]) ?? [];
    },
    enabled: !!aparelhoId && !!empresaId,
  });

  const { data: invoice } = useQuery({
    queryKey: ["atacado-aparelho-invoice", aparelho?.invoice_id],
    queryFn: async () => {
      const { data } = await supabase
        .from("atacado_invoices" as any)
        .select("numero, pais_origem, moeda, cotacao, data_compra, importado")
        .eq("id", aparelho!.invoice_id)
        .eq("empresa_id", empresaId!)
        .maybeSingle();
      return data as any;
    },
    enabled: !!aparelho?.invoice_id && !!empresaId,
  });

  useEffect(() => {
    if (aparelho?.status) setNovoStatus(aparelho.status);
  }, [aparelho?.status]);

  const mudarStatus = useMutation({
    mutationFn: async (status: string) => {
      const { error } = await supabase
        .from("atacado_aparelhos" as any)
        .update({ status })
        .eq("id", aparelhoId!)
        .eq("empresa_id", empresaId!);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["atacado-aparelhos"] });
      qc.invalidateQueries({ queryKey: ["atacado-aparelho-detalhe", aparelhoId] });
      toast({ title: "✓ Status atualizado" });
    },
    onError: (e: any) =>
      toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  const excluir = useMutation({
    mutationFn: async () => {
      const { count } = await supabase
        .from("atacado_pedidos_itens" as any)
        .select("id", { count: "exact", head: true })
        .eq("aparelho_id", aparelhoId!);
      const { error } = await supabase
        .from("atacado_aparelhos" as any)
        .update({ deleted_at: new Date().toISOString() })
        .eq("id", aparelhoId!)
        .eq("empresa_id", empresaId!);
      if (error) throw error;
      return { semHistorico: (count ?? 0) === 0 };
    },
    onSuccess: ({ semHistorico }) => {
      qc.invalidateQueries({ queryKey: ["atacado-aparelhos"] });
      toast({
        title: semHistorico
          ? "✓ Aparelho excluído"
          : "✓ Aparelho desativado (mantém histórico)",
      });
      onOpenChange(false);
    },
    onError: (e: any) =>
      toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  const totalAssistencia = assistencias.reduce(
    (s: number, a: any) => s + Number(a.valor ?? 0),
    0,
  );
  const diasEstoque = daysBetween(aparelho?.data_entrada) ?? 0;
  const diasCompra = daysBetween(invoice?.data_compra ?? aparelho?.data_entrada) ?? 0;
  const custoTotal = Number(aparelho?.custo ?? 0);
  const custoBase = Math.max(0, custoTotal - totalAssistencia);
  const precoNum = Number(aparelho?.preco_sugerido ?? 0);
  const lucro = precoNum > 0 ? precoNum - custoTotal : 0;
  const markup = custoTotal > 0 && precoNum > 0 ? ((precoNum - custoTotal) / custoTotal) * 100 : 0;
  const margem = precoNum > 0 ? ((precoNum - custoTotal) / precoNum) * 100 : 0;
  const lento = diasEstoque > 30;

  return (
    <>
      <Dialog open={!!aparelhoId} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Detalhes do aparelho</DialogTitle>
            <DialogDescription>
              Visualizar, alterar status ou remover do estoque.
            </DialogDescription>
          </DialogHeader>

          {isLoading || !aparelho ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="space-y-5">
              <div>
                <p className="text-lg font-semibold text-foreground">
                  {aparelho.modelo} {aparelho.capacidade ?? ""} {aparelho.cor ?? ""}
                </p>
                <div className="mt-1 flex items-center gap-2 flex-wrap text-xs text-muted-foreground">
                  {aparelho.marca && <span>{aparelho.marca}</span>}
                  {aparelho.grade && <span>· Grade {aparelho.grade}</span>}
                  {aparelho.condicao && <span>· {aparelho.condicao}</span>}
                </div>
                <div className="mt-2 flex items-center gap-2 flex-wrap">
                  <AtacadoStatusBadge status={aparelho.status} catalogo={statusCatalogo} />
                  {aparelho.updated_at && (
                    <span className="text-xs text-muted-foreground">
                      atualizado em{" "}
                      {new Date(aparelho.updated_at).toLocaleDateString("pt-BR")}
                    </span>
                  )}
                </div>
              </div>

              {/* Contadores de dias */}
              <div className="grid grid-cols-2 gap-3">
                <div
                  className={`rounded-lg border p-3 ${
                    lento ? "border-destructive/30 bg-destructive/5" : "bg-muted/30"
                  }`}
                >
                  <p className="text-xs text-muted-foreground">Dias em estoque</p>
                  <p
                    className={`text-lg font-semibold tabular-nums ${
                      lento ? "text-destructive" : "text-foreground"
                    }`}
                  >
                    {diasEstoque}d
                  </p>
                  {lento && (
                    <p className="text-[10px] text-destructive">parado há muito tempo</p>
                  )}
                </div>
                <div className="rounded-lg border p-3 bg-muted/30">
                  <p className="text-xs text-muted-foreground">Dias desde a compra</p>
                  <p className="text-lg font-semibold tabular-nums text-foreground">
                    {diasCompra}d
                  </p>
                </div>
              </div>

              <Separator />

              {/* IMEIs com copiar */}
              <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground">IMEI</p>
                {aparelho.imei_1 && (
                  <div className="flex items-center justify-between bg-muted/40 rounded-md px-3 py-2">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-muted-foreground">IMEI 1</span>
                      <span className="font-mono text-sm">{aparelho.imei_1}</span>
                    </div>
                    <CopyBtn value={aparelho.imei_1} label="Copiar IMEI 1" />
                  </div>
                )}
                {aparelho.imei_2 && (
                  <div className="flex items-center justify-between bg-muted/40 rounded-md px-3 py-2">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-muted-foreground">IMEI 2</span>
                      <span className="font-mono text-sm">{aparelho.imei_2}</span>
                    </div>
                    <CopyBtn value={aparelho.imei_2} label="Copiar IMEI 2" />
                  </div>
                )}
                {!aparelho.imei_1 && !aparelho.imei_2 && (
                  <p className="text-sm text-muted-foreground">—</p>
                )}
              </div>

              <Separator />

              {/* Quebra de custo */}
              <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground">Quebra de custo</p>
                <div className="space-y-1.5 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Custo do aparelho</span>
                    <span className="tabular-nums">{formatBRL(custoBase)}</span>
                  </div>
                  {totalAssistencia > 0 && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">+ Assistência</span>
                      <span className="tabular-nums text-warning">
                        {formatBRL(totalAssistencia)}
                      </span>
                    </div>
                  )}
                  <Separator />
                  <div className="flex justify-between font-medium">
                    <span>Custo total</span>
                    <span className="tabular-nums">{formatBRL(custoTotal)}</span>
                  </div>
                </div>

                {assistencias.length > 0 && (
                  <div className="pt-1 flex flex-wrap gap-1.5">
                    {assistencias.map((a: any, i: number) => (
                      <Badge key={i} variant="secondary" className="text-xs">
                        {a.tipo_nome} · {formatBRL(Number(a.valor))}
                      </Badge>
                    ))}
                  </div>
                )}
              </div>

              <Separator />

              {/* Preço/Lucro */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
                <Info label="Preço sugerido" value={precoNum ? formatBRL(precoNum) : "—"} />
                <Info
                  label="Lucro"
                  value={lucro > 0 ? formatBRL(lucro) : "—"}
                  valueClass={lucro > 0 ? "text-success font-medium" : ""}
                />
                <Info label="Markup" value={markup > 0 ? `${markup.toFixed(1)}%` : "—"} />
                <Info label="Margem" value={margem > 0 ? `${margem.toFixed(1)}%` : "—"} />
                <Info label="Quantidade" value={String(aparelho.quantidade ?? 0)} />
                <Info label="Fornecedor" value={aparelho.fornecedor?.nome ?? "—"} />
                <Info
                  label="Data da compra"
                  value={
                    invoice?.data_compra
                      ? new Date(invoice.data_compra).toLocaleDateString("pt-BR")
                      : aparelho.data_entrada
                      ? new Date(aparelho.data_entrada).toLocaleDateString("pt-BR")
                      : "—"
                  }
                />
                <Info
                  label="Entrada no estoque"
                  value={
                    aparelho.data_entrada
                      ? new Date(aparelho.data_entrada).toLocaleDateString("pt-BR")
                      : "—"
                  }
                />
                {aparelho.nota_entrada && (
                  <Info label="Nota / lote" value={aparelho.nota_entrada} />
                )}
              </div>

              {invoice && (
                <>
                  <Separator />
                  <div className="space-y-1">
                    <p className="text-xs font-medium text-muted-foreground">
                      Origem {invoice.importado ? "(importado)" : ""}
                    </p>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-sm">
                      {invoice.pais_origem && <Info label="País" value={invoice.pais_origem} />}
                      {invoice.numero && <Info label="Invoice" value={invoice.numero} />}
                      {invoice.moeda && <Info label="Moeda" value={invoice.moeda} />}
                      {invoice.cotacao && (
                        <Info label="Cotação" value={Number(invoice.cotacao).toFixed(4)} />
                      )}
                    </div>
                  </div>
                </>
              )}

              {aparelho.observacoes && (
                <div>
                  <p className="text-xs text-muted-foreground">Observações</p>
                  <p className="text-sm text-foreground mt-1 whitespace-pre-wrap">
                    {aparelho.observacoes}
                  </p>
                </div>
              )}

              <Separator />

              {/* Ações */}
              <div className="space-y-3">
                {perms.podeEditarEstoque && (
                  <div className="space-y-2">
                    <p className="text-xs font-medium text-muted-foreground">Mudar status</p>
                    <div className="flex gap-2">
                      <Select value={novoStatus} onValueChange={setNovoStatus}>
                        <SelectTrigger className="flex-1">
                          <SelectValue placeholder="Selecione…" />
                        </SelectTrigger>
                        <SelectContent>
                          {statusCatalogo.map((s) => (
                            <SelectItem key={s.nome} value={s.nome}>
                              {s.nome}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Button
                        size="sm"
                        disabled={
                          mudarStatus.isPending ||
                          !novoStatus ||
                          novoStatus === aparelho.status
                        }
                        onClick={() => mudarStatus.mutate(novoStatus)}
                      >
                        {mudarStatus.isPending ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          "Aplicar"
                        )}
                      </Button>
                    </div>
                  </div>
                )}

                <div className="flex gap-2 flex-wrap">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      printEtiquetaAtacado({
                        modelo: aparelho.modelo,
                        capacidade: aparelho.capacidade,
                        cor: aparelho.cor,
                        imei: aparelho.imei_1,
                        preco: precoNum,
                      })
                    }
                  >
                    <Printer className="h-4 w-4" /> Etiqueta
                  </Button>

                  {perms.podeEditarEstoque && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-destructive hover:text-destructive"
                      onClick={() => setConfirmDelete(true)}
                    >
                      <Trash2 className="h-4 w-4" /> Remover
                    </Button>
                  )}
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover aparelho do estoque?</AlertDialogTitle>
            <AlertDialogDescription>
              Se já há histórico (pedido/venda), o aparelho será apenas
              desativado. Caso contrário, será arquivado (soft delete) e pode
              ser revertido pelo suporte.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive hover:bg-destructive/90"
              onClick={() => excluir.mutate()}
            >
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function Info({
  label,
  value,
  valueClass,
}: {
  label: string;
  value: string;
  valueClass?: string;
}) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`text-sm text-foreground tabular-nums ${valueClass ?? ""}`}>{value}</p>
    </div>
  );
}
