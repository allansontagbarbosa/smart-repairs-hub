import { useState, useMemo, useEffect, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEmpresa } from "@/contexts/EmpresaContext";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
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
import { Card } from "@/components/ui/card";
import {
  CheckCircle2,
  ArrowRight,
  ArrowLeft,
  Plus,
  Trash2,
  Search,
  AlertTriangle,
  Loader2,
  Building2,
  Package,
  CreditCard,
  FileCheck,
} from "lucide-react";
import { formatBRL, maskCNPJ } from "@/lib/utils";
import { NovoClienteAtacadoDialog } from "@/components/atacado/NovoClienteAtacadoDialog";

type Passo = 1 | 2 | 3 | 4;

interface ItemCarrinho {
  aparelho_id: string;
  modelo: string;
  capacidade?: string | null;
  cor?: string | null;
  quantidade: number;
  preco_unitario: number;
  estoque_disponivel: number;
}

interface Pagamento {
  forma: string;
  valor: number;
  vencimento?: string;
  parcela: number;
  total_parcelas: number;
}

export default function AtacadoNovoPedido() {
  const { empresaId } = useEmpresa();
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const aparelhoPreselectId = searchParams.get("aparelho");

  const [passo, setPasso] = useState<Passo>(1);
  const [clienteId, setClienteId] = useState("");
  const [buscaCliente, setBuscaCliente] = useState("");
  const [novoClienteOpen, setNovoClienteOpen] = useState(false);
  const [carrinho, setCarrinho] = useState<ItemCarrinho[]>([]);
  const [buscaItem, setBuscaItem] = useState("");
  const [condicaoPagamento, setCondicaoPagamento] = useState("30 dias");
  const [pagamentos, setPagamentos] = useState<Pagamento[]>([]);
  const [customNumParcelas, setCustomNumParcelas] = useState(2);
  const [customEntrada, setCustomEntrada] = useState(0);
  const [desconto, setDesconto] = useState("0");
  const [observacoes, setObservacoes] = useState("");
  const [dataPedido, setDataPedido] = useState<string>(new Date().toISOString().slice(0, 10));
  const [salvando, setSalvando] = useState(false);
  const preselectAppliedRef = useRef(false);

  // Clientes
  const { data: clientes = [] } = useQuery({
    queryKey: ["atacado-clientes-wizard", empresaId, buscaCliente],
    queryFn: async () => {
      let q = supabase
        .from("atacado_clientes" as any)
        .select(
          "id, razao_social, nome_fantasia, cnpj, limite_credito, prazo_pagamento_padrao, condicao_pagamento_padrao, status, tabela_preco_id",
        )
        .eq("empresa_id", empresaId!)
        .is("deleted_at", null);
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

  const clienteSelecionado = useMemo(
    () => clientes.find((c: any) => c.id === clienteId),
    [clientes, clienteId],
  );

  const { data: aparelhos = [] } = useQuery({
    queryKey: [
      "atacado-aparelhos-wizard",
      empresaId,
      buscaItem,
      clienteSelecionado?.tabela_preco_id,
    ],
    queryFn: async () => {
      // Robusto: pega TODOS os nomes de status da categoria "em_estoque" da empresa
      const { data: statusRows } = await supabase
        .from("atacado_status_aparelho" as any)
        .select("nome,categoria")
        .eq("empresa_id", empresaId!)
        .eq("categoria", "em_estoque");
      const nomesEstoque = Array.from(
        new Set([
          "estoque",
          ...(((statusRows as any[]) ?? []).map((s) => s.nome).filter(Boolean)),
        ]),
      );

      let q = supabase
        .from("atacado_aparelhos" as any)
        .select("*")
        .eq("empresa_id", empresaId!)
        .in("status", nomesEstoque)
        .gt("quantidade", 0)
        .is("deleted_at", null);
      if (buscaItem) {
        const termo = buscaItem.trim();
        q = q.or(
          `modelo.ilike.%${termo}%,imei_1.ilike.%${termo}%,imei_2.ilike.%${termo}%`,
        );
      }
      const { data: aps } = await q.order("modelo");

      if (!clienteSelecionado?.tabela_preco_id) return (aps ?? []) as any[];

      const { data: itens } = await supabase
        .from("atacado_tabelas_preco_itens" as any)
        .select("modelo, capacidade, preco, preco_minimo_qtd_5, preco_minimo_qtd_10")
        .eq("tabela_preco_id", clienteSelecionado.tabela_preco_id);

      return ((aps ?? []) as any[]).map((a: any) => {
        const itemTabela = (itens as any[])?.find(
          (i: any) =>
            i.modelo === a.modelo && (i.capacidade === a.capacidade || !i.capacidade),
        );
        return {
          ...a,
          preco_tabela: itemTabela?.preco ?? a.preco_sugerido,
          preco_5: itemTabela?.preco_minimo_qtd_5,
          preco_10: itemTabela?.preco_minimo_qtd_10,
        };
      });
    },
    enabled: !!empresaId && passo === 2,
  });

  const calcPreco = (aparelho: any, qtd: number): number => {
    if (qtd >= 10 && aparelho.preco_10) return Number(aparelho.preco_10);
    if (qtd >= 5 && aparelho.preco_5) return Number(aparelho.preco_5);
    return Number(
      aparelho.preco_tabela ?? aparelho.preco_sugerido ?? aparelho.custo ?? 0,
    );
  };

  const adicionarItem = (aparelho: any) => {
    const existente = carrinho.find((c) => c.aparelho_id === aparelho.id);
    if (existente) {
      atualizarQtd(aparelho.id, existente.quantidade + 1);
      return;
    }
    setCarrinho((cur) => [
      ...cur,
      {
        aparelho_id: aparelho.id,
        modelo: aparelho.modelo,
        capacidade: aparelho.capacidade,
        cor: aparelho.cor,
        quantidade: 1,
        preco_unitario: calcPreco(aparelho, 1),
        estoque_disponivel: aparelho.quantidade,
      },
    ]);
  };

  // Pré-seleciona o aparelho vindo de "Vender / dar baixa" no Estoque (uma vez)
  useEffect(() => {
    if (!empresaId || !aparelhoPreselectId || preselectAppliedRef.current) return;
    preselectAppliedRef.current = true;
    (async () => {
      const { data } = await supabase
        .from("atacado_aparelhos" as any)
        .select("*")
        .eq("id", aparelhoPreselectId)
        .eq("empresa_id", empresaId)
        .maybeSingle();
      if (data) {
        adicionarItem({
          ...(data as any),
          preco_tabela: (data as any).preco_sugerido,
        });
        toast({ title: "Aparelho adicionado ao pedido" });
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [empresaId, aparelhoPreselectId]);


  const atualizarQtd = (aparelhoId: string, novaQtd: number) => {
    setCarrinho(
      carrinho.map((c) => {
        if (c.aparelho_id !== aparelhoId) return c;
        const aparelho = (aparelhos as any[]).find((a: any) => a.id === aparelhoId);
        const qtd = Math.max(1, Math.min(novaQtd, c.estoque_disponivel));
        return {
          ...c,
          quantidade: qtd,
          preco_unitario: aparelho ? calcPreco(aparelho, qtd) : c.preco_unitario,
        };
      }),
    );
  };

  const removerItem = (aparelhoId: string) =>
    setCarrinho(carrinho.filter((c) => c.aparelho_id !== aparelhoId));

  const subtotal = carrinho.reduce((s, c) => s + c.quantidade * c.preco_unitario, 0);
  const descontoNum = parseFloat(desconto.replace(",", ".")) || 0;
  const total = Math.max(0, subtotal - descontoNum);

  const gerarPagamentos = (cond?: string) => {
    const c = cond ?? condicaoPagamento;
    const hoje = new Date();
    const iso = (d: Date) => d.toISOString().slice(0, 10);
    const addDias = (n: number) => {
      const d = new Date(hoje);
      d.setDate(d.getDate() + n);
      return iso(d);
    };
    if (c === "à vista") {
      setPagamentos([{ forma: "pix", valor: total, vencimento: iso(hoje), parcela: 1, total_parcelas: 1 }]);
    } else if (c === "30 dias") {
      setPagamentos([{ forma: "boleto", valor: total, vencimento: addDias(30), parcela: 1, total_parcelas: 1 }]);
    } else if (c === "30/60") {
      const meio = +(total / 2).toFixed(2);
      setPagamentos([
        { forma: "boleto", valor: meio, vencimento: addDias(30), parcela: 1, total_parcelas: 2 },
        { forma: "boleto", valor: +(total - meio).toFixed(2), vencimento: addDias(60), parcela: 2, total_parcelas: 2 },
      ]);
    } else if (c === "30/60/90") {
      const terco = +(total / 3).toFixed(2);
      setPagamentos([
        { forma: "boleto", valor: terco, vencimento: addDias(30), parcela: 1, total_parcelas: 3 },
        { forma: "boleto", valor: terco, vencimento: addDias(60), parcela: 2, total_parcelas: 3 },
        { forma: "boleto", valor: +(total - terco * 2).toFixed(2), vencimento: addDias(90), parcela: 3, total_parcelas: 3 },
      ]);
    } else if (c === "2x") {
      const meio = +(total / 2).toFixed(2);
      setPagamentos([
        { forma: "boleto", valor: meio, vencimento: iso(hoje), parcela: 1, total_parcelas: 2 },
        { forma: "boleto", valor: +(total - meio).toFixed(2), vencimento: addDias(30), parcela: 2, total_parcelas: 2 },
      ]);
    } else if (c === "3x") {
      const terco = +(total / 3).toFixed(2);
      setPagamentos([
        { forma: "boleto", valor: terco, vencimento: iso(hoje), parcela: 1, total_parcelas: 3 },
        { forma: "boleto", valor: terco, vencimento: addDias(30), parcela: 2, total_parcelas: 3 },
        { forma: "boleto", valor: +(total - terco * 2).toFixed(2), vencimento: addDias(60), parcela: 3, total_parcelas: 3 },
      ]);
    } else if (c === "customizar") {
      // não regenera — usa o builder
      if (pagamentos.length === 0) {
        setPagamentos([{ forma: "boleto", valor: total, vencimento: addDias(30), parcela: 1, total_parcelas: 1 }]);
      }
    }
  };

  const gerarCustomizado = (n: number, entrada: number) => {
    const hoje = new Date();
    const iso = (d: Date) => d.toISOString().slice(0, 10);
    const addDias = (k: number) => {
      const d = new Date(hoje);
      d.setDate(d.getDate() + k);
      return iso(d);
    };
    const entradaVal = Math.max(0, Math.min(entrada, total));
    const restante = +(total - entradaVal).toFixed(2);
    const parcelas: Pagamento[] = [];
    const totalParc = entradaVal > 0 ? n + 1 : n;
    let idx = 1;
    if (entradaVal > 0) {
      parcelas.push({ forma: "pix", valor: entradaVal, vencimento: iso(hoje), parcela: idx++, total_parcelas: totalParc });
    }
    if (n > 0 && restante > 0) {
      const cota = +(restante / n).toFixed(2);
      let acc = 0;
      for (let i = 1; i <= n; i++) {
        const v = i === n ? +(restante - acc).toFixed(2) : cota;
        acc += cota;
        parcelas.push({ forma: "boleto", valor: v, vencimento: addDias(30 * i), parcela: idx++, total_parcelas: totalParc });
      }
    }
    setPagamentos(parcelas);
  };

  const atualizarPagamento = (idx: number, patch: Partial<Pagamento>) => {
    setPagamentos((cur) => cur.map((p, i) => (i === idx ? { ...p, ...patch } : p)));
  };
  const removerPagamento = (idx: number) => {
    setPagamentos((cur) =>
      cur
        .filter((_, i) => i !== idx)
        .map((p, i, arr) => ({ ...p, parcela: i + 1, total_parcelas: arr.length })),
    );
  };
  const adicionarPagamento = () => {
    setPagamentos((cur) => {
      const next = [...cur, { forma: "boleto", valor: 0, vencimento: new Date().toISOString().slice(0, 10), parcela: cur.length + 1, total_parcelas: cur.length + 1 }];
      return next.map((p, i, arr) => ({ ...p, parcela: i + 1, total_parcelas: arr.length }));
    });
  };

  const somaPagamentos = pagamentos.reduce((s, p) => s + Number(p.valor || 0), 0);
  const diferenca = +(total - somaPagamentos).toFixed(2);

  const handleProximo = () => {
    if (passo === 1 && !clienteId) {
      toast({ title: "Selecione um cliente", variant: "destructive" });
      return;
    }
    if (passo === 2 && carrinho.length === 0) {
      toast({ title: "Adicione ao menos 1 item", variant: "destructive" });
      return;
    }
    if (passo === 3) {
      if (pagamentos.length === 0) {
        gerarPagamentos();
        return;
      }
      if (Math.abs(diferenca) > 0.01) {
        toast({
          title: "Soma das parcelas não bate com o total",
          description: `Diferença de ${formatBRL(diferenca)}`,
          variant: "destructive",
        });
        return;
      }
      const hojeISO = new Date().toISOString().slice(0, 10);
      if (pagamentos.some((p) => p.vencimento && p.vencimento < hojeISO)) {
        toast({ title: "Vencimento anterior à data do pedido", variant: "destructive" });
        return;
      }
    }
    setPasso(Math.min(4, passo + 1) as Passo);
  };

  const handleVoltar = () => setPasso(Math.max(1, passo - 1) as Passo);

  const handleFinalizar = async () => {
    setSalvando(true);
    try {
      const { data: profile } = await supabase
        .from("user_profiles")
        .select("funcionario_id")
        .eq("user_id", user!.id)
        .maybeSingle();

      const payload = {
        empresa_id: empresaId,
        cliente_id: clienteId,
        vendedor_id: (profile as any)?.funcionario_id,
        subtotal,
        desconto: descontoNum,
        condicao_pagamento: condicaoPagamento,
        observacoes,
        origem: "manual",
        itens: carrinho.map((c) => ({
          aparelho_id: c.aparelho_id,
          modelo: c.modelo,
          capacidade: c.capacidade,
          cor: c.cor,
          quantidade: c.quantidade,
          preco_unitario: c.preco_unitario,
          desconto_item: 0,
          total_item: c.quantidade * c.preco_unitario,
        })),
        pagamentos,
      };

      const { data, error } = await supabase.rpc(
        "registrar_pedido_atacado" as any,
        { p_payload: payload as any },
      );
      if (error) throw error;

      const result = (data as any)?.[0];
      const numero = String(result?.numero_pedido).padStart(6, "0");
      const status = result?.status_final;

      toast({
        title: `✓ Pedido #P-${numero} criado`,
        description:
          status === "aguardando_aprovacao"
            ? "Aguardando aprovação por exceder limite ou cliente inadimplente"
            : "Pedido aprovado!",
      });
      navigate(`/atacado/pedidos`);
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
        <p className="text-sm text-muted-foreground">
          Cliente → Itens → Pagamento → Revisão
        </p>
      </div>

      {/* Stepper */}
      <div className="flex items-center gap-2">
        {[
          { n: 1, label: "Cliente", icon: Building2 },
          { n: 2, label: "Itens", icon: Package },
          { n: 3, label: "Pagamento", icon: CreditCard },
          { n: 4, label: "Revisão", icon: FileCheck },
        ].map((s, i) => {
          const Icon = s.icon;
          const ativo = passo === s.n;
          const completo = passo > s.n;
          return (
            <div key={s.n} className="flex items-center gap-2 flex-1">
              <div className="flex items-center gap-2">
                <div
                  className={`h-10 w-10 rounded-full flex items-center justify-center transition-all ${
                    completo
                      ? "bg-warning text-warning-foreground"
                      : ativo
                        ? "bg-warning/15 text-warning border-2 border-warning"
                        : "bg-muted text-muted-foreground"
                  }`}
                >
                  {completo ? <CheckCircle2 className="h-5 w-5" /> : <Icon className="h-5 w-5" />}
                </div>
                <span
                  className={`text-sm font-medium hidden sm:inline ${ativo ? "text-foreground" : "text-muted-foreground"}`}
                >
                  {s.label}
                </span>
              </div>
              {i < 3 && (
                <div
                  className={`flex-1 h-0.5 ${completo ? "bg-warning" : "bg-muted"}`}
                />
              )}
            </div>
          );
        })}
      </div>

      {/* PASSO 1: CLIENTE */}
      {passo === 1 && (
        <Card className="p-6 space-y-4">
          <h2 className="font-bold">1. Selecione o cliente B2B</h2>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Buscar razão social, fantasia ou CNPJ"
                className="pl-9"
                value={buscaCliente}
                onChange={(e) => setBuscaCliente(e.target.value)}
              />
            </div>
            <Button variant="outline" onClick={() => setNovoClienteOpen(true)}>
              <Plus className="h-4 w-4 mr-1" /> Novo cliente
            </Button>
          </div>

          {clientes.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              Nenhum cliente encontrado.
            </p>
          ) : (
            <div className="space-y-2 max-h-[460px] overflow-auto">
              {clientes.map((c: any) => {
                const selecionado = clienteId === c.id;
                return (
                  <button
                    key={c.id}
                    onClick={() => setClienteId(c.id)}
                    disabled={c.status === "bloqueado"}
                    className={`w-full text-left p-3 rounded-lg border transition-all ${
                      selecionado
                        ? "border-warning bg-warning/10"
                        : "border-border hover:border-warning/50"
                    } ${c.status === "bloqueado" ? "opacity-50 cursor-not-allowed" : ""}`}
                  >
                    <div className="flex justify-between items-start gap-3">
                      <div className="min-w-0">
                        <p className="font-semibold truncate">
                          {c.nome_fantasia || c.razao_social}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {c.cnpj ? maskCNPJ(c.cnpj) : "sem CNPJ"} ·{" "}
                          {c.condicao_pagamento_padrao ?? "à vista"}
                        </p>
                      </div>
                      <div className="text-right shrink-0 space-y-1">
                        {c.limite_credito > 0 && (
                          <p className="text-xs text-muted-foreground">
                            Limite: {formatBRL(Number(c.limite_credito))}
                          </p>
                        )}
                        <Badge
                          variant={
                            c.status === "ativo"
                              ? "secondary"
                              : c.status === "inadimplente"
                                ? "destructive"
                                : "outline"
                          }
                        >
                          {c.status}
                        </Badge>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </Card>
      )}

      {/* PASSO 2: ITENS */}
      {passo === 2 && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <Card className="p-4 space-y-3 lg:col-span-2">
            <h2 className="font-bold">2. Adicionar itens</h2>
            <div className="relative">
              <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Buscar por modelo ou IMEI..."
                className="pl-9"
                value={buscaItem}
                onChange={(e) => setBuscaItem(e.target.value)}
              />
            </div>
            {!clienteSelecionado?.tabela_preco_id && (
              <p className="text-xs text-muted-foreground bg-muted/40 border border-border rounded p-2">
                Cliente sem tabela de preço — usando preço sugerido como fallback.
              </p>
            )}
            <div className="space-y-2 max-h-[480px] overflow-auto">
              {(aparelhos as any[]).map((a: any) => {
                const preco = Number(a.preco_tabela ?? a.preco_sugerido ?? a.custo ?? 0);
                const lucro = preco - Number(a.custo ?? 0);
                return (
                  <button
                    key={a.id}
                    onClick={() => adicionarItem(a)}
                    className="w-full text-left p-3 bg-card border hover:border-warning rounded-lg transition-colors"
                  >
                    <div className="flex justify-between items-start gap-3">
                      <div className="min-w-0">
                        <p className="font-medium text-sm truncate">
                          {a.modelo} {a.capacidade ?? ""} {a.cor ?? ""}
                        </p>
                        <div className="flex flex-wrap gap-2 text-xs text-muted-foreground mt-1">
                          {a.imei_1 && (
                            <span className="font-mono">IMEI {a.imei_1}</span>
                          )}
                          <span>Estoque: {a.quantidade}</span>
                          {a.preco_5 && <span>5+: {formatBRL(Number(a.preco_5))}</span>}
                          {a.preco_10 && <span>10+: {formatBRL(Number(a.preco_10))}</span>}
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="font-semibold text-warning tabular-nums">
                          {formatBRL(preco)}
                        </p>
                        {lucro > 0 && (
                          <p className="text-[11px] text-success tabular-nums">
                            +{formatBRL(lucro)} lucro
                          </p>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })}
              {(aparelhos as any[]).length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-6">
                  Nenhum aparelho disponível.
                </p>
              )}
            </div>
          </Card>

          <Card className="p-4 space-y-3">
            <h3 className="font-semibold">Carrinho ({carrinho.length})</h3>
            {carrinho.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-10">Vazio</p>
            ) : (
              <>
                <div className="space-y-3 max-h-[400px] overflow-auto">
                  {carrinho.map((c) => (
                    <div key={c.aparelho_id} className="border rounded-md p-2 space-y-2">
                      <div className="flex justify-between items-start gap-2">
                        <p className="font-medium text-sm truncate">
                          {c.modelo} {c.capacidade ?? ""}
                        </p>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          onClick={() => removerItem(c.aparelho_id)}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                      <div className="flex justify-between items-center gap-2">
                        <div className="flex items-center gap-1">
                          <Button
                            variant="outline"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => atualizarQtd(c.aparelho_id, c.quantidade - 1)}
                          >
                            −
                          </Button>
                          <Input
                            type="number"
                            min={1}
                            max={c.estoque_disponivel}
                            value={c.quantidade}
                            onChange={(e) =>
                              atualizarQtd(c.aparelho_id, parseInt(e.target.value) || 1)
                            }
                            className="h-7 w-12 text-center text-sm"
                          />
                          <Button
                            variant="outline"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => atualizarQtd(c.aparelho_id, c.quantidade + 1)}
                          >
                            +
                          </Button>
                        </div>
                        <strong className="text-sm tabular-nums">
                          {formatBRL(c.quantidade * c.preco_unitario)}
                        </strong>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {formatBRL(c.preco_unitario)} × {c.quantidade}
                      </p>
                    </div>
                  ))}
                </div>
                <div className="flex justify-between font-semibold pt-3 border-t">
                  <span>Subtotal</span>
                  <span className="tabular-nums">{formatBRL(subtotal)}</span>
                </div>
              </>
            )}
          </Card>
        </div>
      )}

      {/* PASSO 3: PAGAMENTO */}
      {passo === 3 && (
        <Card className="p-6 space-y-4">
          <h2 className="font-bold">3. Condição de pagamento</h2>
          <div className="space-y-4">
            <div className="space-y-1">
              <Label>Atalho</Label>
              <Select
                value={condicaoPagamento}
                onValueChange={(v) => {
                  setCondicaoPagamento(v);
                  if (v !== "customizar") {
                    setPagamentos([]);
                    gerarPagamentos(v);
                  } else {
                    gerarPagamentos("customizar");
                  }
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="à vista">À vista (Pix)</SelectItem>
                  <SelectItem value="30 dias">30 dias (boleto)</SelectItem>
                  <SelectItem value="30/60">30/60 dias</SelectItem>
                  <SelectItem value="30/60/90">30/60/90 dias</SelectItem>
                  <SelectItem value="2x">2x sem entrada</SelectItem>
                  <SelectItem value="3x">3x sem entrada</SelectItem>
                  <SelectItem value="customizar">Customizar parcelamento</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label>Desconto (R$)</Label>
              <Input
                value={desconto}
                onChange={(e) => setDesconto(e.target.value)}
                placeholder="0,00"
                className="tabular-nums"
              />
            </div>

            <div className="space-y-1">
              <Label>Observações</Label>
              <Textarea
                value={observacoes}
                onChange={(e) => setObservacoes(e.target.value)}
                placeholder="Entrega, condições fiscais..."
                rows={3}
              />
            </div>

            {condicaoPagamento === "customizar" && (
              <Card className="p-4 space-y-3 bg-muted/20">
                <h3 className="text-sm font-semibold">Construtor de parcelamento</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">Nº de parcelas (sem entrada)</Label>
                    <Input
                      type="number"
                      min={1}
                      value={customNumParcelas}
                      onChange={(e) => setCustomNumParcelas(Math.max(1, parseInt(e.target.value) || 1))}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Entrada (R$)</Label>
                    <Input
                      type="number"
                      min={0}
                      step="0.01"
                      value={customEntrada}
                      onChange={(e) => setCustomEntrada(Math.max(0, parseFloat(e.target.value) || 0))}
                    />
                  </div>
                  <div className="flex items-end">
                    <Button
                      variant="outline"
                      className="w-full"
                      onClick={() => gerarCustomizado(customNumParcelas, customEntrada)}
                    >
                      Gerar
                    </Button>
                  </div>
                </div>
                <Button size="sm" variant="ghost" onClick={adicionarPagamento}>
                  <Plus className="h-3 w-3 mr-1" /> Adicionar parcela manual
                </Button>
              </Card>
            )}

            {pagamentos.length > 0 && (
              <div className="bg-muted/30 rounded-lg p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold">Parcelas ({pagamentos.length})</h3>
                  <div className="text-xs tabular-nums">
                    Soma: <strong>{formatBRL(somaPagamentos)}</strong> · Total: <strong>{formatBRL(total)}</strong>
                    {Math.abs(diferenca) > 0.01 && (
                      <span className={diferenca > 0 ? "text-warning ml-2" : "text-destructive ml-2"}>
                        Δ {formatBRL(diferenca)}
                      </span>
                    )}
                  </div>
                </div>
                {pagamentos.map((p, i) => (
                  <div key={i} className="grid grid-cols-12 gap-2 items-center">
                    <div className="col-span-1 text-xs text-muted-foreground text-center">
                      {p.parcela}/{p.total_parcelas}
                    </div>
                    <div className="col-span-3">
                      <Select
                        value={p.forma}
                        onValueChange={(v) => atualizarPagamento(i, { forma: v })}
                      >
                        <SelectTrigger className="h-8 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="pix">PIX</SelectItem>
                          <SelectItem value="boleto">Boleto</SelectItem>
                          <SelectItem value="transferencia">Transferência</SelectItem>
                          <SelectItem value="cartao">Cartão</SelectItem>
                          <SelectItem value="cheque">Cheque</SelectItem>
                          <SelectItem value="dinheiro">Dinheiro</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="col-span-3">
                      <Input
                        type="number"
                        step="0.01"
                        className="h-8 text-xs tabular-nums"
                        value={p.valor}
                        onChange={(e) =>
                          atualizarPagamento(i, { valor: parseFloat(e.target.value) || 0 })
                        }
                      />
                    </div>
                    <div className="col-span-4">
                      <Input
                        type="date"
                        className="h-8 text-xs"
                        value={p.vencimento ?? ""}
                        onChange={(e) => atualizarPagamento(i, { vencimento: e.target.value })}
                      />
                    </div>
                    <div className="col-span-1 flex justify-end">
                      {pagamentos.length > 1 && (
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7"
                          onClick={() => removerPagamento(i)}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </Card>
      )}


      {/* PASSO 4: REVISÃO */}
      {passo === 4 && (
        <Card className="p-6">
          <h2 className="font-bold mb-4">4. Revisão final</h2>

          <div className="space-y-4">
            <div className="bg-muted/30 rounded-lg p-3">
              <div className="text-xs uppercase tracking-wider text-muted-foreground mb-1">
                Cliente
              </div>
              <div className="font-semibold">
                {clienteSelecionado?.nome_fantasia || clienteSelecionado?.razao_social}
              </div>
              <div className="text-xs text-muted-foreground">
                {maskCNPJ(clienteSelecionado?.cnpj ?? "")}
              </div>
            </div>

            <div className="bg-muted/30 rounded-lg p-3">
              <div className="text-xs uppercase tracking-wider text-muted-foreground mb-2">
                Itens ({carrinho.length})
              </div>
              {carrinho.map((c, i) => (
                <div
                  key={i}
                  className="flex justify-between text-sm py-1 border-b last:border-0"
                >
                  <span>
                    {c.quantidade}× {c.modelo} {c.capacidade ?? ""}
                  </span>
                  <span className="tabular-nums">
                    {formatBRL(c.quantidade * c.preco_unitario)}
                  </span>
                </div>
              ))}
            </div>

            <div className="bg-muted/30 rounded-lg p-3">
              <div className="text-xs uppercase tracking-wider text-muted-foreground mb-1">
                Condição
              </div>
              <div className="text-sm">
                {condicaoPagamento} · {pagamentos.length} pagamento(s)
              </div>
            </div>

            <div className="space-y-1 text-sm">
              <div className="flex justify-between">
                <span>Subtotal</span>
                <span className="tabular-nums">{formatBRL(subtotal)}</span>
              </div>
              <div className="flex justify-between text-warning">
                <span>Desconto</span>
                <span className="tabular-nums">−{formatBRL(descontoNum)}</span>
              </div>
              <div className="flex justify-between text-xl font-bold pt-2 border-t">
                <span>Total</span>
                <span className="tabular-nums text-warning">{formatBRL(total)}</span>
              </div>
            </div>

            {clienteSelecionado &&
              Number(clienteSelecionado.limite_credito) > 0 &&
              total > Number(clienteSelecionado.limite_credito) && (
                <div className="bg-warning/10 border border-warning/30 rounded p-3 flex gap-2 text-sm">
                  <AlertTriangle className="h-4 w-4 text-warning shrink-0" />
                  <span>
                    Valor excede limite de crédito do cliente (
                    {formatBRL(Number(clienteSelecionado.limite_credito))}). Pedido vai
                    pra aprovação.
                  </span>
                </div>
              )}
          </div>
        </Card>
      )}

      {/* Navegação */}
      <div className="flex justify-between pt-2">
        <Button variant="outline" onClick={handleVoltar} disabled={passo === 1 || salvando}>
          <ArrowLeft className="h-4 w-4 mr-1" /> Voltar
        </Button>
        {passo < 4 ? (
          <Button onClick={handleProximo}>
            Próximo <ArrowRight className="h-4 w-4 ml-1" />
          </Button>
        ) : (
          <Button onClick={handleFinalizar} disabled={salvando} size="lg">
            {salvando ? (
              <>
                <Loader2 className="h-4 w-4 mr-1 animate-spin" /> Criando
              </>
            ) : (
              <>
                <CheckCircle2 className="h-4 w-4 mr-1" /> Finalizar pedido
              </>
            )}
          </Button>
        )}
      </div>

      <NovoClienteAtacadoDialog
        open={novoClienteOpen}
        onOpenChange={setNovoClienteOpen}
        onSaved={(id) => setClienteId(id)}
      />
    </div>
  );
}
