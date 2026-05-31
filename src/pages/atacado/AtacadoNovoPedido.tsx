import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useEmpresa } from "@/contexts/EmpresaContext";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import {
  ArrowLeft,
  ArrowRight,
  Search,
  Plus,
  Trash2,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  ShoppingCart,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { formatBRL, maskCNPJ } from "@/lib/utils";

interface ItemCarrinho {
  aparelho_id: string | null;
  modelo: string;
  capacidade?: string | null;
  cor?: string | null;
  quantidade: number;
  preco_unitario: number;
  desconto_item: number;
  estoque_disponivel: number;
}

interface Parcela {
  forma: string;
  valor: number;
  vencimento: string;
}

export default function AtacadoNovoPedido() {
  const { empresaId } = useEmpresa();
  const { user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const navigate = useNavigate();

  const [passo, setPasso] = useState(1);
  const [salvando, setSalvando] = useState(false);
  const [cliente, setCliente] = useState<any>(null);
  const [buscaCliente, setBuscaCliente] = useState("");
  const [carrinho, setCarrinho] = useState<ItemCarrinho[]>([]);
  const [buscaItem, setBuscaItem] = useState("");
  const [desconto, setDesconto] = useState("");
  const [condicaoPag, setCondicaoPag] = useState("");
  const [parcelas, setParcelas] = useState<Parcela[]>([]);
  const [observacoes, setObservacoes] = useState("");

  const { data: meuFuncionario } = useQuery({
    queryKey: ["meu-funcionario", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("user_profiles")
        .select("funcionario_id")
        .eq("user_id", user!.id)
        .maybeSingle();
      return (data as any)?.funcionario_id ?? null;
    },
    enabled: !!user?.id,
  });

  const { data: clientes = [] } = useQuery({
    queryKey: ["atacado-clientes-busca", empresaId, buscaCliente],
    queryFn: async () => {
      let q = supabase
        .from("atacado_clientes" as any)
        .select(
          `id, razao_social, nome_fantasia, cnpj, limite_credito, status, condicao_pagamento_padrao,
           tabela_preco:atacado_tabelas_preco(id, nome)`,
        )
        .eq("empresa_id", empresaId!)
        .is("deleted_at", null)
        .neq("status", "bloqueado");
      if (buscaCliente) {
        q = q.or(
          `razao_social.ilike.%${buscaCliente}%,nome_fantasia.ilike.%${buscaCliente}%,cnpj.ilike.%${buscaCliente}%`,
        );
      }
      const { data } = await q.order("razao_social").limit(20);
      return (data ?? []) as any[];
    },
    enabled: !!empresaId && passo === 1,
  });

  const { data: emAberto = 0 } = useQuery({
    queryKey: ["cliente-em-aberto", cliente?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("atacado_pedidos_pagamentos" as any)
        .select(`valor, pedido:atacado_pedidos!inner(cliente_id)`)
        .eq("pedido.cliente_id", cliente!.id)
        .in("status", ["aberto", "atrasado"]);
      return (data ?? []).reduce((s: number, p: any) => s + Number(p.valor), 0);
    },
    enabled: !!cliente?.id,
  });

  const { data: estoque = [] } = useQuery({
    queryKey: ["atacado-estoque-novo-pedido", empresaId, buscaItem],
    queryFn: async () => {
      let q = supabase
        .from("atacado_aparelhos" as any)
        .select("id, modelo, capacidade, cor, quantidade, preco_sugerido, custo")
        .eq("empresa_id", empresaId!)
        .eq("status", "estoque")
        .gt("quantidade", 0)
        .is("deleted_at", null);
      if (buscaItem) q = q.ilike("modelo", `%${buscaItem}%`);
      const { data } = await q.order("modelo").limit(30);
      return (data ?? []) as any[];
    },
    enabled: !!empresaId && passo === 2,
  });

  const { data: precosTabela = [] } = useQuery({
    queryKey: ["tabela-precos-cliente", cliente?.tabela_preco?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("atacado_tabelas_preco_itens" as any)
        .select("*")
        .eq("tabela_preco_id", cliente.tabela_preco.id);
      return (data ?? []) as any[];
    },
    enabled: !!cliente?.tabela_preco?.id,
  });

  const buscarPrecoTabela = (
    modelo: string,
    capacidade: string | null | undefined,
    qtd: number,
  ): number | null => {
    const item = precosTabela.find(
      (p: any) =>
        p.modelo === modelo &&
        (p.capacidade === capacidade || p.capacidade === null),
    );
    if (!item) return null;
    if (qtd >= 10 && item.preco_minimo_qtd_10) return Number(item.preco_minimo_qtd_10);
    if (qtd >= 5 && item.preco_minimo_qtd_5) return Number(item.preco_minimo_qtd_5);
    return Number(item.preco);
  };

  const adicionarItem = (e: any) => {
    const existe = carrinho.find((c) => c.aparelho_id === e.id);
    if (existe) {
      setCarrinho((c) =>
        c.map((it) =>
          it.aparelho_id === e.id
            ? { ...it, quantidade: Math.min(it.quantidade + 1, it.estoque_disponivel) }
            : it,
        ),
      );
      return;
    }
    const precoSugerido = Number(e.preco_sugerido ?? Number(e.custo) * 1.15);
    const precoTabela = buscarPrecoTabela(e.modelo, e.capacidade, 1);
    setCarrinho((c) => [
      ...c,
      {
        aparelho_id: e.id,
        modelo: e.modelo,
        capacidade: e.capacidade,
        cor: e.cor,
        quantidade: 1,
        preco_unitario: precoTabela ?? precoSugerido,
        desconto_item: 0,
        estoque_disponivel: e.quantidade,
      },
    ]);
  };

  const atualizarQtd = (idx: number, novaQtd: number) => {
    setCarrinho((c) =>
      c.map((it, i) => {
        if (i !== idx) return it;
        const qtd = Math.max(1, Math.min(novaQtd, it.estoque_disponivel));
        const precoAjustado =
          buscarPrecoTabela(it.modelo, it.capacidade ?? null, qtd) ?? it.preco_unitario;
        return { ...it, quantidade: qtd, preco_unitario: precoAjustado };
      }),
    );
  };

  const removerItem = (idx: number) =>
    setCarrinho((c) => c.filter((_, i) => i !== idx));

  const subtotal = carrinho.reduce(
    (s, it) => s + (it.preco_unitario - it.desconto_item) * it.quantidade,
    0,
  );
  const descontoNum = parseFloat(desconto.replace(",", ".")) || 0;
  const total = subtotal - descontoNum;
  const limiteCliente = Number(cliente?.limite_credito ?? 0);
  const disponivel = Math.max(0, limiteCliente - Number(emAberto));
  const excedeLimite =
    limiteCliente > 0 && Number(emAberto) + total > limiteCliente;

  const gerarParcelas = (cond: string) => {
    setCondicaoPag(cond);
    const hoje = new Date();
    const iso = (d: Date) => d.toISOString().slice(0, 10);
    if (cond === "à vista") {
      setParcelas([{ forma: "pix", valor: total, vencimento: iso(hoje) }]);
    } else if (cond === "boleto à vista") {
      const d = new Date(hoje);
      d.setDate(d.getDate() + 3);
      setParcelas([{ forma: "boleto", valor: total, vencimento: iso(d) }]);
    } else if (cond === "30 dias") {
      const d = new Date(hoje);
      d.setDate(d.getDate() + 30);
      setParcelas([{ forma: "boleto", valor: total, vencimento: iso(d) }]);
    } else if (cond === "30/60") {
      const v = total / 2;
      setParcelas(
        [30, 60].map((dias) => {
          const dt = new Date(hoje);
          dt.setDate(dt.getDate() + dias);
          return { forma: "boleto", valor: v, vencimento: iso(dt) };
        }),
      );
    } else if (cond === "30/60/90") {
      const v = total / 3;
      setParcelas(
        [30, 60, 90].map((dias) => {
          const dt = new Date(hoje);
          dt.setDate(dt.getDate() + dias);
          return { forma: "boleto", valor: v, vencimento: iso(dt) };
        }),
      );
    }
  };

  const podeAvancar = () => {
    if (passo === 1) return !!cliente;
    if (passo === 2) return carrinho.length > 0;
    if (passo === 3)
      return (
        parcelas.length > 0 &&
        Math.abs(parcelas.reduce((s, p) => s + p.valor, 0) - total) < 0.01
      );
    return true;
  };

  const handleFinalizar = async () => {
    if (!meuFuncionario) {
      toast({ title: "Vendedor não identificado", variant: "destructive" });
      return;
    }
    setSalvando(true);
    try {
      const { data, error } = await supabase.rpc("registrar_pedido_atacado" as any, {
        p_empresa_id: empresaId,
        p_cliente_id: cliente.id,
        p_vendedor_id: meuFuncionario,
        p_itens: carrinho.map((c) => ({
          aparelho_id: c.aparelho_id,
          modelo: c.modelo,
          capacidade: c.capacidade,
          cor: c.cor,
          quantidade: c.quantidade,
          preco_unitario: c.preco_unitario,
          desconto_item: c.desconto_item,
        })),
        p_pagamentos: parcelas.map((p, i) => ({
          forma: p.forma,
          valor: p.valor,
          vencimento: p.vencimento,
          parcela: i + 1,
          total_parcelas: parcelas.length,
        })),
        p_desconto: descontoNum,
        p_condicao_pagamento: condicaoPag,
        p_observacoes: observacoes || null,
      });

      if (error) throw error;

      const pedido = (data as any)?.[0];
      toast({
        title: `✓ Pedido #P-${String(pedido.numero_pedido).padStart(6, "0")} criado`,
        description:
          pedido.status === "aguardando_aprovacao"
            ? "Excede limite — aguardando aprovação."
            : "Aprovado automaticamente.",
      });

      qc.invalidateQueries({ queryKey: ["atacado-pedidos"] });
      qc.invalidateQueries({ queryKey: ["atacado-aparelhos"] });
      qc.invalidateQueries({ queryKey: ["atacado-kpis"] });

      navigate("/atacado/pedidos");
    } catch (e: any) {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    } finally {
      setSalvando(false);
    }
  };

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Novo Pedido B2B</h1>
        <p className="text-sm text-muted-foreground">Passo {passo} de 4</p>
      </div>

      {/* Stepper */}
      <div className="flex items-center gap-2">
        {[
          { n: 1, label: "Cliente" },
          { n: 2, label: "Itens" },
          { n: 3, label: "Pagamento" },
          { n: 4, label: "Revisão" },
        ].map((p, i) => (
          <div key={p.n} className="flex items-center gap-2 flex-1">
            <div
              className={`h-9 w-9 rounded-full flex items-center justify-center text-sm font-semibold ${
                passo > p.n
                  ? "bg-warning text-warning-foreground"
                  : passo === p.n
                    ? "bg-warning/15 text-warning border-2 border-warning"
                    : "bg-muted text-muted-foreground"
              }`}
            >
              {passo > p.n ? <CheckCircle2 className="h-4 w-4" /> : p.n}
            </div>
            <span className="text-sm font-medium hidden sm:inline">{p.label}</span>
            {i < 3 && (
              <div
                className={`flex-1 h-0.5 ${passo > p.n ? "bg-warning" : "bg-muted"}`}
              />
            )}
          </div>
        ))}
      </div>

      {/* Passo 1 — Cliente */}
      {passo === 1 && (
        <div className="bg-card border rounded-lg p-5 space-y-4">
          <h2 className="font-semibold">Selecione o cliente B2B</h2>
          <div className="relative">
            <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar por razão social, fantasia ou CNPJ"
              value={buscaCliente}
              onChange={(e) => setBuscaCliente(e.target.value)}
              autoFocus
              className="pl-9"
            />
          </div>
          <div className="space-y-2 max-h-[460px] overflow-auto">
            {clientes.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                Nenhum cliente encontrado.
              </p>
            ) : (
              clientes.map((c: any) => (
                <button
                  key={c.id}
                  onClick={() => setCliente(c)}
                  className={`w-full text-left p-3 rounded-lg border transition-all ${
                    cliente?.id === c.id
                      ? "bg-warning/10 border-warning"
                      : "hover:bg-muted/40 border-transparent"
                  }`}
                >
                  <div className="flex justify-between items-start gap-3">
                    <div className="min-w-0">
                      <p className="font-semibold truncate">
                        {c.nome_fantasia || c.razao_social}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {c.cnpj ? maskCNPJ(c.cnpj) : "—"} ·{" "}
                        {c.tabela_preco?.nome ?? "sem tabela"}
                      </p>
                    </div>
                    {c.limite_credito > 0 && (
                      <div className="text-right shrink-0">
                        <p className="text-[10px] uppercase text-muted-foreground">
                          Limite
                        </p>
                        <p className="text-sm font-semibold tabular-nums">
                          {formatBRL(Number(c.limite_credito))}
                        </p>
                      </div>
                    )}
                  </div>
                </button>
              ))
            )}
          </div>
          {cliente && (
            <div className="bg-muted/40 rounded-md p-3 text-sm flex items-center justify-between">
              <div>
                <Badge variant="secondary">Selecionado</Badge>{" "}
                <span className="font-medium">
                  {cliente.nome_fantasia || cliente.razao_social}
                </span>
              </div>
              {limiteCliente > 0 && (
                <span className="text-xs text-muted-foreground">
                  Em aberto: {formatBRL(Number(emAberto))} · Disponível:{" "}
                  {formatBRL(disponivel)}
                </span>
              )}
            </div>
          )}
        </div>
      )}

      {/* Passo 2 — Itens */}
      {passo === 2 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="bg-card border rounded-lg p-4 space-y-3">
            <h3 className="font-semibold">Estoque disponível</h3>
            <div className="relative">
              <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Buscar modelo..."
                value={buscaItem}
                onChange={(e) => setBuscaItem(e.target.value)}
                className="pl-9"
              />
            </div>
            <div className="space-y-1 max-h-[460px] overflow-auto">
              {estoque.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6">
                  Sem estoque disponível.
                </p>
              ) : (
                estoque.map((e: any) => {
                  const precoTab = buscarPrecoTabela(e.modelo, e.capacidade, 1);
                  return (
                    <button
                      key={e.id}
                      onClick={() => adicionarItem(e)}
                      className="w-full p-2.5 hover:bg-muted/40 rounded-md text-left flex items-center justify-between gap-2 border border-transparent hover:border-muted"
                    >
                      <div className="min-w-0">
                        <p className="font-medium text-sm truncate">
                          {e.modelo} {e.capacidade ?? ""} {e.cor ?? ""}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {e.quantidade} disp ·{" "}
                          {formatBRL(precoTab ?? Number(e.preco_sugerido ?? e.custo))}
                        </p>
                      </div>
                      <Plus className="h-4 w-4 text-warning shrink-0" />
                    </button>
                  );
                })
              )}
            </div>
          </div>

          <div className="bg-card border rounded-lg p-4 space-y-3">
            <h3 className="font-semibold flex items-center gap-2">
              <ShoppingCart className="h-4 w-4" /> Carrinho ({carrinho.length})
            </h3>
            {carrinho.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-10">
                Clique nos itens do estoque para adicionar
              </p>
            ) : (
              <div className="space-y-3">
                {carrinho.map((it, idx) => (
                  <div key={idx} className="border rounded-md p-3 space-y-2">
                    <div className="flex justify-between items-start gap-2">
                      <div className="min-w-0">
                        <p className="font-medium text-sm truncate">
                          {it.modelo} {it.capacidade ?? ""}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {it.cor ?? ""}
                        </p>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => removerItem(idx)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <Label className="text-xs">Qtd</Label>
                        <Input
                          type="number"
                          min={1}
                          max={it.estoque_disponivel}
                          value={it.quantidade}
                          onChange={(e) =>
                            atualizarQtd(idx, parseInt(e.target.value) || 1)
                          }
                          className="h-8 text-sm"
                        />
                      </div>
                      <div>
                        <Label className="text-xs">Preço unit.</Label>
                        <Input
                          value={it.preco_unitario}
                          onChange={(e) => {
                            const v = parseFloat(e.target.value.replace(",", ".")) || 0;
                            setCarrinho((c) =>
                              c.map((x, i) =>
                                i === idx ? { ...x, preco_unitario: v } : x,
                              ),
                            );
                          }}
                          className="h-8 text-sm tabular-nums"
                        />
                      </div>
                    </div>
                    <p className="text-xs text-right text-muted-foreground tabular-nums">
                      Subtotal: {formatBRL(it.preco_unitario * it.quantidade)}
                    </p>
                  </div>
                ))}

                <div className="border-t pt-3 space-y-2">
                  <div className="flex items-center justify-between gap-3">
                    <Label className="text-sm">Desconto geral (R$)</Label>
                    <Input
                      value={desconto}
                      onChange={(e) => setDesconto(e.target.value)}
                      placeholder="0,00"
                      className="h-8 w-32 text-sm tabular-nums"
                    />
                  </div>
                  <div className="flex items-center justify-between font-semibold">
                    <span>Total</span>
                    <span className="text-lg tabular-nums">{formatBRL(total)}</span>
                  </div>
                  {excedeLimite && (
                    <div className="text-xs bg-warning/10 border border-warning/30 rounded p-2 flex gap-2 text-warning">
                      <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                      <span>
                        Excede limite ({formatBRL(disponivel)} disponível). Vai pra
                        aprovação.
                      </span>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Passo 3 — Pagamento */}
      {passo === 3 && (
        <div className="bg-card border rounded-lg p-5 space-y-4">
          <h2 className="font-semibold">Condição de pagamento</h2>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
            {["à vista", "boleto à vista", "30 dias", "30/60", "30/60/90"].map(
              (opt) => (
                <button
                  key={opt}
                  onClick={() => gerarParcelas(opt)}
                  className={`p-3 rounded-md border text-sm transition-all ${
                    condicaoPag === opt
                      ? "bg-warning/10 border-warning text-warning font-semibold"
                      : "border-border hover:border-warning/50"
                  }`}
                >
                  {opt}
                </button>
              ),
            )}
          </div>

          {parcelas.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-sm font-semibold">Parcelas geradas</h3>
              {parcelas.map((p, i) => (
                <div
                  key={i}
                  className="grid grid-cols-12 gap-2 items-end border rounded-md p-3"
                >
                  <div className="col-span-1 text-sm font-semibold pb-2">
                    #{i + 1}
                  </div>
                  <div className="col-span-4">
                    <Label className="text-xs">Forma</Label>
                    <Select
                      value={p.forma}
                      onValueChange={(v) =>
                        setParcelas((ps) =>
                          ps.map((x, idx) => (idx === i ? { ...x, forma: v } : x)),
                        )
                      }
                    >
                      <SelectTrigger className="h-9">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="boleto">Boleto</SelectItem>
                        <SelectItem value="pix">Pix</SelectItem>
                        <SelectItem value="transferencia">Transferência</SelectItem>
                        <SelectItem value="dinheiro">Dinheiro</SelectItem>
                        <SelectItem value="cheque">Cheque</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="col-span-4">
                    <Label className="text-xs">Vencimento</Label>
                    <Input
                      type="date"
                      value={p.vencimento}
                      onChange={(e) =>
                        setParcelas((ps) =>
                          ps.map((x, idx) =>
                            idx === i ? { ...x, vencimento: e.target.value } : x,
                          ),
                        )
                      }
                      className="h-9"
                    />
                  </div>
                  <div className="col-span-3">
                    <Label className="text-xs">Valor</Label>
                    <Input
                      value={p.valor}
                      onChange={(e) => {
                        const v = parseFloat(e.target.value.replace(",", ".")) || 0;
                        setParcelas((ps) =>
                          ps.map((x, idx) => (idx === i ? { ...x, valor: v } : x)),
                        );
                      }}
                      className="h-9 tabular-nums"
                    />
                  </div>
                </div>
              ))}
              <div className="text-sm pt-2 flex justify-between">
                <span className="text-muted-foreground">Soma:</span>
                <span>
                  <span
                    className={`font-semibold tabular-nums ${
                      Math.abs(
                        parcelas.reduce((s, p) => s + p.valor, 0) - total,
                      ) < 0.01
                        ? "text-success"
                        : "text-destructive"
                    }`}
                  >
                    {formatBRL(parcelas.reduce((s, p) => s + p.valor, 0))}
                  </span>{" "}
                  <span className="text-muted-foreground">/ {formatBRL(total)}</span>
                </span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Passo 4 — Revisão */}
      {passo === 4 && (
        <div className="bg-card border rounded-lg p-5 space-y-4">
          <h2 className="font-semibold">Revise antes de criar</h2>

          <div className="border rounded-md p-3 space-y-1">
            <p className="text-xs uppercase text-muted-foreground">Cliente</p>
            <p className="font-medium">
              {cliente?.nome_fantasia || cliente?.razao_social}
            </p>
            <p className="text-xs text-muted-foreground">
              {cliente?.cnpj ? maskCNPJ(cliente.cnpj) : "—"}
            </p>
          </div>

          <div className="border rounded-md p-3">
            <p className="text-xs uppercase text-muted-foreground mb-2">
              Itens ({carrinho.length})
            </p>
            <div className="space-y-1 text-sm">
              {carrinho.map((it, i) => (
                <div key={i} className="flex justify-between">
                  <span>
                    {it.quantidade}× {it.modelo} {it.capacidade ?? ""}
                  </span>
                  <span className="tabular-nums">
                    {formatBRL(it.preco_unitario * it.quantidade)}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="border rounded-md p-3 space-y-1 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Subtotal</span>
              <span className="tabular-nums">{formatBRL(subtotal)}</span>
            </div>
            {descontoNum > 0 && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Desconto</span>
                <span className="tabular-nums">- {formatBRL(descontoNum)}</span>
              </div>
            )}
            <div className="flex justify-between font-bold pt-1 border-t">
              <span>Total</span>
              <span className="tabular-nums">{formatBRL(total)}</span>
            </div>
          </div>

          <div className="border rounded-md p-3">
            <p className="text-xs uppercase text-muted-foreground mb-2">
              Pagamento ({condicaoPag})
            </p>
            <div className="space-y-1 text-sm">
              {parcelas.map((p, i) => (
                <div key={i} className="flex justify-between">
                  <span>
                    #{i + 1} {p.forma} · venc{" "}
                    {new Date(p.vencimento + "T00:00:00").toLocaleDateString("pt-BR")}
                  </span>
                  <span className="tabular-nums">{formatBRL(p.valor)}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-1">
            <Label className="text-sm">Observações</Label>
            <Textarea
              value={observacoes}
              onChange={(e) => setObservacoes(e.target.value)}
              placeholder="Entrega, observações fiscais..."
              rows={3}
            />
          </div>

          {excedeLimite && (
            <div className="bg-warning/10 border border-warning/30 rounded p-3 text-sm flex gap-2">
              <AlertTriangle className="h-4 w-4 text-warning shrink-0 mt-0.5" />
              <div>
                <strong>Pedido vai pra aprovação</strong> porque excede o limite do
                cliente. Disponível: {formatBRL(disponivel)} · Total pedido:{" "}
                {formatBRL(total)}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Navegação */}
      <div className="flex items-center justify-between border-t pt-4">
        <Button
          variant="ghost"
          onClick={() => setPasso(Math.max(1, passo - 1))}
          disabled={passo === 1 || salvando}
        >
          <ArrowLeft className="h-4 w-4 mr-1" /> Voltar
        </Button>

        {passo < 4 ? (
          <Button onClick={() => setPasso(passo + 1)} disabled={!podeAvancar()}>
            Avançar <ArrowRight className="h-4 w-4 ml-1" />
          </Button>
        ) : (
          <Button onClick={handleFinalizar} disabled={salvando || carrinho.length === 0}>
            {salvando ? (
              <>
                <Loader2 className="h-4 w-4 mr-1 animate-spin" /> Criando...
              </>
            ) : (
              "✓ Criar pedido"
            )}
          </Button>
        )}
      </div>
    </div>
  );
}
