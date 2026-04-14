import { useState } from "react";
import { ShoppingCart, Check, Send, Package, X, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

const STATUS_MAP: Record<string, { label: string; color: string }> = {
  rascunho: { label: "Rascunho", color: "bg-muted text-muted-foreground" },
  enviado: { label: "Enviado", color: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400" },
  confirmado: { label: "Confirmado", color: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400" },
  recebido: { label: "Recebido", color: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" },
  cancelado: { label: "Cancelado", color: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400" },
};

interface Props {
  onNewPedido: () => void;
}

export function PedidosCompraList({ onNewPedido }: Props) {
  const qc = useQueryClient();
  const [filter, setFilter] = useState("todos");
  const [avaliarPedido, setAvaliarPedido] = useState<any>(null);
  const [avalForm, setAvalForm] = useState({ nota_prazo: 5, nota_qualidade: 5, nota_preco: 5, comentario: "" });

  const { data: pedidos = [] } = useQuery({
    queryKey: ["pedidos_compra"],
    queryFn: async () => {
      const { data } = await supabase
        .from("pedidos_compra")
        .select("*, fornecedores(nome), pedidos_compra_itens(*)")
        .order("created_at", { ascending: false });
      return data || [];
    },
  });

  const filtered = filter === "todos" ? pedidos : pedidos.filter((p: any) => p.status === filter);

  const updateStatus = async (pedido: any, newStatus: string) => {
    if (newStatus === "recebido") {
      // Auto stock entry
      const itens = pedido.pedidos_compra_itens || [];

      // Create entrada_estoque
      const { data: entrada } = await supabase
        .from("entradas_estoque")
        .insert({
          fornecedor_id: pedido.fornecedor_id,
          fornecedor_nome: pedido.fornecedores?.nome || "",
          valor_total: pedido.valor_total || 0,
          observacoes: `Pedido de compra recebido`,
        })
        .select("id")
        .single();

      if (entrada) {
        // Insert items and update stock
        for (const item of itens) {
          if (item.estoque_item_id) {
            await supabase.from("entradas_estoque_itens").insert({
              entrada_id: entrada.id,
              estoque_item_id: item.estoque_item_id,
              quantidade: item.quantidade,
              custo_unitario: item.custo_unitario,
            });

            // Update stock quantity
            const { data: current } = await supabase
              .from("estoque_itens")
              .select("quantidade")
              .eq("id", item.estoque_item_id)
              .single();

            if (current) {
              await supabase
                .from("estoque_itens")
                .update({ quantidade: (current.quantidade || 0) + item.quantidade })
                .eq("id", item.estoque_item_id);
            }
          }

          // Update received qty
          await supabase
            .from("pedidos_compra_itens")
            .update({ quantidade_recebida: item.quantidade })
            .eq("id", item.id);
        }

        // Insert financial movement
        if (pedido.valor_total > 0) {
          await supabase.from("movimentacoes_financeiras").insert({
            tipo: "saida",
            valor: pedido.valor_total,
            descricao: `Compra — ${pedido.fornecedores?.nome || "Fornecedor"}`,
          });
        }
      }

      // Update pedido
      await supabase
        .from("pedidos_compra")
        .update({ status: "recebido", data_recebimento: new Date().toISOString().split("T")[0] })
        .eq("id", pedido.id);

      qc.invalidateQueries({ queryKey: ["pedidos_compra"] });
      qc.invalidateQueries({ queryKey: ["estoque_itens"] });
      qc.invalidateQueries({ queryKey: ["entradas_estoque"] });
      toast.success("Pedido recebido e estoque atualizado!");

      // Prompt rating
      setAvaliarPedido(pedido);
      return;
    }

    await supabase.from("pedidos_compra").update({ status: newStatus }).eq("id", pedido.id);
    qc.invalidateQueries({ queryKey: ["pedidos_compra"] });
    toast.success(`Status atualizado para ${STATUS_MAP[newStatus]?.label || newStatus}`);
  };

  const handleSaveAvaliacao = async () => {
    if (!avaliarPedido) return;
    await supabase.from("avaliacoes_fornecedor").insert({
      fornecedor_id: avaliarPedido.fornecedor_id,
      pedido_id: avaliarPedido.id,
      ...avalForm,
    });
    qc.invalidateQueries({ queryKey: ["avaliacoes_fornecedor"] });
    toast.success("Avaliação salva!");
    setAvaliarPedido(null);
    setAvalForm({ nota_prazo: 5, nota_qualidade: 5, nota_preco: 5, comentario: "" });
  };

  const StarRating = ({ value, onChange }: { value: number; onChange: (v: number) => void }) => (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((n) => (
        <button key={n} type="button" onClick={() => onChange(n)} className="focus:outline-none">
          <Star className={`h-5 w-5 ${n <= value ? "fill-amber-400 text-amber-400" : "text-muted-foreground/30"}`} />
        </button>
      ))}
    </div>
  );

  return (
    <div className="space-y-4 mt-4">
      <div className="flex flex-col sm:flex-row gap-3 justify-between">
        <Select value={filter} onValueChange={setFilter}>
          <SelectTrigger className="w-40 h-8 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos</SelectItem>
            <SelectItem value="rascunho">Rascunho</SelectItem>
            <SelectItem value="enviado">Enviado</SelectItem>
            <SelectItem value="confirmado">Confirmado</SelectItem>
            <SelectItem value="recebido">Recebido</SelectItem>
            <SelectItem value="cancelado">Cancelado</SelectItem>
          </SelectContent>
        </Select>
        <Button size="sm" onClick={onNewPedido}>
          <ShoppingCart className="h-4 w-4 mr-1" /> Novo Pedido
        </Button>
      </div>

      <div className="space-y-3">
        {filtered.map((p: any) => {
          const s = STATUS_MAP[p.status] || STATUS_MAP.rascunho;
          const itensCount = p.pedidos_compra_itens?.length || 0;
          return (
            <Card key={p.id}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <h4 className="font-medium text-sm">{p.fornecedores?.nome || "Fornecedor"}</h4>
                    <p className="text-xs text-muted-foreground">
                      {p.data_pedido ? new Date(p.data_pedido + "T00:00:00").toLocaleDateString("pt-BR") : "—"}
                      {" · "}{itensCount} {itensCount === 1 ? "item" : "itens"}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-sm">
                      R$ {(p.valor_total || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                    </span>
                    <Badge className={`text-[10px] ${s.color}`}>{s.label}</Badge>
                  </div>
                </div>

                {p.status !== "recebido" && p.status !== "cancelado" && (
                  <div className="flex gap-2 mt-3">
                    {p.status === "rascunho" && (
                      <>
                        <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => updateStatus(p, "enviado")}>
                          <Send className="h-3 w-3 mr-1" /> Enviar
                        </Button>
                        <Button size="sm" variant="ghost" className="h-7 text-xs text-destructive" onClick={() => updateStatus(p, "cancelado")}>
                          <X className="h-3 w-3 mr-1" /> Cancelar
                        </Button>
                      </>
                    )}
                    {p.status === "enviado" && (
                      <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => updateStatus(p, "confirmado")}>
                        <Check className="h-3 w-3 mr-1" /> Confirmar
                      </Button>
                    )}
                    {p.status === "confirmado" && (
                      <Button size="sm" variant="default" className="h-7 text-xs" onClick={() => updateStatus(p, "recebido")}>
                        <Package className="h-3 w-3 mr-1" /> Receber
                      </Button>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
        {filtered.length === 0 && (
          <p className="text-center py-8 text-muted-foreground">Nenhum pedido encontrado</p>
        )}
      </div>

      {/* Rating dialog */}
      <Dialog open={!!avaliarPedido} onOpenChange={(v) => !v && setAvaliarPedido(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Avaliar Fornecedor</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label className="text-sm">Prazo de entrega</Label>
              <StarRating value={avalForm.nota_prazo} onChange={(v) => setAvalForm((p) => ({ ...p, nota_prazo: v }))} />
            </div>
            <div>
              <Label className="text-sm">Qualidade</Label>
              <StarRating value={avalForm.nota_qualidade} onChange={(v) => setAvalForm((p) => ({ ...p, nota_qualidade: v }))} />
            </div>
            <div>
              <Label className="text-sm">Preço</Label>
              <StarRating value={avalForm.nota_preco} onChange={(v) => setAvalForm((p) => ({ ...p, nota_preco: v }))} />
            </div>
            <div>
              <Label>Comentário (opcional)</Label>
              <Textarea value={avalForm.comentario} onChange={(e) => setAvalForm((p) => ({ ...p, comentario: e.target.value }))} rows={2} />
            </div>
            <Button onClick={handleSaveAvaliacao} className="w-full">Salvar Avaliação</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
