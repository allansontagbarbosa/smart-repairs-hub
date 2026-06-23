import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { CheckCircle2, FileText, Truck, Ban, Printer, Loader2, Building2, Trash2 } from "lucide-react";
import { formatBRL, maskCNPJ } from "@/lib/utils";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  pedidoId: string | null;
}

const STATUS_CONFIG: Record<string, { label: string; cls: string }> = {
  rascunho: { label: "Rascunho", cls: "bg-muted text-muted-foreground" },
  aguardando_aprovacao: { label: "Aguardando aprovação", cls: "bg-warning/15 text-warning border-warning/30" },
  aprovado: { label: "Aprovado", cls: "bg-info/15 text-info border-info/30" },
  faturado: { label: "Faturado", cls: "bg-primary/15 text-primary border-primary/30" },
  entregue: { label: "Entregue", cls: "bg-success/15 text-success border-success/30" },
  cancelado: { label: "Cancelado", cls: "bg-destructive/15 text-destructive border-destructive/30" },
};

export function PedidoAtacadoDrawer({ open, onOpenChange, pedidoId }: Props) {
  const { user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [motivoCancel, setMotivoCancel] = useState("");
  const [nfeNumero, setNfeNumero] = useState("");

  const { data: pedido, isLoading } = useQuery({
    queryKey: ["pedido-atacado-detalhe", pedidoId],
    queryFn: async () => {
      if (!pedidoId) return null;
      const { data } = await supabase
        .from("atacado_pedidos")
        .select(
          `*,
           cliente:atacado_clientes(razao_social, nome_fantasia, cnpj, telefone, email),
           vendedor:funcionarios!vendedor_id(nome),
           aprovador:funcionarios!aprovado_por(nome),
           itens:atacado_pedidos_itens(*),
           pagamentos:atacado_pedidos_pagamentos(*)`
        )
        .eq("id", pedidoId)
        .single();
      return data as any;
    },
    enabled: open && !!pedidoId,
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["atacado-pedidos"] });
    qc.invalidateQueries({ queryKey: ["pedido-atacado-detalhe", pedidoId] });
    qc.invalidateQueries({ queryKey: ["atacado-aparelhos"] });
    qc.invalidateQueries({ queryKey: ["atacado-kpis"] });
  };

  const aprovar = useMutation({
    mutationFn: async () => {
      const { data: profile } = await supabase
        .from("user_profiles")
        .select("funcionario_id")
        .eq("user_id", user!.id)
        .maybeSingle();
      const { error } = await supabase.rpc("aprovar_pedido_atacado" as any, {
        p_pedido_id: pedidoId!,
        p_aprovador_funcionario_id: profile?.funcionario_id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "✓ Pedido aprovado", description: "Estoque baixado." });
      invalidate();
    },
    onError: (e: any) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  const faturar = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc("faturar_pedido_atacado" as any, {
        p_pedido_id: pedidoId!,
        p_nfe_numero: nfeNumero || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "✓ Pedido faturado", description: "NF-e emitida." });
      setNfeNumero("");
      invalidate();
    },
    onError: (e: any) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  const marcarEntregue = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc("marcar_entregue_pedido_atacado" as any, {
        p_pedido_id: pedidoId!,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "✓ Pedido marcado como entregue" });
      invalidate();
    },
    onError: (e: any) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  const cancelar = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc("cancelar_pedido_atacado" as any, {
        p_pedido_id: pedidoId!,
        p_motivo: motivoCancel || "Sem motivo",
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "✓ Pedido cancelado", description: "Estoque reposto." });
      setMotivoCancel("");
      invalidate();
    },
    onError: (e: any) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  const excluirPedido = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc("atacado_excluir_pedido" as any, {
        p_id: pedidoId!,
      });
      if (error) throw error;
      return data as { success: boolean; error?: string };
    },
    onSuccess: (res) => {
      if (!res?.success) {
        toast({ title: "Erro", description: res?.error || "Não foi possível excluir", variant: "destructive" });
        return;
      }
      toast({ title: "✓ Pedido excluído" });
      qc.invalidateQueries({ queryKey: ["atacado-pedidos"] });
      qc.invalidateQueries({ queryKey: ["atacado-kpis"] });
      qc.invalidateQueries({ queryKey: ["financeiro"] });
      qc.invalidateQueries({ queryKey: ["atacado-cobranca"] });
      onOpenChange(false);
    },
    onError: (e: any) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });


  if (!open) return null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-xl overflow-y-auto p-0">
        {isLoading || !pedido ? (
          <div className="flex items-center justify-center h-64">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            <SheetHeader className="p-4 border-b">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <SheetTitle className="font-mono">
                    #P-{String(pedido.numero_pedido).padStart(6, "0")}
                  </SheetTitle>
                  <div className="text-xs text-muted-foreground mt-1">
                    Criado em {new Date(pedido.created_at).toLocaleDateString("pt-BR")} ·{" "}
                    {pedido.condicao_pagamento || "—"}
                  </div>
                </div>
                <Badge variant="outline" className={STATUS_CONFIG[pedido.status]?.cls}>
                  {STATUS_CONFIG[pedido.status]?.label ?? pedido.status}
                </Badge>
              </div>

              <div className="grid grid-cols-2 gap-3 mt-3">
                <div className="p-2 bg-muted/30 rounded">
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Total</div>
                  <div className="font-bold text-warning tabular-nums">
                    {formatBRL(Number(pedido.total))}
                  </div>
                </div>
                <div className="p-2 bg-muted/30 rounded">
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Vendedor</div>
                  <div className="text-sm font-medium truncate">{pedido.vendedor?.nome ?? "—"}</div>
                </div>
              </div>
            </SheetHeader>

            {/* Ações */}
            <div className="p-4 border-b bg-muted/20">
              <div className="flex flex-wrap gap-2">
                {pedido.status === "aguardando_aprovacao" && (
                  <Button size="sm" onClick={() => aprovar.mutate()} disabled={aprovar.isPending}>
                    {aprovar.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <CheckCircle2 className="h-4 w-4" />
                    )}
                    Aprovar
                  </Button>
                )}

                {pedido.status === "aprovado" && (
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button size="sm">
                        <FileText className="h-4 w-4" /> Faturar (gerar NF-e)
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Faturar pedido</AlertDialogTitle>
                        <AlertDialogDescription>
                          O pedido será marcado como faturado e uma NF-e simulada será gerada.
                          Em produção, este botão integra com a SEFAZ.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <div className="space-y-2">
                        <Label>Número NF-e (opcional)</Label>
                        <Input
                          value={nfeNumero}
                          onChange={(e) => setNfeNumero(e.target.value)}
                          placeholder="Auto-gerado se vazio"
                        />
                      </div>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction onClick={() => faturar.mutate()}>Faturar</AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                )}

                {pedido.status === "faturado" && (
                  <>
                    <Button
                      size="sm"
                      onClick={() => marcarEntregue.mutate()}
                      disabled={marcarEntregue.isPending}
                    >
                      <Truck className="h-4 w-4" /> Marcar entregue
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => window.print()}>
                      <Printer className="h-4 w-4" /> Imprimir NF-e
                    </Button>
                  </>
                )}

                {pedido.status === "entregue" && (
                  <Button size="sm" variant="outline" onClick={() => window.print()}>
                    <Printer className="h-4 w-4" /> Imprimir NF-e
                  </Button>
                )}

                {!["entregue", "cancelado"].includes(pedido.status) && (
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button size="sm" variant="outline" className="text-destructive">
                        <Ban className="h-4 w-4" /> Cancelar
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>
                          Cancelar pedido #P-{String(pedido.numero_pedido).padStart(6, "0")}?
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                          {["aprovado", "faturado"].includes(pedido.status)
                            ? "O estoque será reposto e os pagamentos abertos cancelados."
                            : "Esta ação marca o pedido como cancelado permanentemente."}
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <div className="space-y-2">
                        <Label>Motivo</Label>
                        <Textarea
                          value={motivoCancel}
                          onChange={(e) => setMotivoCancel(e.target.value)}
                          rows={2}
                          placeholder="Cliente desistiu, erro de cadastro..."
                        />
                      </div>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Voltar</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={() => cancelar.mutate()}
                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                          Confirmar cancelamento
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                )}
              </div>
            </div>

            <Tabs defaultValue="resumo" className="p-4">
              <TabsList className="w-full">
                <TabsTrigger value="resumo" className="flex-1">
                  Resumo
                </TabsTrigger>
                <TabsTrigger value="itens" className="flex-1">
                  Itens ({pedido.itens?.length ?? 0})
                </TabsTrigger>
                <TabsTrigger value="pagamentos" className="flex-1">
                  Pagamentos ({pedido.pagamentos?.length ?? 0})
                </TabsTrigger>
              </TabsList>

              <TabsContent value="resumo" className="space-y-3 mt-4">
                <div className="p-3 bg-muted/30 rounded-lg">
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-1">
                    Cliente
                  </div>
                  <div className="flex items-center gap-2">
                    <Building2 className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <div className="font-semibold">
                        {pedido.cliente?.nome_fantasia || pedido.cliente?.razao_social}
                      </div>
                      <div className="text-xs text-muted-foreground tabular-nums">
                        {maskCNPJ(pedido.cliente?.cnpj ?? "")}
                      </div>
                    </div>
                  </div>
                </div>

                {pedido.nfe_numero && (
                  <div className="p-3 bg-primary/5 border border-primary/30 rounded-lg">
                    <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-1">
                      NF-e
                    </div>
                    <div className="font-mono text-sm">{pedido.nfe_numero}</div>
                  </div>
                )}

                {pedido.aprovado_em && (
                  <div className="text-xs text-muted-foreground">
                    Aprovado por <strong>{pedido.aprovador?.nome ?? "—"}</strong> em{" "}
                    {new Date(pedido.aprovado_em).toLocaleString("pt-BR")}
                  </div>
                )}

                {pedido.observacoes && (
                  <div className="bg-muted/40 rounded p-3 text-sm italic">
                    <div className="text-xs text-muted-foreground mb-1 not-italic">Observações</div>
                    {pedido.observacoes}
                  </div>
                )}

                <div className="space-y-1 pt-3 border-t">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Subtotal</span>
                    <span className="tabular-nums">{formatBRL(Number(pedido.subtotal))}</span>
                  </div>
                  {Number(pedido.desconto) > 0 && (
                    <div className="flex justify-between text-sm text-warning">
                      <span>Desconto</span>
                      <span className="tabular-nums">− {formatBRL(Number(pedido.desconto))}</span>
                    </div>
                  )}
                  <div className="flex justify-between font-bold text-base pt-1 border-t">
                    <span>Total</span>
                    <span className="tabular-nums text-warning">{formatBRL(Number(pedido.total))}</span>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="itens" className="space-y-2 mt-4">
                {pedido.itens?.map((it: any) => (
                  <div key={it.id} className="p-3 bg-card border rounded-lg">
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="font-medium">
                          {it.modelo} {it.capacidade ?? ""}
                        </div>
                        <div className="text-xs text-muted-foreground">{it.cor ?? ""}</div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-bold tabular-nums">
                          {formatBRL(Number(it.total_item))}
                        </div>
                        <div className="text-xs text-muted-foreground tabular-nums">
                          {it.quantidade}× {formatBRL(Number(it.preco_unitario))}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </TabsContent>

              <TabsContent value="pagamentos" className="space-y-2 mt-4">
                {pedido.pagamentos?.map((pg: any) => {
                  const atrasado =
                    pg.status === "atrasado" ||
                    (pg.status === "aberto" && pg.vencimento && new Date(pg.vencimento) < new Date());
                  return (
                    <div
                      key={pg.id}
                      className={`p-3 border rounded-lg ${atrasado ? "bg-destructive/5 border-destructive/30" : "bg-card"}`}
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="font-medium text-sm">
                            Parcela {pg.parcela}/{pg.total_parcelas}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {pg.forma} ·{" "}
                            {pg.vencimento
                              ? `venc ${new Date(pg.vencimento).toLocaleDateString("pt-BR")}`
                              : "à vista"}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-sm font-bold tabular-nums">
                            {formatBRL(Number(pg.valor))}
                          </div>
                          <Badge
                            variant="outline"
                            className={`text-[10px] mt-1 ${
                              pg.status === "pago"
                                ? "bg-success/15 text-success border-success/30"
                                : pg.status === "atrasado"
                                  ? "bg-destructive/15 text-destructive border-destructive/30"
                                  : ""
                            }`}
                          >
                            {pg.status}
                          </Badge>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </TabsContent>
            </Tabs>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
