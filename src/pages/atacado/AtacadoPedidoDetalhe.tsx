import { useParams, useNavigate, Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { usePermissoesAtacado } from "@/hooks/usePermissoesAtacado";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  ArrowLeft,
  CheckCircle2,
  XCircle,
  FileText,
  Truck,
  RotateCcw,
  Loader2,
} from "lucide-react";
import { formatBRL, maskCNPJ } from "@/lib/utils";
import {
  calcularStatusPagamento,
  labelStatusPagamento,
  classesStatusPagamento,
} from "@/lib/atacadoPagamentoStatus";

const STATUS_LABEL: Record<string, string> = {
  rascunho: "Rascunho",
  aguardando_aprovacao: "Aguardando aprovação",
  aprovado: "Aprovado",
  faturado: "Faturado",
  entregue: "Entregue",
  cancelado: "Cancelado",
};

export default function AtacadoPedidoDetalhe() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const qc = useQueryClient();
  const perms = usePermissoesAtacado();

  const { data: pedido, isLoading } = useQuery({
    queryKey: ["atacado-pedido-detalhe", id],
    queryFn: async () => {
      const { data } = await supabase
        .from("atacado_pedidos")
        .select(
          `*,
          cliente:atacado_clientes(*),
          vendedor:funcionarios(nome),
          itens:atacado_pedidos_itens(*),
          pagamentos:atacado_pedidos_pagamentos(*),
          historico:atacado_pedidos_historico(*, funcionario:funcionarios(nome))`
        )
        .eq("id", id!)
        .single();
      return data;
    },
    enabled: !!id,
  });

  const mudarStatus = useMutation({
    mutationFn: async ({ novoStatus, motivo }: any) => {
      const { error } = await supabase.rpc("atacado_mudar_status_pedido", {
        p_pedido_id: id!,
        p_novo_status: novoStatus,
        p_motivo: motivo ?? null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["atacado-pedido-detalhe", id] });
      qc.invalidateQueries({ queryKey: ["atacado-pedidos"] });
      qc.invalidateQueries({ queryKey: ["atacado-aparelhos"] });
      toast({ title: "✓ Status atualizado" });
    },
    onError: (e: any) =>
      toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  const marcarPago = useMutation({
    mutationFn: async (pagamentoId: string) => {
      const { error } = await supabase.rpc("atacado_marcar_pagamento_pago" as any, {
        p_pagamento_id: pagamentoId,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["atacado-pedido-detalhe", id] });
      qc.invalidateQueries({ queryKey: ["atacado-pedidos"] });
      toast({ title: "✓ Pagamento recebido" });
    },
    onError: (e: any) =>
      toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });
    },
    onError: (e: any) =>
      toast({
        title: "Erro",
        description: e.message,
        variant: "destructive",
      }),
  });

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (!pedido) {
    return <div className="p-6">Pedido não encontrado.</div>;
  }

  const p: any = pedido;

  return (
    <div className="p-6 space-y-6">
      <Button
        variant="ghost"
        size="sm"
        onClick={() => navigate("/atacado/pedidos")}
        className="mb-1"
      >
        <ArrowLeft className="h-4 w-4 mr-2" /> Voltar
      </Button>

      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold">
            #P-{String(p.numero_pedido).padStart(6, "0")}
          </h1>
          <div className="text-sm text-muted-foreground flex items-center gap-2 mt-1 flex-wrap">
            <span>{new Date(p.created_at).toLocaleDateString("pt-BR")}</span>
            <span>·</span>
            <span>{p.vendedor?.nome ?? "—"}</span>
            <span>·</span>
            <Badge variant="outline">
              {STATUS_LABEL[p.status] ?? p.status}
            </Badge>
            {p.nfe_numero && (
              <>
                <span>·</span>
                <span>NF-e {p.nfe_numero}</span>
              </>
            )}
          </div>
        </div>
        <div className="text-right">
          <div className="text-xs uppercase text-muted-foreground">Total</div>
          <div className="text-2xl font-bold">
            {formatBRL(Number(p.total))}
          </div>
        </div>
      </div>

      {/* Ações */}
      <div className="flex flex-wrap gap-2">
        {p.status === "aguardando_aprovacao" && perms.podeAprovarPedido && (
          <>
            <Button
              onClick={() => mudarStatus.mutate({ novoStatus: "aprovado" })}
              disabled={mudarStatus.isPending}
            >
              <CheckCircle2 className="h-4 w-4 mr-2" /> Aprovar
            </Button>
            <Button
              variant="outline"
              className="text-destructive border-destructive/30"
              onClick={() =>
                mudarStatus.mutate({
                  novoStatus: "cancelado",
                  motivo: "Rejeitado na aprovação",
                })
              }
            >
              <XCircle className="h-4 w-4 mr-2" /> Rejeitar
            </Button>
          </>
        )}
        {p.status === "aprovado" && (
          <>
            <Button
              onClick={() => mudarStatus.mutate({ novoStatus: "faturado" })}
            >
              <FileText className="h-4 w-4 mr-2" /> Faturar
            </Button>
            <Button
              variant="outline"
              className="text-destructive border-destructive/30"
              onClick={() => mudarStatus.mutate({ novoStatus: "cancelado" })}
            >
              <XCircle className="h-4 w-4 mr-2" /> Cancelar
            </Button>
          </>
        )}
        {p.status === "faturado" && (
          <Button onClick={() => mudarStatus.mutate({ novoStatus: "entregue" })}>
            <Truck className="h-4 w-4 mr-2" /> Marcar entregue
          </Button>
        )}
        {p.status === "cancelado" && (
          <Button
            variant="outline"
            onClick={() => mudarStatus.mutate({ novoStatus: "rascunho" })}
          >
            <RotateCcw className="h-4 w-4 mr-2" /> Reativar
          </Button>
        )}
      </div>

      <Tabs defaultValue="itens">
        <TabsList>
          <TabsTrigger value="itens">
            Itens ({p.itens?.length ?? 0})
          </TabsTrigger>
          <TabsTrigger value="pagamentos">
            Pagamentos ({p.pagamentos?.length ?? 0})
          </TabsTrigger>
          <TabsTrigger value="cliente">Cliente</TabsTrigger>
          <TabsTrigger value="historico">Histórico</TabsTrigger>
        </TabsList>

        <TabsContent value="itens" className="space-y-4">
          <div className="border rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="text-left px-4 py-2">Produto</th>
                  <th className="text-right px-4 py-2">Qtd</th>
                  <th className="text-right px-4 py-2">Preço un.</th>
                  <th className="text-right px-4 py-2">Total</th>
                </tr>
              </thead>
              <tbody>
                {p.itens?.map((it: any) => (
                  <tr key={it.id} className="border-t">
                    <td className="px-4 py-3">
                      {it.modelo}{" "}
                      {it.capacidade ? `· ${it.capacidade}` : ""}{" "}
                      {it.cor ? `· ${it.cor}` : ""}
                    </td>
                    <td className="px-4 py-3 text-right">{it.quantidade}</td>
                    <td className="px-4 py-3 text-right">
                      {formatBRL(Number(it.preco_unitario))}
                    </td>
                    <td className="px-4 py-3 text-right font-medium">
                      {formatBRL(Number(it.total_item))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="ml-auto max-w-xs space-y-1 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Subtotal</span>
              <span>{formatBRL(Number(p.subtotal))}</span>
            </div>
            {Number(p.desconto) > 0 && (
              <div className="flex justify-between text-muted-foreground">
                <span>Desconto</span>
                <span>−{formatBRL(Number(p.desconto))}</span>
              </div>
            )}
            <div className="flex justify-between font-bold text-base pt-2 border-t">
              <span>Total</span>
              <span>{formatBRL(Number(p.total))}</span>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="pagamentos" className="space-y-2">
          {p.pagamentos?.length ? (
            p.pagamentos.map((pg: any) => (
              <div
                key={pg.id}
                className="border rounded-lg p-3 flex items-center justify-between"
              >
                <div>
                  <div className="font-medium">
                    Parcela {pg.parcela}/{pg.total_parcelas} · {pg.forma}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Venc:{" "}
                    {pg.vencimento
                      ? new Date(pg.vencimento).toLocaleDateString("pt-BR")
                      : "—"}
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-medium">
                    {formatBRL(Number(pg.valor))}
                  </div>
                  <Badge variant="outline" className="mt-1">
                    {pg.status}
                  </Badge>
                </div>
              </div>
            ))
          ) : (
            <p className="text-sm text-muted-foreground">
              Sem pagamentos registrados.
            </p>
          )}
        </TabsContent>

        <TabsContent value="cliente" className="space-y-1 text-sm">
          <div className="font-semibold text-base">
            {p.cliente?.razao_social}
          </div>
          <div>
            CNPJ: {p.cliente?.cnpj ? maskCNPJ(p.cliente.cnpj) : "—"}
          </div>
          <div>IE: {p.cliente?.inscricao_estadual ?? "—"}</div>
          <div>Tel: {p.cliente?.telefone ?? "—"}</div>
          <div>Email: {p.cliente?.email ?? "—"}</div>
          <div>
            Endereço: {p.cliente?.endereco ?? "—"}
            {p.cliente?.numero ? `, ${p.cliente.numero}` : ""} ·{" "}
            {p.cliente?.cidade ?? "—"}/{p.cliente?.uf ?? p.cliente?.estado ?? "—"}
          </div>
          {p.cliente?.id && (
            <Link
              to={`/atacado/clientes?id=${p.cliente.id}`}
              className="text-primary underline text-sm inline-block mt-2"
            >
              Ver no cadastro →
            </Link>
          )}
        </TabsContent>

        <TabsContent value="historico" className="space-y-2">
          {!p.historico?.length ? (
            <p className="text-sm text-muted-foreground">
              Sem histórico ainda.
            </p>
          ) : (
            [...p.historico]
              .sort(
                (a: any, b: any) =>
                  new Date(b.created_at).getTime() -
                  new Date(a.created_at).getTime()
              )
              .map((h: any) => (
                <div key={h.id} className="border rounded-lg p-3">
                  <div className="text-sm font-medium">
                    {STATUS_LABEL[h.status_anterior] ?? h.status_anterior ?? "novo"}
                    {" → "}
                    {STATUS_LABEL[h.status_novo] ?? h.status_novo}
                  </div>
                  {h.motivo && (
                    <div className="text-xs text-muted-foreground mt-1">
                      {h.motivo}
                    </div>
                  )}
                  <div className="text-xs text-muted-foreground mt-1">
                    {h.funcionario?.nome ?? "Sistema"} ·{" "}
                    {new Date(h.created_at).toLocaleString("pt-BR")}
                  </div>
                </div>
              ))
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
