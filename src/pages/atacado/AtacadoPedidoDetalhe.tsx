import { useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { usePermissoesAtacado } from "@/hooks/usePermissoesAtacado";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  ArrowLeft,
  CheckCircle2,
  XCircle,
  FileText,
  Truck,
  RotateCcw,
  Loader2,
} from "lucide-react";
import { formatBRL, maskCNPJ, maskIMEI } from "@/lib/utils";
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

function fmtDate(d?: string | null) {
  return d ? new Date(d).toLocaleDateString("pt-BR") : "—";
}

export default function AtacadoPedidoDetalhe() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const qc = useQueryClient();
  const perms = usePermissoesAtacado();
  const podeVerCusto = perms.podeVerFinanceiro;
  const [baixaPg, setBaixaPg] = useState<any>(null);


  const { data: pedido, isLoading } = useQuery({
    queryKey: ["atacado-pedido-detalhe", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("atacado_pedidos")
        .select(
          `*,
          cliente:atacado_clientes(*),
          vendedor:funcionarios!vendedor_id(nome),
          aprovador:funcionarios!aprovado_por(nome),
          itens:atacado_pedidos_itens(*, aparelho:atacado_aparelhos(id, imei_1, imei_2, custo, grade, condicao)),
          pagamentos:atacado_pedidos_pagamentos(*),
          historico:atacado_pedidos_historico(*, funcionario:funcionarios!funcionario_id(nome))`
        )
        .eq("id", id!)
        .single();
      if (error) throw error;
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
    mutationFn: async ({ pagamentoId, valor, forma, data }: { pagamentoId: string; valor: number; forma: string; data: string }) => {
      const { data: res, error } = await supabase.rpc("atacado_receber_pagamento" as any, {
        p_pagamento_id: pagamentoId,
        p_valor: valor,
        p_forma: forma,
        p_data: data,
      });
      if (error) throw error;
      if (res && (res as any).success === false) throw new Error((res as any).error || "Não foi possível receber");
    },
    onSuccess: () => {
      setBaixaPg(null);
      qc.invalidateQueries({ queryKey: ["atacado-pedido-detalhe", id] });
      qc.invalidateQueries({ queryKey: ["atacado-pedidos"] });
      qc.invalidateQueries({ queryKey: ["atacado-cobranca"] });
      qc.invalidateQueries({ queryKey: ["atacado-financeiro-kpis"] });
      toast({ title: "✓ Pagamento recebido" });
    },
    onError: (e: any) =>
      toast({ title: "Erro", description: e.message, variant: "destructive" }),
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
  const itens: any[] = p.itens ?? [];
  const pagamentos: any[] = p.pagamentos ?? [];

  // Rentabilidade
  const custoTotal = itens.reduce((acc, it) => {
    const custoUn = Number(it.aparelho?.custo ?? 0);
    return acc + custoUn * Number(it.quantidade ?? 0);
  }, 0);
  const totalVenda = Number(p.total ?? 0);
  const lucro = totalVenda - custoTotal;
  const markup = custoTotal > 0 ? (lucro / custoTotal) * 100 : 0;
  const margem = totalVenda > 0 ? (lucro / totalVenda) * 100 : 0;

  // Pagamento
  const ativas = pagamentos.filter((pg) => pg.status !== "cancelado");
  const totalPago = ativas
    .filter((pg) => pg.status === "pago")
    .reduce((a, pg) => a + Number(pg.valor ?? 0), 0);
  const saldoAberto = Math.max(0, totalVenda - totalPago);
  const proxima = ativas
    .filter((pg) => pg.status !== "pago" && pg.vencimento)
    .sort((a, b) => (a.vencimento ?? "").localeCompare(b.vencimento ?? ""))[0];
  const sp = calcularStatusPagamento(pagamentos as any);

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
            <span>{fmtDate(p.created_at)}</span>
            <span>·</span>
            <span>{p.vendedor?.nome ?? "—"}</span>
            <span>·</span>
            <Badge variant="outline">
              {STATUS_LABEL[p.status] ?? p.status}
            </Badge>
            {sp !== "sem_pagamentos" && (
              <Badge variant="outline" className={classesStatusPagamento(sp)}>
                {labelStatusPagamento(sp)}
              </Badge>
            )}
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
          <div className="text-2xl font-bold">{formatBRL(totalVenda)}</div>
          {Number(p.desconto) > 0 && (
            <div className="text-xs text-muted-foreground">
              Subtotal {formatBRL(Number(p.subtotal))} − desconto {formatBRL(Number(p.desconto))}
            </div>
          )}
        </div>
      </div>

      {/* Cards de resumo */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {podeVerCusto && (
          <div className="border rounded-lg p-3 space-y-1">
            <div className="text-xs uppercase text-muted-foreground">Rentabilidade</div>
            <div className="text-sm">Custo: <span className="font-medium">{formatBRL(custoTotal)}</span></div>
            <div className="text-sm">
              Lucro:{" "}
              <span className={`font-medium ${lucro >= 0 ? "text-success" : "text-destructive"}`}>
                {formatBRL(lucro)}
              </span>
            </div>
            <div className="text-xs text-muted-foreground">
              Markup {markup.toFixed(1)}% · Margem {margem.toFixed(1)}%
            </div>
          </div>
        )}

        <div className="border rounded-lg p-3 space-y-1">
          <div className="text-xs uppercase text-muted-foreground">Pagamento</div>
          <div className="text-sm">Pago: <span className="font-medium">{formatBRL(totalPago)}</span></div>
          <div className="text-sm">Saldo: <span className="font-medium">{formatBRL(saldoAberto)}</span></div>
          {proxima && (
            <div className="text-xs text-muted-foreground">
              Próx. venc: {fmtDate(proxima.vencimento)} · {formatBRL(Number(proxima.valor))}
            </div>
          )}
          {p.condicao_pagamento && (
            <div className="text-xs text-muted-foreground">Condição: {p.condicao_pagamento}</div>
          )}
        </div>

        <div className="border rounded-lg p-3 space-y-1">
          <div className="text-xs uppercase text-muted-foreground">Cliente</div>
          <div className="text-sm font-medium truncate">{p.cliente?.razao_social ?? "—"}</div>
          <div className="text-xs text-muted-foreground">
            {p.cliente?.cnpj ? maskCNPJ(p.cliente.cnpj) : "—"}
          </div>
          {p.cliente?.limite_credito != null && (
            <div className="text-xs text-muted-foreground">
              Limite {formatBRL(Number(p.cliente.limite_credito))}
              {p.cliente?.prazo_pagamento_padrao
                ? ` · ${p.cliente.prazo_pagamento_padrao}d`
                : ""}
            </div>
          )}
        </div>

        <div className="border rounded-lg p-3 space-y-1">
          <div className="text-xs uppercase text-muted-foreground">Datas / NF-e</div>
          <div className="text-xs">Pedido: {fmtDate(p.created_at)}</div>
          <div className="text-xs">Aprovado: {fmtDate(p.aprovado_em)}</div>
          <div className="text-xs">Faturado: {fmtDate(p.faturado_em)}</div>
          <div className="text-xs">
            NF-e: {p.nfe_numero ? `${p.nfe_numero}` : "pendente"}
          </div>
        </div>
      </div>

      {p.observacoes && (
        <div className="border rounded-lg p-3 text-sm">
          <div className="text-xs uppercase text-muted-foreground mb-1">Observações</div>
          {p.observacoes}
        </div>
      )}

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
            <Button onClick={() => mudarStatus.mutate({ novoStatus: "faturado" })}>
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
          <TabsTrigger value="itens">Itens ({itens.length})</TabsTrigger>
          <TabsTrigger value="pagamentos">
            Pagamentos ({pagamentos.length})
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
                  <th className="text-left px-4 py-2">IMEI</th>
                  <th className="text-right px-4 py-2">Qtd</th>
                  {podeVerCusto && <th className="text-right px-4 py-2">Custo un.</th>}
                  <th className="text-right px-4 py-2">Preço un.</th>
                  {podeVerCusto && <th className="text-right px-4 py-2">Lucro</th>}
                  <th className="text-right px-4 py-2">Total</th>
                </tr>
              </thead>
              <tbody>
                {itens.map((it: any) => {
                  const qtd = Number(it.quantidade ?? 0);
                  const preco = Number(it.preco_unitario ?? 0);
                  const custoUn = Number(it.aparelho?.custo ?? 0);
                  const totalItem = Number(it.total_item ?? preco * qtd);
                  const lucroItem = (preco - custoUn) * qtd;
                  const margemItem = preco > 0 ? ((preco - custoUn) / preco) * 100 : 0;
                  const imei = it.aparelho?.imei_1;
                  return (
                    <tr key={it.id} className="border-t align-top">
                      <td className="px-4 py-3">
                        <div>{it.modelo}</div>
                        <div className="text-xs text-muted-foreground">
                          {[it.capacidade, it.cor, it.aparelho?.grade, it.aparelho?.condicao]
                            .filter(Boolean)
                            .join(" · ") || "—"}
                        </div>
                      </td>
                      <td className="px-4 py-3 font-mono text-xs">
                        {imei ? maskIMEI(imei) : "—"}
                      </td>
                      <td className="px-4 py-3 text-right">{qtd}</td>
                      {podeVerCusto && (
                        <td className="px-4 py-3 text-right text-muted-foreground">
                          {custoUn > 0 ? formatBRL(custoUn) : "—"}
                        </td>
                      )}
                      <td className="px-4 py-3 text-right">{formatBRL(preco)}</td>
                      {podeVerCusto && (
                        <td className="px-4 py-3 text-right">
                          <div className={lucroItem >= 0 ? "text-success" : "text-destructive"}>
                            {formatBRL(lucroItem)}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {margemItem.toFixed(1)}%
                          </div>
                        </td>
                      )}
                      <td className="px-4 py-3 text-right font-medium">
                        {formatBRL(totalItem)}
                      </td>
                    </tr>
                  );
                })}
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
              <span>{formatBRL(totalVenda)}</span>
            </div>
            {podeVerCusto && (
              <>
                <div className="flex justify-between text-muted-foreground pt-2">
                  <span>Custo total</span>
                  <span>{formatBRL(custoTotal)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Lucro</span>
                  <span className={lucro >= 0 ? "text-success" : "text-destructive"}>
                    {formatBRL(lucro)}
                  </span>
                </div>
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Markup / Margem</span>
                  <span>{markup.toFixed(1)}% / {margem.toFixed(1)}%</span>
                </div>
              </>
            )}
          </div>
        </TabsContent>

        <TabsContent value="pagamentos" className="space-y-2">
          {pagamentos.length ? (
            pagamentos.map((pg: any) => (
              <div
                key={pg.id}
                className="border rounded-lg p-3 flex items-center justify-between"
              >
                <div>
                  <div className="font-medium">
                    Parcela {pg.parcela}/{pg.total_parcelas} · {pg.forma}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Venc: {fmtDate(pg.vencimento)}
                  </div>
                </div>
                <div className="text-right space-y-1">
                  <div className="font-medium">{formatBRL(Number(pg.valor))}</div>
                  <Badge variant="outline">
                    {pg.status}
                    {pg.pago_em ? ` · ${fmtDate(pg.pago_em)}` : ""}
                  </Badge>
                  {pg.status !== "pago" && pg.status !== "cancelado" && (
                    <div>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={marcarPago.isPending}
                        onClick={() => setBaixaPg(pg)}
                      >
                        <CheckCircle2 className="h-3 w-3 mr-1" /> Marcar recebido
                      </Button>
                    </div>
                  )}
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
          <div className="font-semibold text-base">{p.cliente?.razao_social}</div>
          <div>CNPJ: {p.cliente?.cnpj ? maskCNPJ(p.cliente.cnpj) : "—"}</div>
          <div>IE: {p.cliente?.inscricao_estadual ?? "—"}</div>
          <div>Tel: {p.cliente?.telefone ?? "—"}</div>
          <div>Email: {p.cliente?.email ?? "—"}</div>
          <div>
            Limite: {formatBRL(Number(p.cliente?.limite_credito ?? 0))} · Prazo:{" "}
            {p.cliente?.prazo_pagamento_padrao ?? "—"}d
          </div>
          <div>
            Endereço: {p.cliente?.endereco ?? "—"}
            {p.cliente?.numero ? `, ${p.cliente.numero}` : ""} ·{" "}
            {p.cliente?.cidade ?? "—"}/{p.cliente?.uf ?? "—"}
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
            <p className="text-sm text-muted-foreground">Sem histórico ainda.</p>
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

      {baixaPg && (
        <Dialog open onOpenChange={(v) => !v && setBaixaPg(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Marcar recebido</DialogTitle>
            </DialogHeader>
            <BaixaPedidoForm
              pagamento={baixaPg}
              isPending={marcarPago.isPending}
              onConfirm={(valor, forma, data) =>
                marcarPago.mutate({ pagamentoId: baixaPg.id, valor, forma, data })
              }
            />
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

function BaixaPedidoForm({ pagamento, onConfirm, isPending }: any) {
  const [forma, setForma] = useState<string>(
    pagamento.forma_recebido || pagamento.forma || "pix"
  );
  const [data, setData] = useState(new Date().toISOString().slice(0, 10));
  const hoje = new Date().toISOString().slice(0, 10);
  const saldo = Math.max(0, Number(pagamento.valor) - Number(pagamento.valor_pago || 0));
  const [valor, setValor] = useState<string>(saldo.toFixed(2));
  return (
    <div className="space-y-4">
      <div className="rounded-md border p-3 bg-muted/30 space-y-2">
        <div className="text-xs text-muted-foreground">
          Parcela {pagamento.parcela}/{pagamento.total_parcelas} · Total {formatBRL(Number(pagamento.valor))}
          {Number(pagamento.valor_pago) > 0 && <> · Já recebido {formatBRL(Number(pagamento.valor_pago))}</>}
        </div>
        <div className="space-y-1">
          <Label>Valor a receber</Label>
          <Input
            type="number"
            step="0.01"
            min="0"
            max={saldo}
            value={valor}
            onChange={(e) => setValor(e.target.value)}
          />
          <p className="text-xs text-muted-foreground">
            Saldo: {formatBRL(saldo)}. Receba o total ou um valor menor (pagamento parcial).
          </p>
        </div>
      </div>
      <div className="space-y-1">
        <Label>Forma de recebimento</Label>
        <Select value={forma} onValueChange={setForma}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="boleto">Boleto</SelectItem>
            <SelectItem value="pix">Pix</SelectItem>
            <SelectItem value="transferencia">Transferência</SelectItem>
            <SelectItem value="dinheiro">Dinheiro</SelectItem>
            <SelectItem value="cartao">Cartão</SelectItem>
            <SelectItem value="cheque">Cheque</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1">
        <Label>Data do recebimento</Label>
        <Input
          type="date"
          value={data}
          max={hoje}
          onChange={(e) => setData(e.target.value)}
        />
        <p className="text-xs text-muted-foreground">
          Use uma data passada para registrar um pagamento retroativo.
        </p>
      </div>
      <div className="flex justify-end">
        <Button onClick={() => onConfirm(Number(valor), forma, data)} disabled={isPending || !(Number(valor) > 0)}>
          <CheckCircle2 className="h-4 w-4 mr-2" /> Confirmar
        </Button>
      </div>
    </div>
  );
}

